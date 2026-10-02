// SEO edge injection (njs): serves the SPA shell for /hut/{slug} with
// per-hut <title>, og:*, canonical and JSON-LD injected into <head>.
//
// Data contract: GET /v1/huts/{slug}/meta on the API host (proxied +
// disk-cached via the internal /_seo/meta/ location, see
// nginx-default.conf). Any failure — unknown hut, backend down, bad
// JSON — degrades gracefully to the unmodified shell, so the SPA renders
// exactly as before and only the meta tags are missing.
//
// njs runs a conservative ES6 subset: plain functions, promises, no
// optional chaining, no replaceAll.
//
// __WODORE_SEO_PAGE_TTL__ is a placeholder substituted by the
// entrypoint (docker/entrypoint.sh) — keep it declared for ESLint.
/* global __WODORE_SEO_PAGE_TTL__ */

const SHELL_URI = '/_seo/shell';

// Locale-prefixed routes: /en|/fr|/it/... (German, the default, stays
// at the root — cartoload-style prefix_default_language=False).
// Language routing (full-prefix model), baked by the entrypoint
// (docker/entrypoint.sh): __WODORE_LANG_PREFIXES__ lists EVERY
// language's locale-prefixed route (/en|/de|/fr|/it/...) - those are
// the indexed, self-canonical URLs. __WODORE_DEFAULT_LANG__ (English)
// is the language of the bare (unprefixed) URL, which canonicalizes to
// the default language's prefixed URL; the SPA strips the prefix
// client-side so users always see the bare URL. Defaults mirror the
// SPA's i18n config (src/i18n/index.ts).
var DEFAULT_LANG = '__WODORE_DEFAULT_LANG__';
var LANG_PREFIXES = '__WODORE_LANG_PREFIXES__'.split(',');
var ALL_LANGS = LANG_PREFIXES.concat([DEFAULT_LANG]);
var LANG_RE = new RegExp('^\\/(' + LANG_PREFIXES.join('|') + ')(\\/|$)');
var COOKIE_RE = /(?:^|;\s*)wodore_lang=/;

function parseAcceptLanguage(header) {
  // Best matching prefix from a simple Accept-Language header
  // ("fr-CH,fr;q=0.9,en;q=0.8" → fr). null when nothing matches.
  if (!header) return null;
  var m = /^\s*([a-z]{2})/i.exec(header);
  var code = m ? m[1].toLowerCase() : '';
  if (ALL_LANGS.indexOf(code) !== -1) {
    return code;
  }
  return null;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headBlock(m, requestPath, host) {
  var parts = [];
  var title = m.title || m.name;
  parts.push('<title>' + esc(title) + '</title>');
  parts.push('<meta name="description" content="' + esc(m.description) + '">');
  // Canonical: prefixed URLs are self-canonical; the bare (user alias)
  // URL canonicalizes to the default language's prefixed URL.
  var barePath = requestPath.replace(LANG_RE, '/');
  var lang = LANG_RE.exec(requestPath);
  var canonical =
    'https://' + host + (lang ? requestPath : '/' + DEFAULT_LANG + barePath);
  parts.push('<link rel="canonical" href="' + esc(canonical) + '">');
  // hreflang cluster: every language's prefixed URL; x-default points
  // at the default language's prefixed URL. The bare URL (user alias)
  // is never an indexing target.
  var alternates = ALL_LANGS.map(function (code) {
    var href = 'https://' + host + '/' + code + barePath;
    return '<link rel="alternate" hreflang="' + code + '" href="' + esc(href) + '">';
  });
  alternates.push(
    '<link rel="alternate" hreflang="x-default" href="' +
      esc('https://' + host + '/' + DEFAULT_LANG + barePath) +
      '">'
  );
  parts.push(alternates.join(''));
  parts.push('<meta property="og:site_name" content="Wodore">');
  parts.push('<meta property="og:title" content="' + esc(title) + '">');
  parts.push('<meta property="og:description" content="' + esc(m.description) + '">');
  parts.push('<meta property="og:type" content="website">');
  parts.push('<meta property="og:url" content="' + esc(m.page_url) + '">');
  if (m.image) {
    parts.push('<meta property="og:image" content="' + esc(m.image) + '">');
  }
  parts.push('<meta name="twitter:card" content="summary_large_image">');
  parts.push('<meta name="twitter:title" content="' + esc(title) + '">');
  parts.push('<meta name="twitter:description" content="' + esc(m.description) + '">');
  if (m.image) {
    parts.push('<meta name="twitter:image" content="' + esc(m.image) + '">');
  }
  if (m.jsonld) {
    parts.push(
      '<script type="application/ld+json">' + JSON.stringify(m.jsonld) + '</script>'
    );
  }
  return parts.join('\n    ');
}

// Remove the shell's default title/meta/link tags that we replace —
// duplicated og:/description tags are resolved unpredictably by crawlers.
function stripDefaults(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(
      /<meta\s+(?:name|property)=["'](?:description|application-name|title|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi,
      ''
    )
    .replace(/<link\s[^>]*rel=["']canonical["'][^>]*>/gi, '');
}

function inject(shell, m, requestPath, host) {
  var html = stripDefaults(shell);
  var block = '\n    ' + headBlock(m, requestPath, host) + '\n  ';
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, function (h) {
      return h + block;
    });
  }
  if (m.lang && /<html[^>]*>/i.test(html)) {
    html = html.replace(/<html[^>]*>/i, function (h) {
      if (/lang=/i.test(h)) {
        return h.replace(/lang=["'][^"']*["']/i, 'lang="' + esc(m.lang) + '"');
      }
      return h.replace('<html', '<html lang="' + esc(m.lang) + '"');
    });
  }
  return html;
}

// Page cache TTL (seconds), substituted by the entrypoint.
// 0 (default) = no-store, identical to the index.html policy — safe with
// any frontend, no CDN required.
// >0 = opt-in for a shared cache/CDN in front: browsers still revalidate
// (max-age=0, a hard-cached shell would reference JS chunks that vanish
// on redeploy) but shared caches may keep the page for PAGE_TTL seconds.
// Only enable together with a deploy pipeline that PURGES the CDN on
// release — a stale shell served for 7 d after a redeploy breaks the app
// for every user behind that edge.
const PAGE_TTL = __WODORE_SEO_PAGE_TTL__;

function serve(r, body) {
  r.headersOut['Content-Type'] = 'text/html; charset=utf-8';
  if (PAGE_TTL > 0) {
    r.headersOut['Cache-Control'] =
      'public, max-age=0, must-revalidate, s-maxage=' + PAGE_TTL;
  } else {
    // The shell contains no volatile values (runtime env lives in the
    // always-fresh /env.js), but its hashed asset URLs change on every
    // deploy — so nothing may store it, browsers and CDNs alike.
    r.headersOut['Cache-Control'] =
      'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
  }
  r.status = 200;
  r.sendHeader();
  if (r.method !== 'HEAD') {
    r.send(body);
  }
  r.finish();
}

function hut(r) {
  // Locale prefix: /en|/de|/fr|/it/hut/{slug} - every language is
  // prefixed (the indexed, self-canonical URLs). The prefix localizes and becomes the
  // canonical/hreflang cluster; the SPA reads it as the initial language
  // hint (stored user preference still wins for display).
  var requestPath = r.uri;
  var langMatch = LANG_RE.exec(requestPath);
  var lang = langMatch ? langMatch[1] : '';
  var slug = requestPath
    .replace(LANG_RE, '/')
    .replace(/^\/hut\//, '')
    .replace(/\/+$/, '');
  if (!slug || slug.indexOf('/') !== -1) {
    r.internalRedirect('/index.html');
    return;
  }
  // First-visit language redirect (cartoload pattern): a BARE hut URL,
  // no stored preference (no wodore_lang cookie), and an Accept-Language
  // in a non-default language → 302 to the prefixed URL. Bots send neither →
  // served as-is (stable URLs). Returning visitors keep the URL they
  // navigated to — the SPA display language follows their stored setting.
  if (!lang) {
    var cookie = r.headersIn.Cookie || '';
    if (!COOKIE_RE.test(cookie)) {
      var preferred = parseAcceptLanguage(r.headersIn['Accept-Language']);
      if (preferred && preferred !== DEFAULT_LANG) {
        r.status = 302;
        r.headersOut.Location = '/' + preferred + requestPath;
        r.sendHeader();
        r.finish();
        return;
      }
    }
  }
  // Content negotiation: clients explicitly asking for Markdown (Accept:
  // text/markdown) get the .md document instead of the HTML shell — same
  // URL, no suffix needed. The .md location then proxies to the backend.
  var accept = r.headersIn.Accept || '';
  if (accept.indexOf('text/markdown') !== -1) {
    r.internalRedirect('/hut/' + slug + '.md');
    return;
  }
  // Meta language: path prefix first, then an explicit ?lang= param.
  // Whitelisted against the meta endpoint's validated values; unknown
  // values fall back to the default language.
  var metaUri = '/_seo/meta/' + slug;
  var queryLang = r.args ? r.args.lang : '';
  var effectiveLang = lang || queryLang || DEFAULT_LANG;
  if (ALL_LANGS.indexOf(effectiveLang) !== -1) {
    metaUri += '?lang=' + effectiveLang;
  }
  Promise.all([r.subrequest(SHELL_URI), r.subrequest(metaUri)])
    .then(function (res) {
      var shellRes = res[0];
      var metaRes = res[1];
      if (shellRes.status !== 200 || !shellRes.responseText) {
        r.internalRedirect('/index.html');
        return;
      }
      var meta = null;
      if (metaRes.status === 200) {
        try {
          meta = JSON.parse(metaRes.responseText);
        } catch (e) {
          r.log('seo: invalid meta JSON for hut ' + slug + ': ' + e);
          meta = null;
        }
      }
      if (meta && meta.slug && meta.name) {
        r.log("seo: injected meta for hut '" + slug + "'");
        serve(r, inject(shellRes.responseText, meta, requestPath, r.headersIn.Host));
      } else {
        r.log(
          "seo: no meta for hut '" + slug + "' (status " + metaRes.status + '), serving shell'
        );
        serve(r, shellRes.responseText);
      }
    })
    .catch(function (e) {
      r.error('seo: subrequest failed: ' + e);
      r.internalRedirect('/index.html');
    });
}

export default { hut };
