#!/usr/bin/env node
/** Static preview server for dist/pwa on 0.0.0.0:9023 (SPA fallback).
 *  quasar serve is unavailable in this Vite setup; this mirrors the
 *  previous preview: history-mode fallback to index.html, no-cache on
 *  volatile documents.
 *
 *  CORS bridge: hub.stg.wodore.com only allows its own origins, so API
 *  calls from http://localhost:9023 / http://home:9023 are blocked by
 *  the browser. The preview proxies /v1 (and /admin) to the staging
 *  API SAME-ORIGIN, and serves /env.js dynamically with the requesting
 *  origin injected as WODORE_API_HOST (dist env.js ships '').
 *  Tiles/sprites/glyphs carry absolute URLs (maptoolkit.org,
 *  tiles.stg.wodore.com) and are CORS-enabled.
 *
 *  Cable-less mobile testing knobs (sticky via cookie, set with a query
 *  param on ANY request; reset with the "off"/"on" sentinel):
 *    ?net=slow3g   throttle app shell + proxied API to Slow-3G-ish
 *    ?net=fast3g   … Fast-3G-ish                (?net=off disables)
 *    ?cache=off    no-store everywhere + the app bypasses its service
 *                  worker and clears CacheStorage (true cold loads;
 *                  see register-service-worker.ts)  (?cache=on restores)
 *  Pair both for cold+slow splash testing: /?net=slow3g&cache=off */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, '..', 'dist', 'pwa');
const PORT = 9023;
const API_UPSTREAM = 'https://hub.stg.wodore.com';
const PROXY_PREFIXES = ['/v1', '/admin'];

/** kbps + first-byte latency; chunked writes every 50ms. */
const NET_PROFILES = {
  slow3g: { latency: 400, kbps: 400 },
  '3g': { latency: 250, kbps: 800 },
  fast3g: { latency: 150, kbps: 1600 },
  slow4g: { latency: 250, kbps: 3000 },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.pbf': 'application/x-protobuf',
};

function parseCookies(req) {
  const jar = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return jar;
}

/** Sticky debug knobs: query param sets the cookie (SESSION cookie —
 *  no Max-Age, matching the client-side knob cookies in debug-tools.ts;
 *  must never outlive the browser session), the knob's reset value
 *  clears it. Note cache's ON value is literally 'off' (caching
 *  disabled) — validation is per knob, a shared off/on reset sentinel
 *  would eat `cache=off` (bug caught live). */
const KNOBS = [
  { param: 'net', cookie: 'wd-net', valid: v => NET_PROFILES[v] != null, resets: ['off', 'on'] },
  { param: 'cache', cookie: 'wd-cache', valid: v => v === 'off', resets: ['on'] },
];

/** Read the sticky knobs, applying any ?net=/?cache= query params as
 *  cookies on THIS response. */
function stickyKnobs(req, res) {
  const jar = parseCookies(req);
  const url = new URL(req.url, 'http://x');
  const setCookies = [];
  for (const knob of KNOBS) {
    const value = url.searchParams.get(knob.param);
    if (value === null) continue;
    if (knob.resets.includes(value)) {
      delete jar[knob.cookie];
      setCookies.push(`${knob.cookie}=; Path=/; Max-Age=0`);
    } else if (knob.valid(value)) {
      jar[knob.cookie] = value;
      setCookies.push(`${knob.cookie}=${value}; Path=/`);
    }
  }
  if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
  return {
    throttle: NET_PROFILES[jar['wd-net']] ?? null,
    cacheOff: jar['wd-cache'] === 'off',
  };
}

/** Write a buffered body with optional latency + bandwidth shaping. */
function sendBody(res, status, headers, body, throttle) {
  const hdrs = { ...headers };
  if (throttle) {
    delete hdrs['content-length']; // chunked shaping changes the framing
  }
  if (!throttle) {
    res.writeHead(status, hdrs);
    res.end(body);
    return;
  }
  setTimeout(() => {
    res.writeHead(status, hdrs);
    const chunkBytes = Math.max(1, Math.round(((throttle.kbps * 1024) / 8) * 0.05));
    let at = 0;
    const timer = setInterval(() => {
      const end = Math.min(body.length, at + chunkBytes);
      res.write(body.subarray(at, end));
      at = end;
      if (at >= body.length) {
        clearInterval(timer);
        res.end();
      }
    }, 50);
    res.on('close', () => clearInterval(timer));
  }, throttle.latency);
}

function proxy(req, res, throttle, cacheOff) {
  const target = new URL(req.url, API_UPSTREAM);
  const headers = { ...req.headers, host: target.host };
  delete headers['accept-encoding']; // avoid compressed passthrough quirks
  delete headers.cookie; // staging session cookies are not ours to forward
  const up = https.request(target, { method: req.method, headers }, upRes => {
    const outHeaders = { ...upRes.headers };
    delete outHeaders['content-security-policy'];
    delete outHeaders['strict-transport-security'];
    if (cacheOff) outHeaders['cache-control'] = 'no-store';
    const chunks = [];
    upRes.on('data', c => chunks.push(c));
    upRes.on('end', () => {
      sendBody(res, upRes.statusCode ?? 502, outHeaders, Buffer.concat(chunks), throttle);
    });
  });
  up.on('error', err => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`proxy error: ${err.message}`);
  });
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const { throttle, cacheOff } = stickyKnobs(req, res);

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    urlPath = '/';
  }

  if (
    PROXY_PREFIXES.some(p => urlPath === p || urlPath.startsWith(p + '/')) &&
    req.method !== 'OPTIONS'
  ) {
    proxy(req, res, throttle, cacheOff);
    return;
  }

  let file = path.normalize(path.join(ROOT, urlPath));
  // Directory-separator boundary: a plain startsWith(ROOT) would also
  // admit sibling dirs like ../pwa-evil (review B1 — LAN-exposed server).
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403).end();
    return;
  }
  if (urlPath === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html');
  }
  const ext = path.extname(file).toLowerCase();

  // env.js is served DYNAMICALLY: WODORE_API_HOST ships as '' on disk
  // (relative = same-origin) but getEnv treats '' as unusable and falls
  // back to the baked build-time host — so inject the requesting origin
  // (http://localhost:9023, http://home:9023, …) per Host header. Every
  // client then talks to the API through this server's /v1 proxy,
  // same-origin, no CORS involved.
  if (urlPath === '/env.js') {
    fs.readFile(file, 'utf8', (err, txt) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      // Sanitize: the Host header is attacker-controlled on a shared
      // network and gets spliced into served JS — only host-shaped
      // strings pass (review finding).
      const hostRaw = req.headers.host ?? `localhost:${PORT}`;
      const host = /^[\w.:-]+$/.test(hostRaw) ? hostRaw : `localhost:${PORT}`;
      const origin = `http://${host}`;
      const body = txt.replace(/WODORE_API_HOST:\s*''/, `WODORE_API_HOST: '${origin}'`);
      // Compress like everything else (owner ask) — ~1.8KB → ~0.7KB br.
      const accept = String(req.headers['accept-encoding'] ?? '');
      let payload = Buffer.from(body, 'utf8');
      let enc = '';
      try {
        if (accept.includes('br')) {
          payload = zlib.brotliCompressSync(payload);
          enc = 'br';
        } else if (accept.includes('gzip')) {
          payload = zlib.gzipSync(payload);
          enc = 'gzip';
        }
      } catch {
        /* compression failed — serve raw */
      }
      const envHeaders = {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      };
      if (enc) envHeaders['Content-Encoding'] = enc;
      // Through sendBody so the ?net= throttle applies here too (it
      // wrote directly before — the one path the profile missed).
      sendBody(res, 200, envHeaders, payload, throttle);
    });
    return;
  }

  const volatile =
    urlPath === '/' ||
    urlPath === '/index.html' ||
    urlPath === '/env.js' ||
    urlPath === '/service-worker.js';

  // Precompressed siblings first (the build ships .br/.gz — owner
  // report: 3G load slow because the server never compressed), else
  // on-the-fly gzip for text types, else raw.
  const acceptEncoding = String(req.headers['accept-encoding'] ?? '');
  const preferBr = acceptEncoding.includes('br');
  const preferGz = acceptEncoding.includes('gzip');
  let encoding = '';
  let encodedFile = file;
  if (preferBr && fs.existsSync(`${file}.br`)) {
    encoding = 'br';
    encodedFile = `${file}.br`;
  } else if (preferGz && fs.existsSync(`${file}.gz`)) {
    encoding = 'gzip';
    encodedFile = `${file}.gz`;
  }

  fs.readFile(encodedFile, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    let body = data;
    if (!encoding && (MIME[ext] ?? '').startsWith('text/')) {
      try {
        if (preferBr) {
          body = zlib.brotliCompressSync(data);
          encoding = 'br';
        } else if (preferGz) {
          body = zlib.gzipSync(data);
          encoding = 'gzip';
        }
      } catch {
        /* compression failed — serve raw */
      }
    }
    const headers = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      // Volatile docs (index/env/sw) revalidate; HASHED assets are
      // immutable — the filename changes with the content, so a year
      // is safe and skips revalidation entirely (owner request).
      'Cache-Control': cacheOff
        ? 'no-store'
        : volatile
          ? 'no-cache'
          : 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    };
    if (encoding) headers['Content-Encoding'] = encoding;
    sendBody(res, 200, headers, body, throttle);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `wd preview on http://0.0.0.0:${PORT} (root ${ROOT}, /v1 + /admin proxied to ${API_UPSTREAM})`
  );
  console.log('knobs: ?net=slow3g|3g|fast3g|slow4g|off  ?cache=off|on  (sticky cookies)');
});
