/**
 * Error tracking via the Sentry protocol (openspec: add-error-tracking).
 *
 * Mirrors the backend's setup (server/settings/components/sentry.py):
 * vendor-neutral (the DSN decides the destination — sentry.io or Better
 * Stack), DSN-gated, release = commit hash in every environment, semver
 * as an `app_version` tag, PII off, tracing strictly opt-in.
 *
 * Performance (perf/defer-sentry-init): this module is loaded at browser
 * idle via dynamic import from the sentry boot file, NOT during app
 * startup — the boot file buffers pre-init errors natively and flushes
 * them here after init (see flushBufferedErrors). On init, the SDK's
 * default global wrappers are trimmed: the timers/rAF/addEventListener-
 * wrapping integration (browserApiErrors) is removed entirely, and fetch
 * + XHR breadcrumbs are disabled (~200 early fetches would each run
 * through sentry-closured instrumentation; dom/history breadcrumbs stay
 * on, console breadcrumbs live in the untouched consoleIntegration).
 * On 4x-throttled mobile these wrappers billed 7.2s of scripting on
 * staging while tracing was OFF — the cost was the wrappers, not spans.
 *
 * Activation is DSN-gated: no usable `WODORE_SENTRY_DSN` (unset, empty
 * or an unrewritten `@@…@@` placeholder) → `Sentry.init` is never called
 * and no telemetry leaves the browser. Dev/test/CI/preview set no DSN
 * and are unaffected.
 *
 * Web builds send envelopes through a first-party tunnel (sentry-tunnel):
 * the SDK POSTs same-origin to /sentry-ingest and nginx proxies to the
 * ingest host — ad blockers (Brave, uBlock's EasyPrivacy list) block
 * cross-origin *.ingest.*.sentry.io requests (net::ERR_BLOCKED_BY_CLIENT,
 * observed on staging) but never first-party URLs. Capacitor builds keep
 * the direct DSN: the WebView runs no blockers and has no nginx in front.
 *
 * Env resolution has TWO deliberate modes (review B1):
 * - Runtime-swappable values (DSN, traces rate, environment) go through
 *   `getEnv()` — docker swaps them per environment at container start
 *   (`/env.js`, no rebuild); dev/Capacitor builds bake them via the
 *   inline EJS in index.html (see services/runtimeEnv.ts).
 * - Build identity (`WODORE_GIT_HASH`, `WODORE_APP_VERSION`) is read via
 *   STATIC `process.env.X` expressions — Vite replaces only static text,
 *   and these keys are absent from env.js, so a dynamic `getEnv` lookup
 *   resolves to `undefined` in the browser bundle. Same pattern as
 *   WdVersionsPanel.vue.
 *
 * Tracing is errors-only by default (product decision, see design.md
 * D5): `WODORE_SENTRY_TRACES_SAMPLE_RATE` = 0 (or unset/invalid) keeps
 * the router tracing integration unattached entirely; > 0 samples
 * pageload/navigation transactions at that rate.
 */

import * as Sentry from '@sentry/vue';
import { Capacitor } from '@capacitor/core';
import type { App } from 'vue';
import type { Router } from 'vue-router';

import { getEnv } from '@services/runtimeEnv';

/** Errors-only default; enable per deployment to opt into tracing. */
const DEFAULT_TRACES_SAMPLE_RATE = 0;

/** IP-bearing HTTP header keys (SDK v10→v11 migration guide recipe). */
const HEADER_DENY_KEYS = ['forwarded', '-ip', 'remote-', 'via', '-user'];

/**
 * v11 runtime integration identifiers, verified against the installed
 * @sentry/vue 11.8 (v11 integrations carry a `name`, no v7-style `id`):
 * `browserApiErrorsIntegration()` returns `{ name: 'BrowserApiErrors' }`.
 * Its setupOnce patches setTimeout/setInterval/requestAnimationFrame/
 * EventTarget.addEventListener — after that, MapLibre's rAF render loop
 * and every timer/listener callback execute inside sentry-closured
 * functions. Removed from the defaults (see file header).
 */
const BROWSER_API_ERRORS_INTEGRATION_NAME = 'BrowserApiErrors';

/** Same check for the default breadcrumbs instance it replaces. */
const BREADCRUMBS_INTEGRATION_NAME = 'Breadcrumbs';

/**
 * URL query params never worth collecting: the IP-bearing set above plus
 * the OIDC authorization-response params (`code`, `state`, `iss`) — the
 * SDK's built-in sensitive-key filter catches `token`/`session`/`auth`
 * names but NOT these, and right after the OIDC redirect they sit in
 * `window.location` where captured URLs would carry them.
 */
const PARAM_DENY_KEYS = [...HEADER_DENY_KEYS, 'code', 'state', 'iss'];

/**
 * First-party envelope tunnel path (web only): the SDK POSTs envelopes
 * same-origin to this path and nginx forwards them verbatim to the
 * ingest endpoint — docker/nginx-default.conf, `location = /sentry-ingest`,
 * its placeholders filled by docker/entrypoint.sh from the SAME
 * WODORE_SENTRY_DSN this file reads (client DSN and tunnel target can
 * never drift apart, and the vendor swap sentry.io ↔ Better Stack stays
 * a DSN change + container restart). Rationale: ad blockers (Brave,
 * uBlock's EasyPrivacy list) block cross-origin *.ingest.*.sentry.io
 * requests with net::ERR_BLOCKED_BY_CLIENT — same-origin URLs are never
 * blocked. Capacitor builds skip the tunnel: the WebView (origin
 * https://localhost) runs no blockers and no nginx answers the path.
 */
const TUNNEL_PATH = '/sentry-ingest';

/**
 * Parse the runtime sample rate tolerantly (spec: malformed values fall
 * back to the default, out-of-range values clamp into [0, 1]).
 */
function parseSampleRate(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_TRACES_SAMPLE_RATE;
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return DEFAULT_TRACES_SAMPLE_RATE;
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Attach the package semver to error and transaction events — the JS
 * SDK has no `default_tags` init option (same workaround as the
 * backend's `_stamp_app_version`); `release`/`environment` come from
 * the init options themselves.
 *
 * STATIC process.env read on purpose (see header comment): Vite inlines
 * it at build time; `getEnv` cannot reach this key in the browser.
 */
function stampAppVersion<T extends Sentry.Event>(event: T): T {
  const version = process.env.WODORE_APP_VERSION;
  if (version) {
    event.tags ??= {};
    event.tags.app_version = version;
  }
  return event;
}

/**
 * Initialize Sentry-protocol error tracking when a DSN is configured.
 * Called from the `sentry` boot file at browser idle via dynamic import
 * (perf/defer-sentry-init): pre-init errors — including those raised by
 * later boot files — are buffered natively by the boot file and flushed
 * through flushBufferedErrors right after this returns.
 */
export function initErrorTracking(app: App, router: Router): void {
  const dsn = getEnv('WODORE_SENTRY_DSN');
  if (dsn !== undefined && dsn.startsWith('@@')) {
    // Unrewritten placeholder: the docker image was served without
    // replace_vars rewriting /env.js (key missing from the env defaults
    // file). Degrade to telemetry-free — but say so, or ops sees "I set
    // the DSN and nothing arrived" (review S2).
    console.warn(
      '[sentry] WODORE_SENTRY_DSN placeholder was not rewritten — error tracking stays OFF. ' +
        'Is the key present in the env defaults file for replace_vars?'
    );
    return;
  }
  if (!dsn) return; // DSN-gated: fully inert without it (dev/test/CI/preview).

  const sampleRate = parseSampleRate(getEnv('WODORE_SENTRY_TRACES_SAMPLE_RATE'));

  const options: VueInitOptions = {
    // Vue app instance: hooks app.config.errorHandler so component
    // errors carry component + route context.
    app,
    dsn,
    // Deploy-exact identity, uniform across environments (design.md D4).
    // STATIC process.env read on purpose (see header comment): Vite
    // inlines the build's commit hash; `getEnv` cannot reach this key
    // in the browser bundle.
    release: process.env.WODORE_GIT_HASH || undefined,
    environment: getEnv('WODORE_ENV') || 'development',
    // Runtime platform ('web' | 'android' | 'ios') on every event:
    // distinguishes browser from Capacitor-WebView events inside the one
    // frontend project (one codebase, one SDK, one DSN — by design).
    initialScope: { tags: { platform: Capacitor.getPlatform() } },
    // GDPR-safe privacy posture — the SDK v10→v11 migration guide's
    // "keep v10 defaults" recipe (v11 removed `sendDefaultPii` and its
    // defaults COLLECT): no user identities, no cookies, no HTTP
    // bodies; IP-bearing headers/params and the OIDC authorization
    // params filtered from collected URLs. setUser is never called —
    // authenticated users stay anonymous. Caveat: PII that app code
    // writes into messages/URLs still flows into events.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: HEADER_DENY_KEYS },
        response: { deny: HEADER_DENY_KEYS },
      },
      httpBodies: [],
      urlQueryParams: { deny: PARAM_DENY_KEYS },
    },
    beforeSend: stampAppVersion,
    beforeSendTransaction: stampAppVersion,
    // Trim the default integrations (perf/defer-sentry-init, see file
    // header): drop the timers/rAF/addEventListener wrappers entirely,
    // replace the default breadcrumbs with an instance that leaves
    // fetch/XHR un-instrumented (dom/history stay on; console rides on
    // the untouched consoleIntegration default). The function form is
    // the SDK's documented way to filter the defaults — @sentry/vue's
    // init feeds them in, vueIntegration included (app wiring reads the
    // `app` init option, so post-mount init stays fully functional).
    integrations: defaults => {
      const trimmed = defaults.filter(
        integration =>
          integration.name !== BROWSER_API_ERRORS_INTEGRATION_NAME &&
          integration.name !== BREADCRUMBS_INTEGRATION_NAME
      );
      trimmed.push(Sentry.breadcrumbsIntegration({ fetch: false, xhr: false }));
      // Tracing opt-in, appended only at a positive rate (below).
      if (sampleRate > 0) {
        trimmed.push(Sentry.browserTracingIntegration({ router }));
      }
      return trimmed;
    },
  };
  // Tracing opt-in: only wired when a rate > 0 is configured —
  // 0 means errors-only mode with no tracing integration attached.
  if (sampleRate > 0) {
    options.tracesSampleRate = sampleRate;
  }

  // First-party ingest tunnel, web only (see TUNNEL_PATH): envelopes go
  // same-origin to nginx, which proxies them to the ingest host, so
  // ad-blocked browsers still get telemetry through. Native builds keep
  // the direct DSN — no blockers run in the WebView, and nothing answers
  // the path on the Capacitor origin anyway.
  if (Capacitor.getPlatform() === 'web') {
    options.tunnel = TUNNEL_PATH;
  }

  Sentry.init(options);
}

/** The vue SDK's own init options (includes the `app` instances) — not exported by name. */
type VueInitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;

/**
 * One boot-buffered pre-init error — structural mirror of the boot
 * file's `BufferedError` (kept compatible by the flush call site; the
 * boot file deliberately has no static import of this module).
 */
export interface BufferedErrorEntry {
  /** Human-readable error text (message / stringified reason). */
  message: string;
  /** Script origin — uncaught script errors only. */
  filename?: string;
  lineno?: number;
  colno?: number;
  /** Raw promise rejection reason — unhandled rejections only. */
  reason?: unknown;
  /** The original Error when available — preferred for captureException. */
  error?: unknown;
  timeStamp: number;
}

/**
 * Flush errors the sentry boot file buffered natively before the SDK
 * chunk was dynamically imported (perf/defer-sentry-init): Error
 * instances keep their stack via captureException; everything else
 * becomes a captureMessage carrying the buffered metadata as scope
 * extras. Safe to call when init was DSN-gated away — the capture*
 * calls no-op without an initialized client, nothing leaves the
 * browser (dev/test/CI/preview).
 */
export function flushBufferedErrors(entries: readonly BufferedErrorEntry[]): void {
  for (const entry of entries) {
    if (entry.error instanceof Error) {
      Sentry.captureException(entry.error);
      continue;
    }
    const extra: Record<string, unknown> = { timeStamp: entry.timeStamp };
    if (entry.filename !== undefined) {
      extra.filename = entry.filename;
      extra.lineno = entry.lineno;
      extra.colno = entry.colno;
    }
    if (entry.reason !== undefined) extra.reason = entry.reason;
    Sentry.captureMessage(entry.message, { extra });
  }
}
