/**
 * Build `public/styles/sprites/wd/sprite{,@2x}.{png,json}` — the
 * settlement dot icons used INSIDE the place-label symbol layers
 * (icon + text share one collision box, so a dot never renders without
 * its label — user directive).
 *
 * Three icons, swisstopo's settlement grammar (user round 6):
 *   wd-ring      white fill + black border (towns)
 *   wd-ring-dot  ring + small black center dot (big towns)
 *   wd-star      ring + small black 5-point star (capitals)
 *
 * Authored small and shown near scale 1.0 — scaling a big asset down
 * blurs (advisor round 5). Pure Node: circles rasterized with
 * distance-based anti-aliasing, the star via 4x4 supersampled polygon
 * coverage; PNG encoded through zlib (no image library dependency).
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

const INK = [0x1d, 0x1d, 0x1d]; // border + center marks (near-black)
const FILL = [255, 255, 255]; // ring interior
const SIZE = 14; // css px box at 1x -> draw box is 28

/** Anti-aliased coverage of a filled circle. */
const circle = (x, y, cx, cy, r) => Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x - cx, y - cy)));

/** Point-in-polygon (ray cast). */
function inPoly(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 5-point star vertices, point-up. */
function starVerts(cx, cy, R, r) {
  const v = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    v.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return v;
}

/** Rasterize one icon into an RGBA buffer of `box` px. */
function drawIcon(kind, box) {
  const cx = box / 2;
  const cy = box / 2;
  const scale = box / SIZE;
  const rOuter = 5.9 * scale; // outer edge of the black border
  const rInner = 4.3 * scale; // inner edge of the border (white fill)
  const buf = Buffer.alloc(box * box * 4, 0);
  const verts = kind === 'wd-star' ? starVerts(cx, cy, 3.1 * scale, 1.35 * scale) : null;
  for (let y = 0; y < box; y++) {
    for (let x = 0; x < box; x++) {
      const px = y * box * 4 + x * 4;
      // border ring: black between rInner and rOuter, white inside
      const outer = circle(x + 0.5, y + 0.5, cx, cy, rOuter);
      if (outer <= 0) continue;
      const inner = circle(x + 0.5, y + 0.5, cx, cy, rInner);
      let r = Math.round(INK[0] * (outer - inner) + FILL[0] * inner);
      let g = Math.round(INK[1] * (outer - inner) + FILL[1] * inner);
      let b = Math.round(INK[2] * (outer - inner) + FILL[2] * inner);
      // center marks, supersampled for the star
      if (kind === 'wd-ring-dot') {
        const dot = circle(x + 0.5, y + 0.5, cx, cy, 1.9 * scale);
        r = Math.round(INK[0] * dot + r * (1 - dot));
        g = Math.round(INK[1] * dot + g * (1 - dot));
        b = Math.round(INK[2] * dot + b * (1 - dot));
      } else if (kind === 'wd-star') {
        let hit = 0;
        for (let sy = 0; sy < 4; sy++)
          for (let sx = 0; sx < 4; sx++) if (inPoly(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, verts)) hit++;
        const cov = hit / 16;
        r = Math.round(INK[0] * cov + r * (1 - cov));
        g = Math.round(INK[1] * cov + g * (1 - cov));
        b = Math.round(INK[2] * cov + b * (1 - cov));
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

const KINDS = ['wd-ring', 'wd-ring-dot', 'wd-star'];
for (const [suffix, box, ratio] of [
  ['', SIZE, 1],
  ['@2x', SIZE * 2, 2],
]) {
  const sheetW = KINDS.length * box;
  const rgba = Buffer.alloc(sheetW * box * 4, 0);
  const json = {};
  KINDS.forEach((kind, i) => {
    const icon = drawIcon(kind, box);
    for (let y = 0; y < box; y++) {
      icon.copy(rgba, (y * sheetW + i * box) * 4, y * box * 4, (y + 1) * box * 4);
    }
    json[kind] = { x: i * box, y: 0, width: box, height: box, pixelRatio: ratio, sdf: false };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `sprite${suffix}.png`), encodePng(sheetW, box, rgba));
  fs.writeFileSync(path.join(OUT, `sprite${suffix}.json`), JSON.stringify(json) + '\n');
}
console.log(`wd sprite (ring, ring-dot, star — ${SIZE}px css) -> ${path.relative(process.cwd(), OUT)}`);
