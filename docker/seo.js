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

const SHELL_URI = '/_seo/shell';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headBlock(m) {
  var parts = [];
  parts.push('<title>' + esc(m.name) + '</title>');
  parts.push('<meta name="description" content="' + esc(m.description) + '">');
  parts.push('<link rel="canonical" href="' + esc(m.page_url) + '">');
  parts.push('<meta property="og:site_name" content="Wodore">');
  parts.push('<meta property="og:title" content="' + esc(m.name) + '">');
  parts.push('<meta property="og:description" content="' + esc(m.description) + '">');
  parts.push('<meta property="og:type" content="website">');
  parts.push('<meta property="og:url" content="' + esc(m.page_url) + '">');
  if (m.image) {
    parts.push('<meta property="og:image" content="' + esc(m.image) + '">');
  }
  parts.push('<meta name="twitter:card" content="summary_large_image">');
  parts.push('<meta name="twitter:title" content="' + esc(m.name) + '">');
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

function inject(shell, m) {
  var html = stripDefaults(shell);
  var block = '\n    ' + headBlock(m) + '\n  ';
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
  var slug = r.uri.replace(/^\/hut\//, '').replace(/\/+$/, '');
  if (!slug) {
    r.internalRedirect('/index.html');
    return;
  }
  Promise.all([r.subrequest(SHELL_URI), r.subrequest('/_seo/meta/' + slug)])
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
        serve(r, inject(shellRes.responseText, meta));
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
