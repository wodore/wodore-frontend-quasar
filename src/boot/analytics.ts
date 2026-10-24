import { boot } from 'quasar/wrappers';
import { LocalStorage } from 'quasar';
import { getEnv } from '@services/runtimeEnv';

/**
 * Umami analytics boot — wires the actual script tag (the typed track()
 * wrapper in services/analytics.ts and the WdUser/WdMapMenu opt-out
 * toggle existed, but nothing ever loaded umami, so every track() call
 * no-op'd with "Umami is not available").
 *
 * Gates, in order:
 *  1. ENV: WODORE_UMAMI_WEBSITE_ID + WODORE_UMAMI_WEBSITE_URL must both
 *     be set (DSN-gate like Sentry — dev/test/CI/preview stay
 *     telemetry-free; empty env never fetches the third-party script).
 *  2. OPT-OUT: localStorage 'umami.disabled' (the user toggle) — the
 *     script is never injected while disabled. Takes effect at boot;
 *     mid-session disables also stop custom events immediately via the
 *     track() wrapper's own gate. Auto pageviews of an
 *     already-loaded session end with the next visit.
 *  3. DNT: umami's data-do-not-track attribute — browsers with a
 *     Do-Not-Track signal are excluded from collection entirely.
 *
 * Injection runs at browser idle (requestIdleCallback, ~2s timeout) so
 * the third-party script never contends with first paint or the
 * MapLibre boot — the same lesson that deferrred the Sentry SDK chunk.
 */
let injected = false;

export default boot(() => {
  if (injected) return; // HMR/SSR re-entry guard
  injected = true;

  const inject = (): void => {
    const websiteId = getEnv('WODORE_UMAMI_WEBSITE_ID');
    const websiteUrl = getEnv('WODORE_UMAMI_WEBSITE_URL');
    if (!websiteId || !websiteUrl) return; // gate 1: no env, no telemetry

    const optedOut = LocalStorage.hasItem('umami.disabled')
      ? Boolean(LocalStorage.getItem('umami.disabled'))
      : false;
    if (optedOut) return; // gate 2: user said no

    const script = document.createElement('script');
    script.defer = true;
    script.async = true;
    script.src = `${websiteUrl.replace(/\/$/, '')}/script.js`;
    script.dataset.websiteId = websiteId;
    script.dataset.doNotTrack = 'true'; // gate 3: browser DNT
    document.head.appendChild(script);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(inject, { timeout: 2000 });
  } else {
    window.setTimeout(inject, 0);
  }
});
