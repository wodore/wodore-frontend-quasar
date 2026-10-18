/**
 * Error tracking via the Sentry protocol (openspec: add-error-tracking).
 *
 * Mirrors the backend's setup (server/settings/components/sentry.py):
 * vendor-neutral (the DSN decides the destination — sentry.io or Better
 * Stack), DSN-gated, release = commit hash in every environment, semver
 * as an `app_version` tag, PII off, tracing strictly opt-in.
 *
 * Activation is DSN-gated: no usable `WODORE_SENTRY_DSN` (unset, empty
 * or an unrewritten `@@…@@` placeholder) → `Sentry.init` is never called
 * and no telemetry leaves the browser. Dev/test/CI/preview set no DSN
 * and are unaffected.
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
import type { App } from 'vue';
import type { Router } from 'vue-router';

import { getEnv } from '@services/runtimeEnv';

/** Errors-only default; enable per deployment to opt into tracing. */
const DEFAULT_TRACES_SAMPLE_RATE = 0;

/** IP-bearing HTTP header keys (SDK v10→v11 migration guide recipe). */
const HEADER_DENY_KEYS = ['forwarded', '-ip', 'remote-', 'via', '-user'];

/**
 * URL query params never worth collecting: the IP-bearing set above plus
 * the OIDC authorization-response params (`code`, `state`, `iss`) — the
 * SDK's built-in sensitive-key filter catches `token`/`session`/`auth`
 * names but NOT these, and right after the OIDC redirect they sit in
 * `window.location` where captured URLs would carry them.
 */
const PARAM_DENY_KEYS = [...HEADER_DENY_KEYS, 'code', 'state', 'iss'];

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
 * Called from the `sentry` boot file (first in the boot list, so errors
 * raised by later boot files are captured — the frontend equivalent of
 * the backend loading its sentry settings component FIRST).
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
  };
  // Tracing opt-in: only wired when a rate > 0 is configured —
  // 0 means errors-only mode with no integration attached.
  if (sampleRate > 0) {
    options.integrations = [Sentry.browserTracingIntegration({ router })];
    options.tracesSampleRate = sampleRate;
  }

  Sentry.init(options);
}

/** The vue SDK's own init options (includes the `app` instances) — not exported by name. */
type VueInitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
