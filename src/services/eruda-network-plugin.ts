/**
 * eruda "network+" panel — UI for the preview-server network/cache knobs
 * (see scripts/preview-9023.mjs): profile throttling and the cache bypass
 * are applied SERVER-side and by the SW gate at boot, because a client
 * fetch/XHR wrapper cannot throttle the service-worker precache,
 * MapLibre's worker traffic, or the already-bootstrapped bundle. The
 * panel therefore flips the sticky knob cookies (same vocabulary as the
 * ?net=/?cache= URL params) and reloads — the boot applies everything.
 *
 * Only meaningful against the preview server; on other origins the
 * cookies are inert no-ops.
 */
import { readKnobCookie, setKnobCookie } from './debug-tools';

/** Minimal eruda plugin protocol (docs: eruda.liriliri.io/docs/plugin). */
interface ErudaPlugin {
  name: string;
  init($el: unknown): void;
  show?(): void;
  hide?(): void;
  destroy?(): void;
}

/** Network Information API surface used here — not in this project's
 * lib.dom; every access is optional so a missing API degrades to
 * "Unavailable". */
interface ConnectionLike {
  downlink?: number;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

// SAFETY: structural cast — the property genuinely may not exist
// (Firefox/Safari), the cast adds no assumptions beyond optionality.
function getConnection(): ConnectionLike | null {
  // SAFETY: navigator.connection is absent from this project's lib.dom
  // and genuinely optional at runtime (Firefox/Safari) — the cast adds
  // no assumptions beyond that optionality; null-safe access only.
  return (navigator as unknown as { connection?: ConnectionLike }).connection ?? null;
}

/** Same profiles the preview server implements (latency/kbps); the
 * dropdown is built SORTED BY SPEED (slowest first). */
const PROFILES: Record<string, { label: string; kbps: number }> = {
  slow3g: { label: 'Simulated Slow 3G (~400 kbps, +400 ms)', kbps: 400 },
  '3g': { label: 'Simulated 3G (~800 kbps, +250 ms)', kbps: 800 },
  fast3g: { label: 'Simulated Fast 3G (~1.6 Mbps, +150 ms)', kbps: 1600 },
  slow4g: { label: 'Simulated Slow 4G (~3 Mbps, +250 ms)', kbps: 3000 },
};

function applyAndReload(): void {
  window.location.reload();
}

/** The service worker serves the shell + precached assets at full
 *  speed — neither the server throttle nor cache=off can reach those
 *  responses. Unregistering + clearing BEFORE the reload makes the very
 *  next navigation a true network one (owner report: "even with cache
 *  disabled and 2G it loads fast" — the SW was still serving). */
async function teardownServiceWorker(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {
    /* SW unsupported/blocked — plain reload still applies the cookies */
  }
}

export function createNetworkUtilityPlugin(): ErudaPlugin {
  let speedEl: HTMLElement | null = null;
  let connection: ConnectionLike | null = null;
  /** The tool container — show/hide must flip its display: eruda calls
   * these on tab select; a plugin WITHOUT them leaves the container
   * hidden forever (owner-reported blank panel). */
  let container: HTMLElement | null = null;

  const updateSpeed = () => {
    if (!speedEl) return;
    const downlink = connection?.downlink;
    speedEl.textContent =
      typeof downlink === 'number' && downlink > 0 ? `${String(downlink)} Mbps` : 'Unavailable';
  };

  return {
    name: 'nettools',
    init($el) {
      const wrapped = $el as {
        html?(markup: string): void;
        get?(i: number): HTMLElement;
      };
      // SAFETY: eruda hands plugins a Luna-DOM wrapper — .html() is the
      // documented plugin API; .get(0) unwraps to the raw container for
      // querying. The cast only models those two optional members.
      const root: HTMLElement =
        typeof wrapped.get === 'function' ? (wrapped.get(0) as HTMLElement) : ($el as HTMLElement);
      container = root;
      const netCookie = readKnobCookie('wd-net') ?? '';
      const cacheOff = readKnobCookie('wd-cache') === 'off';

      const options = [
        '<option value="">No throttling (maximum speed)</option>',
        ...Object.entries(PROFILES)
          .sort(([, a], [, b]) => a.kbps - b.kbps)
          .map(
            ([value, p]) =>
              `<option value="${value}"${value === netCookie ? ' selected' : ''}>${p.label}</option>`
          ),
      ].join('');

      const markup = `
        <div style="padding: 15px; font-family: sans-serif; color: #fff; background: #111; height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch;">
          <h3 style="margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 8px;">Network Utilities</h3>

          <div style="margin-bottom: 20px; background: #222; padding: 12px; border-radius: 6px;">
            <h4 style="margin: 0 0 5px 0; color: #888; font-size: 12px; text-transform: uppercase;">Estimated Downlink</h4>
            <div id="wd-netplus-speed" style="font-size: 24px; font-weight: bold; color: #00ffcc;">…</div>
          </div>

          <label style="display: flex; align-items: center; cursor: pointer; background: #222; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
            <input type="checkbox" id="wd-netplus-cache"${cacheOff ? ' checked' : ''} style="margin-right: 12px; transform: scale(1.3);">
            <div>
              <strong>Disable Cache</strong>
              <div style="font-size: 11px; color: #888; margin-top: 2px;">No-store + service worker bypass — every load is a cold load. Reloads the app.</div>
            </div>
          </label>

          <div style="background: #222; padding: 12px; border-radius: 6px;">
            <strong style="display: block; margin-bottom: 8px;">Simulate Network Profile</strong>
            <select id="wd-netplus-net" style="width: 100%; padding: 10px; background: #333; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 14px;">
              ${options}
            </select>
            <div id="wd-netplus-msg" style="margin-top: 8px; font-size: 11px; color: #888;">
              Throttles app assets + the /v1 API proxy (not cross-origin tiles). Selecting a profile auto-enables Disable Cache — the service worker would serve its precache at full speed otherwise. Reloads the app.
            </div>
          </div>
        </div>
      `;
      // Documented path first ($el.html); DOMParser fallback for builds
      // that pass a raw element. Both are fully static markup (see the
      // SAFETY note below on the only dynamic fragments).
      if (typeof wrapped.html === 'function') {
        wrapped.html(markup);
      } else {
        // Loud, not silent: eruda's plugin protocol ALWAYS provides
        // .html() — a missing one means an unexpected API shape, which
        // must not fall through to a quiet DOMParser injection path
        // (review n3).
        throw new Error('eruda plugin API shape unexpected: $el.html missing');
      }

      speedEl = root.querySelector('#wd-netplus-speed');
      const cacheToggle = root.querySelector<HTMLInputElement>('#wd-netplus-cache');
      const netSelect = root.querySelector<HTMLSelectElement>('#wd-netplus-net');

      cacheToggle?.addEventListener('change', () => {
        const disabling = cacheToggle.checked;
        setKnobCookie('wd-cache', disabling ? 'off' : null);
        if (disabling) {
          void teardownServiceWorker().then(applyAndReload);
        } else {
          applyAndReload();
        }
      });
      netSelect?.addEventListener('change', () => {
        const profile = netSelect.value;
        setKnobCookie('wd-net', profile || null);
        // A profile is pointless while the SW serves its precache at
        // full speed — force the cache bypass along with it.
        if (profile && readKnobCookie('wd-cache') !== 'off') {
          setKnobCookie('wd-cache', 'off');
          if (cacheToggle) cacheToggle.checked = true;
        }
        if (profile) {
          void teardownServiceWorker().then(applyAndReload);
        } else {
          applyAndReload();
        }
      });

      connection = getConnection();
      connection?.addEventListener('change', updateSpeed);
      updateSpeed();
    },
    // eruda toggles tool visibility through these — missing methods
    // were why the panel rendered blank when its tab was selected.
    show() {
      if (container) container.style.display = 'block';
    },
    hide() {
      if (container) container.style.display = 'none';
    },
    destroy() {
      connection?.removeEventListener('change', updateSpeed);
      connection = null;
      speedEl = null;
      container = null;
    },
  };
}
