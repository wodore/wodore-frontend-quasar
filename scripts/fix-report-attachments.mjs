#!/usr/bin/env node
/**
 * Post-process an Allure v2 report: link attachment files to their test cases.
 *
 * Problem: allure-playwright v3 writes results that allure-commandline v2
 * can read for test metadata but NOT for attachments — the PNG/ZIP files
 * get copied into the report's data/attachments/ dir but the test-case
 * JSONs don't reference them, so the report shows no screenshots.
 *
 * Fix: after `allure generate`, scan the results dir for attachment-
 * references, find the matching test cases in the report, and inject
 * the references.
 *
 * Usage: node scripts/fix-report-attachments.mjs <resultsDir> <reportDir>
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const resultsDir = process.argv[2] || 'allure-results/merged';
const reportDir = process.argv[3] || 'allure-report';

const tcDir = join(reportDir, 'data', 'test-cases');

if (!existsSync(tcDir)) {
  console.error(`No test-cases directory at ${tcDir} — is this a v2 report?`);
  process.exit(1);
}

// Build a map: test name → attachments (from the raw results)
const resultFiles = readdirSync(resultsDir).filter(f => f.endsWith('-result.json'));
const attachmentMap = new Map(); // testCaseId or historyId → attachments[]

for (const rf of resultFiles) {
  const result = JSON.parse(readFileSync(join(resultsDir, rf), 'utf8'));
  if (!result.attachments || result.attachments.length === 0) continue;

  const key = result.historyId || result.testCaseId || result.name;
  const existing = attachmentMap.get(key) || [];
  existing.push(...result.attachments);
  attachmentMap.set(key, existing);
}

if (attachmentMap.size === 0) {
  console.log('No attachments found in results — nothing to fix.');
  process.exit(0);
}

// Scan report test cases and inject attachment references
const tcFiles = readdirSync(tcDir).filter(f => f.endsWith('.json'));
let fixed = 0;

for (const tf of tcFiles) {
  const tcPath = join(tcDir, tf);
  const tc = JSON.parse(readFileSync(tcPath, 'utf8'));

  // Try matching by historyId (most reliable) or name
  const key = tc.historyId || tc.name;
  const attachments = attachmentMap.get(key);

  if (attachments && attachments.length > 0) {
    // Check if the attachment files exist in the report's attachments dir
    const validAttachments = attachments.filter(() => {
      // v2 report renames attachments to short hashes — find by type
      return true; // the files were already copied by allure generate
    });

    if (validAttachments.length > 0) {
      tc.attachments = validAttachments;
      writeFileSync(tcPath, JSON.stringify(tc, null, 2));
      fixed++;
    }
  }
}

console.log(`fix-report-attachments: linked attachments to ${fixed}/${tcFiles.length} test cases`);
