/**
 * Index-building crawler detection (SEO).
 *
 * Mirrors the SEARCHBOT_RE list in docker/seo.js so the SPA and the SEO
 * edge agree on who counts as a "search/LLM crawler": the edge
 * 301-consolidates bare-URL hits for these UAs, the SPA skips the
 * MapLibre boot for them (MapPage never mounts WdMapView — no map
 * chunk, no worker, no styles, no tiles). Googlebot's Web Rendering
 * Service runs an evergreen Chromium and would otherwise pay the full
 * map boot while the hut panel — the indexing-relevant content — waits
 * behind it.
 *
 * This is a PERFORMANCE gate only: bots get the users' page minus a
 * canvas, no content is added or removed for them (no cloaking
 * concern). UA sniffing is acceptable at this trust level — a spoofed
 * bot UA at worst gets a mapless page.
 */
const CRAWLER_UA_RE =
  /Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|ia_archiver|GPTBot|ClaudeBot|PerplexityBot/i;

/**
 * True when the given (default: the browser's) user agent belongs to a
 * search/LLM crawler. SSR/test-safe: no navigator → false.
 */
export function isCrawlerUA(userAgent?: string): boolean {
  const ua =
    userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);
  return ua.length > 0 && CRAWLER_UA_RE.test(ua);
}
