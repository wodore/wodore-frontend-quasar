#!/usr/bin/env node
/**
 * Post-process Allure results: link orphaned attachment files to their
 * test results by timestamp.
 *
 * Problem: allure-playwright v3 creates attachment files (PNG, ZIP) in
 * the results directory but doesn't reference them from the result JSON's
 * `attachments` array — the Allure report generator ignores orphans.
 *
 * Fix: for each result with empty attachments, find attachment files
 * whose modification time falls within the result's [start, stop] window.
 *
 * Usage: node scripts/link-allure-attachments.mjs [resultsDir]
 *   (default: allure-results/e2e)
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, basename } from 'path';

const dir = process.argv[2] || 'allure-results/e2e';

const files = readdirSync(dir);
const results = files.filter(f => f.endsWith('-result.json'));
const attachments = files.filter(f => f.includes('-attachment.') || f.includes('-attachment-'));

if (results.length === 0) {
  console.log('No result files found — nothing to link.');
  process.exit(0);
}

// Build attachment metadata: { name, path, mtime (ms), type }
const attachmentMeta = attachments.map(f => {
  const full = join(dir, f);
  const stat = statSync(full);
  const ext = f.split('.').pop()?.toLowerCase() || '';
  const type =
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'zip' ? 'application/zip' :
    ext === 'json' ? 'application/json' :
    ext === 'md' ? 'text/markdown' :
    ext === 'txt' ? 'text/plain' :
    'application/octet-stream';
  return {
    name: f.replace(/-attachment\./, '.').replace(/\.[^.]+$/, ''),
    source: basename(f),
    path: full,
    mtime: stat.mtimeMs,
    type,
  };
});

let linked = 0;
let alreadyLinked = 0;
let unmatched = 0;

for (const rf of results) {
  const rp = join(dir, rf);
  const result = JSON.parse(readFileSync(rp, 'utf8'));

  // Skip results that already have linked attachments
  if (result.attachments && result.attachments.length > 0) {
    alreadyLinked++;
    continue;
  }

  const start = result.start || 0;
  const stop = result.stop || Date.now();

  // Find attachments created during this test's execution
  // (allow 2s tolerance for file system timing)
  const matching = attachmentMeta.filter(a =>
    a.mtime >= start - 2000 && a.mtime <= stop + 2000
  );

  if (matching.length > 0) {
    result.attachments = matching.map(a => ({
      name: a.name,
      source: a.source,
      type: a.type,
    }));
    writeFileSync(rp, JSON.stringify(result, null, 2));
    linked += matching.length;
  } else {
    unmatched++;
  }
}

console.log(
  `link-allure-attachments: ${linked} attachments linked to results, ` +
  `${alreadyLinked} results already had attachments, ` +
  `${unmatched} results had no matching attachments.`
);

// Warn about completely orphaned attachments
const linkedSources = new Set(
  results.flatMap(rf => {
    const result = JSON.parse(readFileSync(join(dir, rf), 'utf8'));
    return (result.attachments || []).map(a => a.source);
  })
);
const orphans = attachments.filter(f => !linkedSources.has(basename(f)));
if (orphans.length > 0) {
  console.log(`Warning: ${orphans.length} attachment files are not linked to any result.`);
}
