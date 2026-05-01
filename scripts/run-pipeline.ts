/**
 * Run full pipeline for all candidates in a role.
 * Apollo Match -> EnrichLayer -> Web Presence -> Score
 *
 * Usage: npx tsx scripts/run-pipeline.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const ROLE = 'Head of Design - Ninety';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID!;

async function getJD(): Promise<string> {
  const params = new URLSearchParams({
    filterByFormula: `{Role}='${ROLE}'`,
    'fields[]': 'Hiring Job Description',
    maxRecords: '1',
  });
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?${params}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } },
  );
  const data = await res.json();
  return (data.records?.[0]?.fields?.['Hiring Job Description'] as string) ?? '';
}

async function main() {
  const startTime = Date.now();
  console.log(`=== Full Pipeline: ${ROLE} ===\n`);

  const { apolloMatchAndEnrich } = await import('../src/lib/tools/apollo.js');
  const { enrichAndSaveProfiles } = await import('../src/lib/tools/enrichlayer.js');
  const { searchAndSaveWebPresence } = await import('../src/lib/tools/nia.js');
  const { scoreCandidates } = await import('../src/lib/tools/scoring.js');

  const toolCtx = { toolCallId: 'run', messages: [], abortSignal: undefined as unknown as AbortSignal };

  // Step 1: Apollo Match + Enrich
  console.log('Step 1/4: Apollo Match + Enrich...');
  const t1 = Date.now();
  const apolloResult = await apolloMatchAndEnrich.execute({ role: ROLE }, toolCtx);
  console.log(`  Done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log(`  Total: ${apolloResult.total}, Matched: ${apolloResult.matched}, Not found: ${apolloResult.not_found}, Failed: ${apolloResult.failed}\n`);

  // Step 2: EnrichLayer
  console.log('Step 2/4: EnrichLayer...');
  const t2 = Date.now();
  const enrichResult = await enrichAndSaveProfiles.execute({ role: ROLE }, toolCtx);
  console.log(`  Done in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  console.log(`  Total: ${enrichResult.total}, Enriched: ${enrichResult.enriched}, Failed: ${enrichResult.failed}\n`);

  // Step 3: Web Presence
  console.log('Step 3/4: Web Presence Discovery...');
  const t3 = Date.now();
  const webResult = await searchAndSaveWebPresence.execute({ role: ROLE, role_type: 'design' }, toolCtx);
  console.log(`  Done in ${((Date.now() - t3) / 1000).toFixed(1)}s`);
  console.log(`  Total: ${webResult.total}, Found: ${webResult.found}\n`);

  // Step 4: Scoring
  console.log('Step 4/4: Scoring (Opus + Resume PDFs)...');
  const jd = await getJD();
  if (!jd) { console.error('No JD found!'); process.exit(1); }
  const t4 = Date.now();
  const scoreResult = await scoreCandidates.execute({ role: ROLE, job_description: jd, role_type: 'design' }, toolCtx);
  console.log(`  Done in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
  console.log(`  Total: ${scoreResult.total}, Scored: ${scoreResult.scored}, Failed: ${scoreResult.failed}\n`);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`=== Pipeline Complete in ${elapsed} minutes ===\n`);
  console.log('Results (sorted by fit score):');
  console.log('-'.repeat(80));
  for (const r of scoreResult.results) {
    console.log(`  ${r.fit_score ?? '?'}/10  ${r.name}  --  ${r.status}`);
  }
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
