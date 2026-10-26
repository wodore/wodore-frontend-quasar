//
// Edge-cached SPA shell ("edge-hot index.html", docker/nginx-default.conf):
// the shell (= /index.html AND the @spa try_files fallback) is held by the
// browser for 5 minutes (max-age=300 — a quick refresh stays fully local)
// while the CDN caches its own copy (s-maxage, 600 s), tagged CDN-Tag:
// frontend-html; stale-while-revalidate lets supporting browsers serve
// stale and refresh in the background (safe: hashed chunks stay on the
// CDN). /env.js gets the same browser window with a shorter edge one
// (120 s, frontend-env). Hashed assets stay immutable-1y and are
// NEVER tagged (they must not be purged or re-fetched), manifest/sw
// stay no-store, and the njs hut shell keeps its own policy (seo.js).
//
// This spec parses the shipped nginx config so the header policies are
// guarded in CI on every PR (nginx itself is only exercised when the
// Docker image runs). It also pins the two nginx gotchas this config
// has hit before:
//   (a) a location declaring ANY add_header drops ALL server-level
//       add_headers — every add_header-bearing location must repeat the
//       X-Robots-Tag line or the orig.* noindex (#338) silently
//       disappears from that path;
//   (b) regex locations with {n} quantifiers must be quoted or nginx
//       crashes at config parse ("missing closing parenthesis").

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const conf = readFileSync(
  fileURLToPath(new URL('../../docker/nginx-default.conf', import.meta.url)),
  'utf8'
);

type LocationBlock = {
  /** Full matcher as written, e.g. '= /index.html', '~ "^/llms(\.[a-z]{2})?\.txt$"' */
  matcher: string;
  /** Directive lines only (comment lines stripped) */
  directives: string[];
};

/** Extract every `location ... { }` block (brace-matched, comments stripped). */
function parseLocations(config: string): LocationBlock[] {
  const lines = config.split('\n');
  const blocks: LocationBlock[] = [];
  // Matches `location = /index.html {`, `location ~* (sw\.js)$ {`,
  // `location @spa {`, `location ^~ /assets/ {`, `location /hut/ {` …
  const locationRe = /^(\s*)location\s+([^{]+?)\s*\{/;
  for (let i = 0; i < lines.length; i++) {
    const match = locationRe.exec(lines[i]);
    if (!match) continue;
    const matcher = match[2].trim();
    const directives: string[] = [];
    let depth = 1;
    for (let j = i + 1; j < lines.length && depth > 0; j++) {
      const line = lines[j];
      // Only lines at the block's own indent level are its directives;
      // there are no nested blocks inside locations in this config.
      if (line.trim().startsWith('#')) continue;
      if (line.includes('}')) {
        depth--;
        if (depth === 0) break;
      }
      if (line.trim()) directives.push(line.trim());
    }
    blocks.push({ matcher, directives });
  }
  return blocks;
}

const locations = parseLocations(conf);

function block(matcher: string): LocationBlock {
  const found = locations.find(l => l.matcher === matcher);
  if (!found) {
    throw new Error(`location ${matcher} not found in docker/nginx-default.conf — was it renamed?`);
  }
  return found;
}

type AddHeader = { name: string; value: string; always: boolean };

/** Parse `add_header Name "value" [always];` directives of a block. */
function addHeaders(loc: LocationBlock): AddHeader[] {
  return loc.directives
    .filter(d => d.startsWith('add_header '))
    .map(d => {
      const m = /^add_header\s+(\S+)\s+("[^"]*"|[^\s;]+)(\s+always)?;/.exec(d);
      if (!m) {
        throw new Error(`unparseable add_header directive: ${d}`);
      }
      return { name: m[1], value: m[2], always: Boolean(m[3]) };
    });
}

function headerValues(loc: LocationBlock, name: string): string[] {
  return addHeaders(loc)
    .filter(h => h.name === name)
    .map(h => h.value);
}

const cacheControl = (loc: LocationBlock): string[] => headerValues(loc, 'Cache-Control');
const cdnTag = (loc: LocationBlock): string[] => headerValues(loc, 'CDN-Tag');

describe('nginx location blocks parse', () => {
  it('finds the shell, env and asset locations', () => {
    const matchers = locations.map(l => l.matcher);
    expect(matchers).toContain('= /index.html');
    expect(matchers).toContain('@spa');
    expect(matchers).toContain('= /env.js');
    expect(matchers).toContain('^~ /assets/');
    expect(matchers).toContain('= /manifest.json');
  });

  it('quotes every regex location carrying a {n} quantifier (nginx parse crash)', () => {
    // An unquoted regex like ^/llms(\.[a-z]{2})?\.txt$ makes nginx's
    // config parser split at the braces — [emerg] at container start.
    for (const loc of locations) {
      if (!loc.matcher.startsWith('~')) continue;
      if (!loc.matcher.includes('{')) continue;
      // Quoted patterns arrive here WITH their double quotes.
      expect(loc.matcher.startsWith('"'), `${loc.matcher} must be quoted`).toBe(true);
    }
  });
});

describe('edge-hot SPA shell cache policy', () => {
  it('= /index.html: browser 5 min, edge 10 min, SWR 1 d + CDN-Tag frontend-html', () => {
    const loc = block('= /index.html');
    expect(cacheControl(loc)).toEqual([
      '"public, max-age=300, s-maxage=600, stale-while-revalidate=86400"',
    ]);
    expect(cdnTag(loc)).toEqual(['"frontend-html"']);
  });

  it('@spa (try_files fallback): identical policy + tag as = /index.html', () => {
    const loc = block('@spa');
    expect(cacheControl(loc)).toEqual([
      '"public, max-age=300, s-maxage=600, stale-while-revalidate=86400"',
    ]);
    expect(cdnTag(loc)).toEqual(['"frontend-html"']);
  });

  it('= /env.js: browser 5 min, edge 120 s, SWR 1 h + CDN-Tag frontend-env', () => {
    const loc = block('= /env.js');
    expect(cacheControl(loc)).toEqual([
      '"public, max-age=300, s-maxage=120, stale-while-revalidate=3600"',
    ]);
    expect(cdnTag(loc)).toEqual(['"frontend-env"']);
  });

  it('no no-store survives in the shell/env locations', () => {
    for (const matcher of ['= /index.html', '@spa', '= /env.js']) {
      const directives = block(matcher).directives.join('\n');
      expect(directives, matcher).not.toContain('no-store');
    }
  });

  it('tags ONLY the shell and env — immutable assets are never tagged', () => {
    const tagged = locations.filter(l => cdnTag(l).length > 0);
    expect(tagged.map(l => l.matcher).sort()).toEqual(['= /env.js', '= /index.html', '@spa']);
    // Hashed assets keep their immutable 1 y policy, untagged.
    for (const matcher of ['^~ /assets/', '~* ^/workbox-.*\\.js$']) {
      const loc = block(matcher);
      expect(cacheControl(loc)).toEqual(['"public, max-age=31536000, immutable"']);
      expect(cdnTag(loc)).toEqual([]);
    }
  });

  it('manifest.json and the service worker stay no-store', () => {
    for (const matcher of ['= /manifest.json', '~* (sw\\.js|service-worker\\.js)$']) {
      const cc = cacheControl(block(matcher));
      expect(cc.join(' '), matcher).toContain('no-store');
    }
  });
});

describe('nginx add_header inheritance gotcha (#338)', () => {
  it('every add_header-bearing location repeats X-Robots-Tag $x_robots_tag', () => {
    // nginx drops ALL server-level add_headers in a location that
    // declares ANY add_header of its own — a location with a cache or
    // CDN-Tag header but without the X-Robots-Tag line would leak the
    // orig.* CDN origin hosts as crawlable duplicates.
    const offenders = locations.filter(
      loc =>
        addHeaders(loc).length > 0 &&
        !addHeaders(loc).some(
          h => h.name === 'X-Robots-Tag' && h.value === '$x_robots_tag' && h.always
        )
    );
    expect(
      offenders.map(l => l.matcher),
      'locations declaring add_header without the X-Robots-Tag line'
    ).toEqual([]);
  });
});
