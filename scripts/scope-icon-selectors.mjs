/**
 * Post-gen step for `yarn gen:icons`.
 *
 * 1. Scopes every per-glyph rule in the generated icons.css from
 *    `.wd-<name>:before` to `i.wd-<name>:before`. Fantasticon emits bare
 *    class selectors, so ANY element carrying a `wd-<name>` class (e.g. a
 *    q-card styled with `.wd-menu`) would render the icon's private-use
 *    glyph as a tofu "?" box via ::before. QIcon renders `<i>` elements,
 *    so `i.` scoping keeps every icon working while making glyph leaks
 *    onto divs/spans structurally impossible.
 *
 * 2. Warns when a non-icon element in src/ uses a class whose name equals
 *    an icon name (e.g. class="wd-menu" on a card) - these trip the
 *    `.wd-menu:not(i)` guards in app.scss and should be renamed.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = new URL('../src/extras/icons/dist/icons.css', import.meta.url);
const css = readFileSync(cssPath, 'utf8');

// Scope glyph rules: .wd-x:before -> i.wd-x:before  (single-line, minified or pretty)
let scoped = 0;
// Only lines whose selector STARTS with `.wd-` (fresh fantasticon output).
// Lines already scoped (`i.wd-`) and the `i[class^="wd-"]` base rule are
// skipped by the negative lookahead - makes the script idempotent.
const out = css.replace(/^(?!\s*i[.[])(\s*)\.wd-([a-z0-9-]+):before/gm, (_m, indent, name) => {
  scoped++;
  return `${indent}i.wd-${name}:before`;
});
writeFileSync(cssPath, out);

// Collect icon names for the collision scan (idempotent: matches both
// `.wd-x:before` from a fresh fantasticon run and `i.wd-x:before` after scoping)
const iconNames = [...css.matchAll(/^(?:i\.)?\.?(wd-[a-z0-9-]+):before/gm)].map((m) => m[1].replace(/^wd-/, ''));

// Scan src for non-icon class usages matching icon names
const srcDir = new URL('../src', import.meta.url).pathname;
const collisions = [];
const skipDirs = new Set(['clients', 'extras', 'assets']);
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) scan(p);
      continue;
    }
    if (!/\.(vue|ts|scss)$/.test(entry.name)) continue;
    const content = readFileSync(p, 'utf8');
    for (const name of iconNames) {
      // exact class token only: "wd-close" must not match "wd-close-btn"
      const re = new RegExp(String.raw`class="[^"]*\bwd-${name}(?![a-z0-9-])`);
      if (re.test(content) && !p.includes('extras')) {
        collisions.push(`  wd-${name}  <-  ${p.replace(srcDir, 'src')}`);
      }
    }
  }
}
scan(srcDir);

console.log(`[scope-icon-selectors] scoped ${scoped} glyph rules to i.<class> selectors`);

if (collisions.length) {
  console.warn(
    '[scope-icon-selectors] WARNING: non-icon elements use icon-name classes\n' +
      '(glyphs are i-scoped so nothing breaks, but rename these to avoid confusion):'
  );
  for (const c of [...new Set(collisions)]) console.warn(c);
} else {
  console.log('[scope-icon-selectors] no icon-name class collisions in src/');
}
