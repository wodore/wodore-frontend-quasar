/**
 * Build `public/styles/sprites/wd/sprite{,@2x}.{png,json}` — the
 * settlement dot icons used INSIDE the place-label symbol layers
 * (icon + text share one collision box, so a dot never renders without
 * its label — user directive).
 *
 * Two icons, swisstopo-style settlement symbology:
 *   wd-dot       solid dark-grey circle (capitals below z8)
 *   wd-dot-ring  white-filled circle with dark-grey stroke (towns and
 *                capitals from z8, like swisstopo's dot_circle -> ring)
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

const INK = [0x4b, 0x4b, 0x4b]; // swisstopo dot grey
const SIZE = 24; // css px box at 2x -> draw box is 48
const PAD = 2;

/** Rasterize one icon into an RGBA buffer of `box` px. */
function drawIcon(kind, box) {
  const cx = box / 2;
  const cy = box / 2;
  const rFill = box / 2 - PAD;
  const stroke = kind === 'ring' ? Math.max(1.5, box / 16) : 0;
  const buf = Buffer.alloc(box * box * 4, 0);
  for (let y = 0; y < box; y++) {
    for (let x = 0; x < box; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const outer = Math.max(0, Math.min(1, rFill + 0.5 - d)); // dot silhouette
      if (outer <= 0) continue;
      const px = y * box * 4 + x * 4;
      let r = INK[0];
      let g = INK[1];
      let b = INK[2];
      if (kind === 'ring') {
        // white hole; the ink stroke blends in at the hole boundary
        const hole = Math.max(0, Math.min(1, rFill - stroke + 0.5 - d));
        r = Math.round(INK[0] * (1 - hole) + 255 * hole);
        g = Math.round(INK[1] * (1 - hole) + 255 * hole);
        b = Math.round(INK[2] * (1 - hole) + 255 * hole);
      }
      buf[px] = r;
      buf[px + 1] = g;
      buf[px + 2] = b;
      buf[px + 3] = Math.round(outer * 255);
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

/** Compose the two icons side by side into a sheet. */
function sheet(box) {
  const w = box * 2 + PAD * 3;
  const h = box + PAD * 2;
  const rgba = Buffer.alloc(w * h * 4, 0);
  for (const [i, kind] of ['dot', 'ring'].entries()) {
    const icon = drawIcon(kind, box);
    const ox = PAD + i * (box + PAD);
    for (let y = 0; y < box; y++) {
      icon.copy(rgba, ((y + PAD) * w + ox) * 4, y * box * 4, (y + 1) * box * 4);
    }
  }
  return { w, h, rgba };
}

for (const [suffix, box, ratio] of [
  ['', SIZE, 1],
  ['@2x', SIZE * 2, 2],
]) {
  const { w, h, rgba } = sheet(box);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `sprite${suffix}.png`), encodePng(w, h, rgba));
  fs.writeFileSync(
    path.join(OUT, `sprite${suffix}.json`),
    JSON.stringify(
      {
        'wd-dot': { x: PAD, y: PAD, width: box, height: box, pixelRatio: ratio, sdf: false },
        'wd-dot-ring': {
          x: PAD * 2 + box,
          y: PAD,
          width: box,
          height: box,
          pixelRatio: ratio,
          sdf: false,
        },
      },
      null,
      2
    ) + '\n'
  );
}
console.log(`wrote wd sprite (dot + dot-ring, ${SIZE}px css) to ${path.relative(process.cwd(), OUT)}`);
