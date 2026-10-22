/**
 * Idle-slot scheduling (perf/fast-first-paint): keeps non-critical boot
 * work — the catalog style prewarm, the switcher overlay compile — off
 * the first-paint critical path. MapPage gates the map mount on it too.
 *
 * `requestIdleCallback` carries a deadline so a busy main thread cannot
 * starve the task. Browsers without rIC (Safari) get a short timeout —
 * by the time these tasks run, first paint has already happened.
 * Outside the browser (SSR, unit tests) the task runs on a microtask:
 * callers keep their synchronous await semantics, and fake-timer tests
 * must not hang on a timer that never fires.
 */
export function whenIdle<T>(task: () => T | Promise<T>, timeoutMs = 1500): Promise<T> {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    return Promise.resolve().then(task);
  }
  if (typeof window.requestIdleCallback === 'function') {
    return new Promise<T>(resolve => {
      window.requestIdleCallback(() => resolve(task()), { timeout: timeoutMs });
    });
  }
  return new Promise<T>(resolve => {
    window.setTimeout(() => resolve(task()), 200);
  });
}
