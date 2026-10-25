import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CRAWLER_UA_RE, isCrawlerUA } from '@services/crawler-ua';

/** UA list must stay in sync with SEARCHBOT_RE in docker/seo.js. */
describe('isCrawlerUA', () => {
  const GOOGLEBOT_SMARTPHONE =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const GOOGLEBOT_DESKTOP =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36';

  it('matches Googlebot (smartphone + desktop WRS UAs)', () => {
    expect(isCrawlerUA(GOOGLEBOT_SMARTPHONE)).toBe(true);
    expect(isCrawlerUA(GOOGLEBOT_DESKTOP)).toBe(true);
  });

  it('matches the other index builders the SEO edge knows', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
      'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
      'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)',
      'Mozilla/5.0 (compatible; Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
      'ia_archiver',
      'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    ]) {
      expect(isCrawlerUA(ua), ua).toBe(true);
    }
  });

  it('does not match real browsers', () => {
    for (const ua of [
      'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0',
    ]) {
      expect(isCrawlerUA(ua), ua).toBe(false);
    }
  });

  it('is case-insensitive and safe for missing/empty UAs', () => {
    expect(isCrawlerUA('mozilla/5.0 (compatible; googlebot/2.1)')).toBe(true);
    expect(isCrawlerUA('')).toBe(false);
    expect(isCrawlerUA(undefined)).toBe(false);
  });
});

/** The SPA gate and the SEO edge must agree on who is a crawler: this
 * reads SEARCHBOT_RE straight out of docker/seo.js and asserts token
 * parity with CRAWLER_UA_RE, so adding a bot to the edge list without
 * the SPA (or vice versa) fails CI instead of drifting silently. */
describe('crawler-ua parity with the SEO edge', () => {
  it('mirrors every SEARCHBOT_RE token from docker/seo.js', () => {
    const seoPath = fileURLToPath(new URL('../../docker/seo.js', import.meta.url));
    const src = readFileSync(seoPath, 'utf8');
    const decl = src.match(/SEARCHBOT_RE\s*=\s*new RegExp\(([\s\S]*?)\)\s*;/);
    expect(decl, 'SEARCHBOT_RE declaration found in docker/seo.js').not.toBeNull();
    // Drop the trailing flags argument (', "i"') before extracting tokens.
    const patternSource = decl![1].replace(/,\s*'[^']*'\s*$/, '');
    const edgeTokens = (patternSource.match(/'([^']*)'/g) ?? [])
      .flatMap(segment => segment.slice(1, -1).split('|'))
      .map(token => token.trim())
      .filter(Boolean)
      .sort();
    const spaTokens = CRAWLER_UA_RE.source
      .split('|')
      .map(token => token.trim())
      .sort();
    expect(edgeTokens).toEqual(spaTokens);
    expect(CRAWLER_UA_RE.flags).toContain('i');
  });
});
