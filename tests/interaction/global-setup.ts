/**
 * Interaction-suite global setup — primes the staging response cache and
 * the catalog-index BEFORE any worker starts.
 *
 * Why: playwright runs spec files in parallel workers (4 on CI). A warmup
 * SPEC cannot gate that — three other workers cold-boot the app
 * concurrently while it runs, each paying the full catalog + style
 * round-trip (and each racing a cold dev server). Priming here means the
 * fixture's boot-cache seeding works from test #1 in every worker: the
 * app boots from seeded localStorage, the route handler replays local
 * bytes, and no test depends on style-endpoint health.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.staging-cache');
const INDEX_DIR = path.join(CACHE_DIR, 'catalog-index');

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string; // base64
}

function writeEntry(url: string, body: string): void {
  const entry: CachedResponse = {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(body, 'utf8').toString('base64'),
  };
  const file = path.join(
    CACHE_DIR,
    `${crypto.createHash('sha256').update(url).digest('hex')}.json`
  );
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entry));
  fs.renameSync(tmp, file);
  const marker = path.join(
    INDEX_DIR,
    `${crypto.createHash('sha256').update(url).digest('hex')}.json`
  );
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const tmpMarker = `${marker}.${process.pid}.tmp`;
  fs.writeFileSync(tmpMarker, JSON.stringify({ url }));
  fs.renameSync(tmpMarker, marker);
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[global-setup] ${url} → HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (error) {
    console.warn(`[global-setup] ${url} failed: ${String(error).slice(0, 120)}`);
    return null;
  }
}

export default async function globalSetup(): Promise<void> {
  const base = process.env.E2E_API_HOST ?? 'https://hub.stg.wodore.com';
  // The layers endpoint (backend #331 — the old `/v1/map/config` and
  // `/v1/map/catalog` endpoints retired with the config-catalog split).
  // Prime per spec tier at the LOW and HIGH ends: a session's GPU
  // detection resolves between them (headless CI chromium lands on
  // 'medium' — the backend's spec fallback then serves one of the
  // primed rows, and the fixture's live-fetch path covers the rest).
  let primedStyles = 0;
  for (const spec of ['low', 'high'] as const) {
    const catalogUrl = `${base}/v1/map/layers?lang=en&spec=${spec}`;
    const catalogBody = await fetchText(catalogUrl);
    if (!catalogBody) {
      console.warn(`[global-setup] ${catalogUrl} unreachable — relying on the existing cache`);
      continue;
    }
    writeEntry(catalogUrl, catalogBody);

    let layers: Array<{ slug: string; style_url?: string | null; parameters?: unknown[] }>;
    try {
      layers =
        (
          JSON.parse(catalogBody) as {
            data?: Array<{ slug: string; style_url?: string | null; parameters?: unknown[] }>;
          }
        ).data ?? [];
    } catch {
      console.warn('[global-setup] layers body unparseable — skipping style priming');
      continue;
    }

    // Prime EXACTLY what the app requests per layer: the row's own
    // style_url (it embeds the backend-resolved spec AND the immutable
    // `&v=` version token — a hand-built URL would never match the
    // app's request), plus its `mode=tokenized` sibling when the layer
    // declares parameters (client-side resolution).
    await Promise.all(
      layers.map(async layer => {
        if (!layer.style_url) return;
        const resolved = new URL(layer.style_url, base).href;
        const tokenized = (layer.parameters?.length ?? 0) > 0;
        for (const url of tokenized ? [resolved, `${resolved}&mode=tokenized`] : [resolved]) {
          const body = await fetchText(url);
          if (body) {
            writeEntry(url, body);
            primedStyles += 1;
          }
        }
      })
    );
  }
  console.info(`[global-setup] primed layers + ${primedStyles} style responses`);
}
