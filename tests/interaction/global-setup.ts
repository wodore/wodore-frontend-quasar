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
  const catalogUrl = `${base}/v1/map/catalog?lang=en`;
  const catalogBody = await fetchText(catalogUrl);
  if (!catalogBody) {
    console.warn('[global-setup] catalog unreachable — tests rely on the existing cache');
    return;
  }
  writeEntry(catalogUrl, catalogBody);

  let layers: Array<{ slug: string; parameters?: unknown[] }>;
  try {
    layers =
      (JSON.parse(catalogBody) as { layers?: Array<{ slug: string; parameters?: unknown[] }> })
        .layers ?? [];
  } catch {
    console.warn('[global-setup] catalog body unparseable — skipping style priming');
    return;
  }

  // Prime exactly what the app requests per layer: tokenized when the
  // layer declares parameters (client-side resolution), resolved
  // otherwise — at both spec tiers the GPU detection may pick.
  await Promise.all(
    layers.map(async layer => {
      const tokenized = (layer.parameters?.length ?? 0) > 0;
      for (const spec of ['low', 'high'] as const) {
        const url = `${base}/v1/map/styles/${layer.slug}.json?spec=${spec}${tokenized ? '&mode=tokenized' : ''}`;
        const body = await fetchText(url);
        if (body) writeEntry(url, body);
      }
    })
  );
  console.info(`[global-setup] primed catalog + ${layers.length * 2} style responses`);
}
