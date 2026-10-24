/**
 * Hut deep-link prefetch (perf/hut-fast-first-paint, owner 2026-10).
 *
 * Visitors arriving on /hut/:slug (e.g. from a search engine) wait for
 * the whole boot chain before the hut request even starts. This service
 * fires the hut request at the EARLIEST boot moment — before i18n, the
 * map or any store exists — and hands the response to usePlace when it
 * asks for the same slug+lang. On a miss (different slug/lang) the
 * fetch still warms the HTTP cache for the real request.
 *
 * Purely additive: no consumer → the prefetched promise is simply never
 * awaited (a cached response costs nothing). Works identically on web
 * and Capacitor — no nginx/edge involvement.
 */

import { getEnv } from './runtimeEnv';

interface PrefetchedHut {
  slug: string;
  lang: string;
  /** Resolves to the raw hut JSON (or rejects — consumers treat a
   * rejected prefetch as a miss and fetch normally). */
  promise: Promise<unknown>;
}

let prefetched: PrefetchedHut | null = null;

const HUT_PATH_RE = /\/(?:m\/)?hut\/([a-z0-9-]+)/i;

/** Persisted UI language, read dependency-free at boot (mirrors the
 *  theme sniff in index.html — the locale service is not up yet).
 *  Fallback 'en' matches the app's fallback locale. */
function sniffLang(): string {
  try {
    const raw = localStorage.getItem('CapacitorStorage.wodore:userSettings');
    const lang = raw ? ((JSON.parse(raw) || {}).ui || {}).language : undefined;
    return typeof lang === 'string' && lang ? lang : 'en';
  } catch {
    return 'en';
  }
}

/** Fire the hut request for a deep-linked hut. Safe to call any number
 *  of times — only the first call prefetches. */
export function startHutPrefetch(): void {
  if (prefetched || typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  const match = HUT_PATH_RE.exec(window.location.pathname);
  if (!match) return;
  const slug = match[1]!.toLowerCase();
  const lang = sniffLang();
  // Same URL shape usePlace builds (clientWodore baseUrl + the literal
  // /v1 path): a miss still warms the shared HTTP cache entry.
  const url = `${getEnv('WODORE_API_HOST')}/v1/huts/${slug}?lang=${lang}`;
  prefetched = {
    slug,
    lang,
    promise: fetch(url, { headers: { Accept: 'application/json' } }).then(res => {
      if (!res.ok) throw new Error(`Hut prefetch HTTP ${String(res.status)}`);
      return res.json() as Promise<unknown>;
    }),
  };
}

/** Consumer side (usePlace): returns the prefetched response promise
 *  when it matches slug+lang, else null (treated as a miss). */
export function consumePrefetchedHut(slug: string, lang: string): Promise<unknown> | null {
  if (!prefetched) return null;
  if (prefetched.slug !== slug.toLowerCase() || prefetched.lang !== lang) return null;
  const p = prefetched.promise;
  prefetched = null; // one-shot: a second navigation fetches normally
  return p;
}
