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
var LANG_RE = /^\/(en|fr|it)(\/|$)/;
var COOKIE_RE = /(?:^|;\s*)wodore_lang=/;

function parseAcceptLanguage(header) {
  // Best matching prefix from a simple Accept-Language header
  // ("fr-CH,fr;q=0.9,en;q=0.8" → fr). null when nothing matches.
  if (!header) return null;
  var m = /^\s*([a-z]{2})/i.exec(header);
  var code = m ? m[1].toLowerCase() : '';
  if (code === 'de' || code === 'en' || code === 'fr' || code === 'it') {
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
  // Canonical: the full prefixed URL the crawler requested.
  var canonical = 'https://' + host + requestPath;
  parts.push('<link rel="canonical" href="' + esc(canonical) + '">');
  // hreflang cluster: bare = de + x-default, prefixed for the rest.
  var barePath = requestPath.replace(LANG_RE, '/');
  var bare = 'https://' + host + barePath;
  var alternates = ['de', 'en', 'fr', 'it'].map(function (code) {
    var href = code === 'de' ? bare : 'https://' + host + '/' + code + barePath;
    return '<link rel="alternate" hreflang="' + code + '" href="' + esc(href) + '">';
  });
  alternates.push(
    '<link rel="alternate" hreflang="x-default" href="' + esc(bare) + '">'
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
  // Locale prefix: /en|/fr|/it/hut/{slug} (German = bare, /de/ 301s to
  // bare). The prefix localizes the injected meta and becomes the
  // canonical/hreflang cluster; the SPA reads it as the initial language
  // hint (stored user preference still wins for display).
  var requestPath = r.uri;
  var langMatch = LANG_RE.exec(requestPath);
  var lang = langMatch ? langMatch[1] : '';
  if (requestPath.indexOf('/de/') === 0 || requestPath === '/de') {
    r.status = 301;
    r.headersOut.Location = requestPath.replace(/^\/de/, '') || '/';
    r.sendHeader();
    r.finish();
    return;
  }
  var slug = requestPath
    .replace(/^\/(en|fr|it)\/hut\//, '/hut/')
    .replace(/^\/hut\//, '')
    .replace(/\/+$/, '');
  if (!slug || slug.indexOf('/') !== -1) {
    r.internalRedirect('/index.html');
    return;
  }
  // First-visit language redirect (cartoload pattern): a BARE hut URL,
  // no stored preference (no wodore_lang cookie), and an Accept-Language
  // matching en/fr/it → 302 to the prefixed URL. Bots send neither →
  // served as-is (stable URLs). Returning visitors keep the URL they
  // navigated to — the SPA display language follows their stored setting.
  if (!lang) {
    var cookie = r.headersIn.Cookie || '';
    if (!COOKIE_RE.test(cookie)) {
      var preferred = parseAcceptLanguage(r.headersIn['Accept-Language']);
      if (preferred && preferred !== 'de') {
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
  // values fall back to the endpoint default (de).
  var metaUri = '/_seo/meta/' + slug;
  var queryLang = r.args ? r.args.lang : '';
  var effectiveLang = lang || queryLang;
  if (effectiveLang === 'de' || effectiveLang === 'en' || effectiveLang === 'fr' || effectiveLang === 'it') {
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
