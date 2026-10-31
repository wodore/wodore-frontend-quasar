#!/usr/bin/env node
/**
 * Bundle budget guard — fails CI when the initial (critical-path) payload
 * grows past its budget, so regressions surface in the PR instead of in
 * production.
 *
 * What is measured (dist/pwa after `pnpm build:pwa`):
 *  1. INITIAL JS: every <script src> + <link rel=modulepreload> the SPA
 *     shell references — the bytes a cold first visit MUST download before
 *     the app can boot. Summed as brotli wire size (.br sibling, falling
 *     back to raw size when no sibling exists).
 *  2. SHELL: raw size of index.html (the boot shell grows with the word
 *     cycler; uncompressed so the budget tracks source growth, not
 *     compression luck).
 *
 * Lazy route chunks are deliberately NOT budgeted — they are immutable,
 * cached forever and only fetched on navigation. If a lazy chunk becomes
 * initial (a wrong import sneaks into the boot path), the INITIAL JS
 * budget catches it.
 *
 * Run: node scripts/check-bundle-budget.mjs   (after a production build)
 * Budgets live here, not in CI config — bump them DELIBERATELY with a
 * comment explaining what grew, never to "fix" a red build blindly.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/pwa');

/** Wire size of an asset: its precompressed .br sibling if the build
 * shipped one (what nginx brotli_static serves), else the raw file. */
function wireSize(relPath) {
  const br = `${DIST}/${relPath}.br`;
  if (existsSync(br)) return statSync(br).size;
  return statSync(`${DIST}/${relPath}`).size;
}

const html = readFileSync(`${DIST}/index.html`, 'utf8');

// Scripts and modulepreloads referenced by the shell (skip the SW script —
// it registers after boot and is cached separately; skip inlined snippets).
const refs = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
]
  .map(m => m[1])
  .filter(src => !src.startsWith('http') && !src.includes('sw.js'));

const jsBytes = refs.reduce((sum, ref) => sum + wireSize(ref.replace(/^\//, '')), 0);
const shellBytes = statSync(`${DIST}/index.html`).size;

/** Budgets (bytes, brotli wire). Baseline after the map-boot chunk
 * preload (perf/map-boot 2026-10-31): ~513 KB initial JS — the 8
 * modulepreload links (MapLibre 327KB raw + MapPage/WdMapView/stores)
 * are INTENTIONALLY on the boot critical path (they flatten the serial
 * dynamic-import chain; see quasar.config.ts wd-modulepreload-map-boot).
 * Without the preload the budget was 225 KB; with it, the chunks download
 * in parallel rather than serially — the WALL-CLOCK boot is faster even
 * though the byte budget grew. Headroom ≈ 3 KB — the preload set is
 * build-managed, not organic; any growth here means a new chunk entered
 * the preload list and should be justified in the plugin's prefix
 * list, not silently absorbed. */
const BUDGET_INITIAL_JS = 518 * 1024;
const BUDGET_SHELL = 40 * 1024;

const kb = b => `${(b / 1024).toFixed(1)} KB`;
let failed = false;

console.log(`initial JS : ${refs.length} files, ${kb(jsBytes)} (budget ${kb(BUDGET_INITIAL_JS)})`);
if (jsBytes > BUDGET_INITIAL_JS) {
  console.error('  ✗ OVER BUDGET — something entered the boot critical path');
  failed = true;
}
console.log(`shell      : ${kb(shellBytes)} raw (budget ${kb(BUDGET_SHELL)})`);
if (shellBytes > BUDGET_SHELL) {
  console.error('  ✗ OVER BUDGET — the boot shell grew');
  failed = true;
}

if (failed) {
  console.error('\nBundle budget exceeded. If the growth is intended, bump the');
  console.error('budget in scripts/check-bundle-budget.mjs WITH a comment.');
  process.exit(1);
}
console.log('\n✓ bundle budgets OK');
