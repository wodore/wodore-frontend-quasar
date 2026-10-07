/**
 * Build `public/styles/sprites/wd/sprite{,@2x}.{png,json}` — the
 * settlement dot icon used INSIDE the place-label symbol layers
 * (icon + text share one collision box, so a dot never renders without
 * its label — user directive).
 *
 * One icon, swisstopo's look: a small SOLID dark dot with a thin white
 * halo (the halo separates it from terrain). Authored small and shown
 * near scale 1.0 — scaling a big asset down blurs (advisor round 5).
 *
 * Pure Node: circles are rasterized with distance-based anti-aliasing
 * and encoded as PNG via zlib (no image library dependency).
 *
 * Run: node scripts/style/build-sprite.mjs   (or: yarn gen:sprite)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '..', 'public', 'styles', 'sprites', 'wd');

const INK = [0x26, 0x26, 0x26]; // swisstopo dot dark
const HALO = [255, 255, 255];
const SIZE = 14; // css px box at 1x -> draw box is 28

/** Rasterize the dot into an RGBA buffer of `box` px. */
function drawIcon(box) {
  const cx = box / 2;
  const cy = box / 2;
  const scale = box / SIZE;
  const rInk = 3.6 * scale; // solid dark core radius
  const rHalo = 5.4 * scale; // halo outer radius
  const buf = Buffer.alloc(box * box * 4, 0);
  for (let y = 0; y < box; y++) {
    for (let x = 0; x < box; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const ink = Math.max(0, Math.min(1, rInk + 0.5 - d));
      const halo = Math.max(0, Math.min(1, rHalo + 0.5 - d));
      // alpha = halo coverage; color = ink over white halo
      if (halo <= 0) continue;
      const px = y * box * 4 + x * 4;
      const a = Math.round(halo * 255);
      const r = Math.round(INK[0] * ink + HALO[0] * (1 - ink));
      const g = Math.round(INK[1] * ink + HALO[1] * (1 - ink));
      const b = Math.round(INK[2] * ink + HALO[2] * (1 - ink));
      buf[px] = r;
      buf[px + 1] = g;
      buf[px + 2] = b;
      buf[px + 3] = a;
    }
  }
  return buf;
}

/** Minimal PNG encoder (truecolor+alpha, filter 0). */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

for (const [suffix, box, ratio] of [
  ['', SIZE, 1],
  ['@2x', SIZE * 2, 2],
]) {
  const icon = drawIcon(box);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `sprite${suffix}.png`), encodePng(box, box, icon));
  fs.writeFileSync(
    path.join(OUT, `sprite${suffix}.json`),
    JSON.stringify({
      'wd-dot': { x: 0, y: 0, width: box, height: box, pixelRatio: ratio, sdf: false },
    }) + '\n'
  );
}
console.log(`wrote wd sprite (solid dot + white halo, ${SIZE}px css) to ${path.relative(process.cwd(), OUT)}`);
