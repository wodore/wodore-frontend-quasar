/**
 * Error tracking via the Sentry protocol (openspec: add-error-tracking).
 *
 * Mirrors the backend's setup (server/settings/components/sentry.py):
 * vendor-neutral (the DSN decides the destination — sentry.io or Better
 * Stack), DSN-gated, release = commit hash in every environment, semver
 * as an `app_version` tag, PII off, tracing strictly opt-in.
 *
 * Activation is DSN-gated: no usable `WODORE_SENTRY_DSN` (unset, empty
 * or an unrewritten `@@…@@` placeholder — `getEnv` filters all three)
 * → `Sentry.init` is never called and no telemetry leaves the browser.
 * Dev/test/CI/preview set no DSN and are unaffected.
 *
 * Config flows through the runtime env accessor so one code path covers
 * every target: docker swaps the DSN per environment at container start
 * (`/env.js`, no rebuild), dev/Capacitor builds bake it at build time
 * (inline EJS in index.html) — see services/runtimeEnv.ts.
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

/** The vue SDK's own init options (includes the `app` instances) — not exported by name. */
type VueInitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;

/** Errors-only default; enable per deployment to opt into tracing. */
const DEFAULT_TRACES_SAMPLE_RATE = 0;

/**
 * IP-bearing header / query-param keys, matching the SDK's v10→v11
 * migration guide for "keep v10 privacy defaults".
 */
const IP_BEARING_KEYS = ['forwarded', '-ip', 'remote-', 'via', '-user'];

/**
 * DSN usability gate. `getEnv` already filters empty values and
 * unrewritten `@@…@@` placeholders on the runtime-env path, but its
 * process.env fallback (dev/test) passes values through raw — so the
 * service re-checks: a misconfigured container must degrade to
 * telemetry-free, never initialize with a placeholder DSN.
 */
function isUsableDsn(value: string | undefined): value is string {
  return value !== undefined && value !== '' && !value.startsWith('@@');
}

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
 */
function stampAppVersion<T extends Sentry.Event>(event: T): T {
  const version = getEnv('WODORE_APP_VERSION');
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
  if (!isUsableDsn(dsn)) {
    return; // DSN-gated: fully inert without it (dev/test/CI/preview).
  }

  const sampleRate = parseSampleRate(getEnv('WODORE_SENTRY_TRACES_SAMPLE_RATE'));

  const options: VueInitOptions = {
    // Vue app instance: hooks app.config.errorHandler so component
    // errors carry component + route context.
    app,
    dsn,
    // Deploy-exact identity, uniform across environments (design.md D4).
    release: getEnv('WODORE_GIT_HASH') || undefined,
    environment: getEnv('WODORE_ENV') || 'development',
    // GDPR-safe (the v11 replacement for `sendDefaultPii: false`, per the
    // SDK v10→v11 migration guide): no user identities, no cookies, no
    // request/response bodies, and IP-bearing headers/params filtered —
    // mirroring the backend's `send_default_pii=False` semantics.
    // setUser is never called — authenticated users stay anonymous.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: IP_BEARING_KEYS },
        response: { deny: IP_BEARING_KEYS },
      },
      httpBodies: [],
      urlQueryParams: { deny: IP_BEARING_KEYS },
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
