#!/usr/bin/env node
/**
 * Radius ramp lint (design system guard).
 *
 * Canonical ramp (DESIGN.md, owner decision 2026-09-27): 4px controls /
 * chips / inputs, 8px cards / panels, 16px dialogs / sheets, pills and
 * circles fully round. Exempt sub-controls (scrollbar thumbs, progress
 * bars, tiny indicator ticks): radii <= 3px are micro-detail, not ramp.
 *
 * Allowed border-radius values in src/:
 *   - 0, 1, 2, 3 px (micro-detail exemption)
 *   - 4, 8, 16 px (the ramp)
 *   - 50%, 999px (circles and pills)
 *   - var()/ SCSS $variables / 999em etc. (non-literal, unchecked)
 *
 * Anything else fails the build. Run via `pnpm lint`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ALLOWED = new Set([0, 1, 2, 3, 4, 8, 16, 999]);
const ALLOWED_NON_PX = /^(50%|999em|999rem)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(vue|scss|css)$/.test(entry)) yield full;
  }
}

const violations = [];
const RE = /border-radius:\s*([^;!}]+)/g;

for (const file of walk(join(ROOT, 'src'))) {
  const rel = file.slice(ROOT.length);
  const text = readFileSync(file, 'utf8');
  // strip comments to avoid flagging commented-out code
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  let m;
  while ((m = RE.exec(clean)) !== null) {
    const value = m[1].trim();
    for (const part of value.split(/\s+/)) {
      if (part === '0') continue; // unitless zero is fine anywhere
      const px = /^(\d+(?:\.\d+)?)px$/.exec(part);
      if (px) {
        const n = Number(px[1]);
        if (n > 3 && !ALLOWED.has(n)) {
          violations.push(`${rel}: border-radius: ${value}  (${px[1]}px off-ramp)`);
        }
      } else if (!ALLOWED_NON_PX.test(part) && !/^(var\(|\$|inherit|initial|unset|calc\()/.test(part)) {
        violations.push(`${rel}: border-radius: ${value}  (unexpected unit/literal "${part}")`);
      }
    }
  }
}

if (violations.length) {
  console.error(`Radius ramp lint: ${violations.length} violation(s) — allowed: 4/8/16px ramp, ≤3px micro, 50%/999px round`);
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log('Radius ramp lint: clean (4/8/16 ramp, pills round, micro ≤3px)');
