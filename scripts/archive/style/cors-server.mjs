/**
 * Tiny CORS-enabled static server for style editing workflows.
 *
 * The hosted latest Maputnik (https://maputnik.github.io/editor/?style=…)
 * can then load our local styles for visual editing — the 2020 Maputnik
 * CLI (v1.7, last release with a binary) cannot render modern features
 * like multi-sprite arrays, which the mtk style uses.
 *
 * Usage: node scripts/style/cors-server.mjs   → http://localhost:8331
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8331;

const MIME = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pbf': 'application/x-protobuf',
  '.html': 'text/html',
};

http
  .createServer(async (req, res) => {
    // CORS for everyone — read-only static style/tile assets only
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.join(ROOT, url.pathname.replace(/^\/+/, ''));
      if (!file.startsWith(ROOT)) throw new Error('forbidden');
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  })
  .listen(PORT, () => console.log(`CORS style server on http://localhost:${PORT} (root: ${ROOT})`));
