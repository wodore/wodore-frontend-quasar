import { boot } from 'quasar/wrappers';

import { getEnv } from '@services/runtimeEnv';

/**
 * Error tracking boot (openspec: add-error-tracking) — FIRST in the
 * boot list and client-only on purpose: a tiny NATIVE error buffer is
 * installed synchronously, before any later boot file runs, mirroring
 * the backend loading its sentry settings component before everything
 * else.
 *
 * Performance (perf/defer-sentry-init): this file used to statically
 * import the Sentry SDK, dragging the whole SDK chunk into the very
 * first boot evaluation — before the app mounts. The SDK's global
 * wrappers (timers/rAF/addEventListener + fetch/XHR breadcrumbs) then
 * wrapped the MapLibre rAF render loop and every early fetch, billing
 * 7.2s of scripting on 4x-throttled mobile (staging Lighthouse). The
 * SDK chunk is now loaded only at browser-idle via dynamic import:
 *
 *   1. sync: two native listeners buffer errors (cap 20, drop oldest)
 *   2. requestIdleCallback({ timeout: 2000 }) — setTimeout fallback
 *      (Safari has no requestIdleCallback)
 *   3. dynamic import of the service → remove the buffer listeners
 *      (BEFORE init, so nothing is captured twice)
 *   4. initErrorTracking(app, router) → flushBufferedErrors(buffer)
 *
 * The buffer is a plain module-level array and stays fully inert
 * without a DSN: init is never called and the flush helper's
 * capture* calls no-op against an uninitialized SDK — no telemetry
 * leaves the browser (dev/test/CI/preview).
 *
 * Trade-off: errors raised by Vue components during the deferral
 * window are LOST entirely (Vue catches them internally before
 * app.config.errorHandler is wired, and the native window listeners
 * never see them) — only errors that reach window are buffered.
 * Accepted for not taxing first paint on low-end devices.
 */

/**
 * One buffered pre-init error. Structurally mirrored by
 * `BufferedErrorEntry` in services/sentry.ts (the flush helper's
 * parameter type) — kept compatible by the flush call site.
 */
interface BufferedError {
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

/** Cap the buffer so a boot-phase error storm cannot grow memory. */
const BUFFER_CAP = 20;

/** requestIdleCallback timeout: init even when the main thread never idles. */
const IDLE_TIMEOUT_MS = 2000;

const buffer: BufferedError[] = [];

function pushBuffered(entry: BufferedError): void {
  if (buffer.length >= BUFFER_CAP) buffer.shift(); // drop oldest
  buffer.push(entry);
}

function onErrorEvent(event: ErrorEvent): void {
  pushBuffered({
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timeStamp: event.timeStamp,
  });
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  const { reason } = event;
  const isError = reason instanceof Error;
  pushBuffered({
    message: isError ? reason.message : formatReason(reason),
    reason: isError ? undefined : reason,
    error: isError ? reason : undefined,
    timeStamp: event.timeStamp,
  });
}

/** Stringify a non-Error rejection reason without letting getters throw. */
function formatReason(reason: unknown): string {
  if (typeof reason === 'string') return reason;
  try {
    return String(reason);
  } catch {
    return 'unhandled rejection (unstringifiable reason)';
  }
}

function removeBufferListeners(): void {
  window.removeEventListener('error', onErrorEvent);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
}

/** Module-level guard: the idle pipeline runs at most once (HMR/SSR re-entry). */
let scheduled = false;

export default boot(({ app, router }) => {
  if (scheduled) return;
  scheduled = true;

  // 1. Synchronous native buffer — zero SDK code on the startup path.
  window.addEventListener('error', onErrorEvent);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  // 2. Defer the SDK to browser idle (past first paint + app mount).
  const runAtIdle = (): void => {
    // No DSN configured (dev/test/CI/preview): the SDK would init
    // inert — skip the ~67 KB chunk fetch entirely and stop buffering
    // (nothing would ever consume the buffer). The unrewritten
    // @@PLACEHOLDER@@ case deliberately still imports: the service's
    // misconfiguration warning (review S2) must stay visible.
    if (!getEnv('WODORE_SENTRY_DSN')) {
      removeBufferListeners();
      return;
    }
    void import('@services/sentry')
      .then(service => {
        // 3. Remove listeners BEFORE init — buffered errors flush once,
        //    nothing is captured by both the buffer and the SDK.
        removeBufferListeners();
        // 4. Init, then flush the buffered errors through the SDK.
        service.initErrorTracking(app, router);
        service.flushBufferedErrors(buffer);
      })
      .catch(() => {
        // Chunk load failed (offline / stale hash after a deploy): keep
        // the native listeners attached — the capped buffer keeps
        // collecting, and swallowing the rejection here keeps it from
        // self-noising the buffer via the unhandledrejection listener.
      });
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(runAtIdle, { timeout: IDLE_TIMEOUT_MS });
  } else {
    // Safari (no requestIdleCallback): settle for the macrotask queue.
    window.setTimeout(runAtIdle, 0);
  }
});
