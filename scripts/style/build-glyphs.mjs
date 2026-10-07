/**
 * Build `public/styles/glyphs/{fontstack}/{range}.pbf` — the Wodore
 * label fonts (Barlow / Barlow Semi Condensed, from the same Fontsource
 * packages the app UI self-hosts) plus vendored Noto Sans for the
 * non-latin second label line.
 *
 * Replaces the Maptoolkit glyph server (fonts.maptoolkit.org, which only
 * hosts their Ysabeau/Noto stacks): local PBFs are service-worker
 * cacheable and work in the OFM fallback / offline contexts.
 *
 * Run: node scripts/style/build-glyphs.mjs   (or: yarn gen:glyphs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { generateGlyphPbfFiles } from 'maplibre-font-maker-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '..', 'public', 'styles', 'glyphs');
const fontsource = (pkg, file) =>
  path.join(__dirname, '..', '..', 'node_modules', '@fontsource', pkg, 'files', file);

/** MapLibre glyph ranges covering latin + latin-ext + greek + cyrillic
 * (0x000-0x2FF, 0x370-0x3FF, 0x400-0x52F, 0x1E00-0x1EFF rounded to
 * 256-glyph blocks). CJK and other exotic scripts are NOT vendored —
 * the non-latin label line renders empty for those instead of tofu. */
const RANGES = [0, 256, 512, 768, 1024, 1280, 7680, 8192];

const STACKS = [
  {
    fontstack: 'Barlow Semi Condensed Regular',
    fonts: [
      ['barlow-semi-condensed', 'barlow-semi-condensed-latin-400-normal.woff2'],
      ['barlow-semi-condensed', 'barlow-semi-condensed-latin-ext-400-normal.woff2'],
    ],
  },
  {
    fontstack: 'Barlow Semi Condensed SemiBold',
    fonts: [
      ['barlow-semi-condensed', 'barlow-semi-condensed-latin-600-normal.woff2'],
      ['barlow-semi-condensed', 'barlow-semi-condensed-latin-ext-600-normal.woff2'],
    ],
  },
  {
    fontstack: 'Barlow Regular',
    fonts: [
      ['barlow', 'barlow-latin-400-normal.woff2'],
      ['barlow', 'barlow-latin-ext-400-normal.woff2'],
    ],
  },
  {
    fontstack: 'Barlow Italic',
    fonts: [
      ['barlow', 'barlow-latin-400-italic.woff2'],
      ['barlow', 'barlow-latin-ext-400-italic.woff2'],
    ],
  },
  {
    fontstack: 'Barlow SemiBold Italic',
    fonts: [
      ['barlow', 'barlow-latin-600-italic.woff2'],
      ['barlow', 'barlow-latin-ext-600-italic.woff2'],
    ],
  },
];

for (const { fontstack, fonts } of STACKS) {
  const files = await generateGlyphPbfFiles({
    fontstack,
    fonts: fonts.map(([pkg, file]) => ({
      name: fontstack,
      bytes: fs.readFileSync(fontsource(pkg, file)),
    })),
    ranges: RANGES.map(start => ({ start, end: start + 255 })),
  });
  for (const f of files) {
    const out = path.join(OUT, f.filename);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, f.bytes);
  }
  console.log(`${fontstack}: ${files.length} ranges`);
}

/* Noto Sans (non-latin second line): mirror MapLibre's demotiles PBFs
 * for the same range set — identical bytes to what the demo server
 * serves, so no regeneration risk. */
const NOTO = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'];
for (const stack of NOTO) {
  for (const start of RANGES) {
    const range = `${start}-${start + 255}`;
    const url = `https://demotiles.maplibre.org/font/${encodeURIComponent(stack)}/${range}.pbf`;
    const res = await globalThis.fetch(url);
    if (!res.ok) throw new Error(`fetching ${url}: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const out = path.join(OUT, stack, `${range}.pbf`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, bytes);
  }
  console.log(`${stack}: ${RANGES.length} ranges (mirrored)`);
}
console.log(`wrote glyph PBFs to ${path.relative(process.cwd(), OUT)}`);
