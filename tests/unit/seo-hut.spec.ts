//
// seo.js hut() content negotiation (njs, docker/seo.js): the bare
// /hut/{slug} URL must never serve (or cache) the Markdown document
// inline — Accept: text/markdown gets a permanent 308 to the .md URL,
// everything else gets the injected SPA shell. Regression guard for the
// CDN cache poisoning reproduced live on staging (2026-10-25): the old
// internalRedirect served the backend's public, max-age=3600 Markdown
// under the bare URL, and the CDN (which does not vary on Accept) fed
// it to every browser deep link.
//
// The njs `r` object is mocked; seo.js's entrypoint placeholders
// (__WODORE_SEO_PAGE_TTL__ is a bare global, substituted by
// docker/entrypoint.sh) are defined before the module evaluates, like
// the entrypoint does. The quoted string placeholders
// (__WODORE_DEFAULT_LANG__ / __WODORE_LANG_PREFIXES__) stay literal:
// LANG_RE then never matches, which is exactly the bare-URL case these
// tests exercise.

import { describe, it, expect } from 'vitest';

(globalThis as unknown as Record<string, unknown>).__WODORE_SEO_PAGE_TTL__ = 0;

type SubrequestResponse = { status: number; responseText: string };

type NjsRequest = {
  uri: string;
  method: string;
  args: Record<string, string>;
  variables: { args: string };
  headersIn: Record<string, string>;
  headersOut: Record<string, string>;
  status: number;
  log: (msg: string) => void;
  error: (msg: string) => void;
  sendHeader: () => void;
  send: (body: string) => void;
  finish: () => void;
  internalRedirect: (uri: string) => void;
  subrequest: (uri: string) => Promise<SubrequestResponse>;
};

type NjsRequestCalls = {
  internalRedirect: string[];
  sendHeader: number;
  finish: number;
  sent: string[];
};

const SHELL_HTML =
  '<html lang="de"><head><title>Wodore</title></head><body><div id="q-app"></div></body></html>';
const META_JSON = JSON.stringify({
  slug: 'wiwanni',
  name: 'Cabane du Wiwanni',
  title: 'Cabane du Wiwanni · SAC',
  description: 'Une cabane.',
  lang: 'de',
  page_url: 'https://wodore.com/hut/wiwanni',
});

function parseArgs(raw: string): Record<string, string> {
  const args: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) args[pair] = '';
    else args[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return args;
}

function makeRequest(
  uri: string,
  opts: {
    accept?: string;
    userAgent?: string;
    acceptLanguage?: string;
    cookie?: string;
    args?: string;
    subrequest?: (uri: string) => SubrequestResponse;
  } = {}
): { r: NjsRequest; calls: NjsRequestCalls } {
  const calls: NjsRequestCalls = {
    internalRedirect: [],
    sendHeader: 0,
    finish: 0,
    sent: [],
  };
  const r: NjsRequest = {
    uri,
    method: 'GET',
    args: parseArgs(opts.args ?? ''),
    variables: { args: opts.args ?? '' },
    headersIn: {
      Accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': opts.userAgent ?? 'Mozilla/5.0 (X11; Linux x86_64) pytest-agent',
      'Accept-Language': opts.acceptLanguage ?? '',
      Cookie: opts.cookie ?? '',
      Host: 'wodore.com',
    },
    headersOut: {},
    status: 0,
    log: () => {},
    error: () => {},
    sendHeader: () => {
      calls.sendHeader++;
    },
    send: (body: string) => {
      calls.sent.push(body);
    },
    finish: () => {
      calls.finish++;
    },
    internalRedirect: (target: string) => {
      calls.internalRedirect.push(target);
    },
    subrequest: (subUri: string) =>
      Promise.resolve(
        opts.subrequest ? opts.subrequest(subUri) : { status: 404, responseText: '' }
      ),
  };
  return { r, calls };
}

// hut() drives its response through a Promise chain (subrequests for the
// shell and meta) — flush microtasks (+1 macrotask) before asserting.
async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

const seo = await import('../../docker/seo.js');

describe('seo.hut content negotiation', () => {
  it('redirects Accept: text/markdown on the bare URL permanently to the .md document', () => {
    const { r, calls } = makeRequest('/hut/wiwanni', {
      accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.8',
    });

    seo.default.hut(r);

    expect(r.status).toBe(308);
    expect(r.headersOut.Location).toBe('/hut/wiwanni.md');
    // Nothing cacheable may live under the bare URL: the CDN does not
    // vary on Accept, so a cacheable redirect would poison browsers
    // into the raw .md one hop later.
    expect(r.headersOut['Cache-Control']).toContain('no-store');
    expect(r.headersOut.Vary).toBe('Accept');
    expect(calls.internalRedirect).toEqual([]);
    expect(calls.sendHeader).toBe(1);
    expect(calls.finish).toBe(1);
  });

  it('preserves the query string on the redirect target', () => {
    const { r } = makeRequest('/hut/wiwanni', {
      accept: 'text/markdown',
      args: 'lang=fr',
    });

    seo.default.hut(r);

    expect(r.status).toBe(308);
    expect(r.headersOut.Location).toBe('/hut/wiwanni.md?lang=fr');
  });

  it('does not double the .md suffix (a .md slug is normalized away)', () => {
    // In production a bare /hut/{slug}.md never reaches njs (the proxy
    // regex location wins); a LOCALE-PREFIXED /de/hut/{slug}.md does.
    // The unsubstituted __WODORE_LANG_PREFIXES__ placeholder makes the
    // prefix regex inert here, so the same slug-extraction code path is
    // exercised through the un-prefixed URI.
    const { r } = makeRequest('/hut/wiwanni.md', {
      accept: 'text/markdown',
    });

    seo.default.hut(r);

    expect(r.status).toBe(308);
    expect(r.headersOut.Location).toBe('/hut/wiwanni.md');
  });

  it('negotiation wins for crawlers too (checked before the searchbot 301)', () => {
    const { r, calls } = makeRequest('/hut/wiwanni', {
      accept: 'text/markdown',
      userAgent: 'GPTBot/1.0',
    });

    seo.default.hut(r);

    expect(r.status).toBe(308);
    expect(r.headersOut.Location).toBe('/hut/wiwanni.md');
    expect(calls.internalRedirect).toEqual([]);
  });

  it('serves the injected shell unchanged for browser Accept headers', async () => {
    const { r, calls } = makeRequest('/hut/wiwanni', {
      subrequest: uri =>
        uri === '/_seo/shell'
          ? { status: 200, responseText: SHELL_HTML }
          : { status: 200, responseText: META_JSON },
    });

    seo.default.hut(r);
    await flush();

    expect(r.status).toBe(200);
    expect(r.headersOut['Content-Type']).toContain('text/html');
    // PAGE_TTL=0: the shell policy stays no-store — unchanged behavior.
    expect(r.headersOut['Cache-Control']).toContain('no-store');
    expect(r.headersOut.Location).toBeUndefined();
    // Per-hut meta injected into the shell, and no internal redirect
    // (the SPA fallback) fired.
    expect(calls.sent[0]).toContain('<title>Cabane du Wiwanni · SAC</title>');
    expect(calls.sent[0]).toContain('og:title');
    expect(calls.internalRedirect).toEqual([]);
    expect(calls.sendHeader).toBe(1);
  });

  it('keeps the plain-shell SPA fallback for browser Accept without meta', async () => {
    const { r, calls } = makeRequest('/hut/wiwanni', {
      subrequest: uri =>
        uri === '/_seo/shell'
          ? { status: 200, responseText: SHELL_HTML }
          : { status: 404, responseText: '' },
    });

    seo.default.hut(r);
    await flush();

    expect(r.status).toBe(200);
    expect(r.headersOut['Content-Type']).toContain('text/html');
    expect(calls.internalRedirect).toEqual([]);
  });
});
