/**
 * Debug tools — eruda console + plugins (vue-devtools, monitor, timing),
 * preview/debug only.
 *
 * Flag: localStorage `wodore:debug` — the single source of truth.
 *
 * Entry points (owner spec 2026-10):
 *  - `?debug=1` / `?debug=0` boot param: sets or clears the flag and
 *    STAYS in the URL (sticky, shareable debug link).
 *  - In-app switch (WdVersionsPanel, preview/debug builds only): toggles
 *    the flag and reloads — never touches the URL param unless one is
 *    already present (then it is kept in sync). The reload exists
 *    because eruda-vue-devtools must attach BEFORE the Vue root mounts.
 *
 * Enabling at BOOT (boot/debug-tools.ts awaits this before the app
 * mounts) is the fully-working path for all plugins; the vue plugin in
 * particular needs the devtools hook present before root-instance
 * creation. Scripts load from CDN — the client needs internet.
 */

import { createNetworkUtilityPlugin } from './eruda-network-plugin';

interface ErudaLike {
  init(options?: { tool?: string[] }): void;
  add(plugin: unknown): void;
  destroy(): void;
  position?(pos: { x: number; y: number }): void;
}

declare global {
  interface Window {
    eruda?: ErudaLike;
    erudaTiming?: unknown;
  }
}

const DEBUG_KEY = 'wodore:debug';

/** Sticky knob cookies — shared vocabulary with the preview server
 * (?net=/?cache= params) and the eruda network+ panel. */
export type KnobCookie = 'wd-net' | 'wd-cache';

export function setKnobCookie(cookie: KnobCookie, value: string | null): void {
  // SESSION cookie (no Max-Age): the testing knobs must never outlive
  // the browser session (owner report: "even with cache it still changes
  // stuff" — 24h cookies kept throttling after the user stopped testing).
  // Explicit reset still clears immediately.
  document.cookie = value === null ? `${cookie}=; Path=/; Max-Age=0` : `${cookie}=${value}; Path=/`;
}

export function readKnobCookie(cookie: KnobCookie): string | null {
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === cookie) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

const SRC = {
  eruda: 'https://cdn.jsdelivr.net/npm/eruda@3',
  timing: 'https://cdn.jsdelivr.net/npm/eruda-timing',
};

export function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/** Preview deployments (the ribbon builds) — mirrors MainLayout's
 * isStaging gate for showing debug UI. */
export function isPreviewEnv(): boolean {
  const env = (typeof window !== 'undefined' && window.__WODORE_RUNTIME_ENV__?.WODORE_ENV) || '';
  return env === 'staging' || env === 'preview';
}

export function setDebugEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEBUG_KEY, '1');
    else localStorage.removeItem(DEBUG_KEY);
  } catch {
    /* storage unavailable — flag lives only for this session */
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.addEventListener('load', () => resolve(), { once: true });
    s.addEventListener('error', () => reject(new Error(`debug-tools: failed to load ${src}`)), {
      once: true,
    });
    document.head.appendChild(s);
  });
}

let enabling: Promise<void> | null = null;

/** Load eruda + plugins and init them. Idempotent; a failing plugin CDN
 * (offline, blocked) must not take the others down. */
export function enableDebugTools(): Promise<void> {
  setDebugEnabled(true);
  enabling ??= (async () => {
    // Never reject: a CDN failure must not surface as a boot error or
    // unhandled rejection — debug tooling is best-effort.
    try {
      await loadScript(SRC.eruda, 'wd-eruda');
      const eruda = window.eruda;
      if (!eruda) return;
      eruda.init(); // default tools incl. Sources (owner: keep it)
      // Entry button: bottom-center (owner request) — official API; the
      // button is draggable, this is just the initial/resting spot.
      try {
        eruda.position?.({ x: Math.round(window.innerWidth / 2 - 20), y: window.innerHeight - 60 });
      } catch {
        /* position API changed — button keeps its default corner */
      }
      await Promise.allSettled([
        loadScript(SRC.timing, 'wd-eruda-timing').then(() => {
          if (window.erudaTiming) eruda.add(window.erudaTiming);
        }),
      ]).then(() => {
        // In-repo panel for the net/cache knobs (no CDN — ships with the
        // bundle, only initialized when eruda itself is enabled).
        eruda.add(createNetworkUtilityPlugin());
      });
    } catch (err) {
      // Never reject: a CDN failure (offline moment, blocked jsdelivr)
      // must not surface as a boot error or unhandled rejection — debug
      // tooling is best-effort (owner report: "[Quasar] boot error: {}"
      // from the build that AWAITED this).
      console.warn('[debug-tools] eruda could not be loaded — skipping:', err);
    }
  })();
  return enabling;
}

export function disableDebugTools(): void {
  setDebugEnabled(false);
  // Debug off = the whole testing setup goes down with it (owner
  // spec): the net throttle and the cache bypass knobs reset too, so
  // turning the inspector off can never leave a throttled/cold
  // session behind.
  setKnobCookie('wd-net', null);
  setKnobCookie('wd-cache', null);
  window.eruda?.destroy();
  enabling = null;
}

/**
 * Boot-time `?debug=1|0` handling: the param SETS or CLEARS the flag
 * (owner spec) and STAYS in the URL — it is a sticky, shareable debug
 * URL. Returns the effective param value, or null when absent (flag
 * untouched).
 */
export function applyDebugParam(): '1' | '0' | null {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get('debug');
    if (value === null) return null;
    if (value === '1') {
      setDebugEnabled(true);
      return '1';
    }
    setDebugEnabled(false);
    return '0';
  } catch {
    // unreachable in browsers (location.href is always valid) — kept
    // for the lint contract on URL parsing
    return null;
  }
}

/**
 * Switch-side URL sync (owner spec): when the URL already carries a
 * ?debug param, the switch updates it IN PLACE so a debug URL stays
 * accurate; when absent, the switch must NOT introduce it (the flag
 * alone carries the state). Preserves path, other params and hash.
 */
export function syncDebugParam(on: boolean): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('debug')) return;
    url.searchParams.set('debug', on ? '1' : '0');
    window.history.replaceState(null, '', url.toString());
  } catch {
    // URL work is best-effort — the flag in localStorage is authoritative
  }
}
