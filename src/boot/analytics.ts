import { boot } from 'quasar/wrappers';
import { getEnv } from '@services/runtimeEnv';
import { umamiOptedOut } from '@services/analytics';

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
 * MapLibre boot — the same lesson that deferred the Sentry SDK chunk.
 *
 * Tracker extras:
 *  - data-performance="true": real-user Core Web Vitals (Umami ≥3.1 —
 *    LCP/INP/CLS/FCP/TTFB via PerformanceObservers inside the 2.3 KB
 *    tracker; no extra download).
 *
 * Session recording (replays ≥3.1 / heatmaps ≥3.2, WODORE_UMAMI_RECORDER
 * = 'on'): a SECOND script, recorder.js — an rrweb-based recorder
 * (~59 KB gzip) that DOM-snapshots and streams sampled sessions. It
 * must never be pasted into index.html: unlike script.js it has NO
 * data-do-not-track support, so the only DNT/opt-out protection it gets
 * is loading through these gates (opt-out + env above; DNT checked
 * below). Recording itself is decided server-side — the dashboard's
 * sample rate / mask level / block selector per website travel to the
 * client via a config GET the recorder makes on boot.
 */
let injected = false;

/** Browsers signaling Do-Not-Track. The tracker covers this itself via
 * its data-do-not-track attribute (gate 3); recorder.js has no such
 * attribute, so its gate lives here — same exclusion, same signal. */
function dntEnabled(): boolean {
  const dnt = navigator.doNotTrack ?? (window as { doNotTrack?: string }).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

export default boot(() => {
  if (injected) return; // HMR/SSR re-entry guard
  injected = true;

  const inject = (): void => {
    const websiteId = getEnv('WODORE_UMAMI_WEBSITE_ID');
    const websiteUrl = getEnv('WODORE_UMAMI_WEBSITE_URL');
    if (!websiteId || !websiteUrl) return; // gate 1: no env, no telemetry

    const base = websiteUrl.replace(/\/$/, '');

    if (umamiOptedOut()) return; // gate 2: user said no

    const script = document.createElement('script');
    script.defer = true;
    script.async = true;
    script.src = `${base}/script.js`;
    script.dataset.websiteId = websiteId;
    script.dataset.doNotTrack = 'true'; // gate 3: browser DNT
    script.dataset.performance = 'true';
    document.head.appendChild(script);

    // Session recording is opt-in per environment: strictly 'on' — any
    // other value (unset, empty, or an unrewritten @@…@@ docker
    // placeholder) keeps it off.
    if (getEnv('WODORE_UMAMI_RECORDER') === 'on' && !dntEnabled()) {
      const recorder = document.createElement('script');
      recorder.defer = true;
      recorder.async = true;
      recorder.src = `${base}/recorder.js`;
      recorder.dataset.websiteId = websiteId;
      document.head.appendChild(recorder);
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(inject, { timeout: 2000 });
  } else {
    window.setTimeout(inject, 0);
  }
});
