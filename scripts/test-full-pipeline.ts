/**
 * Test: Full pipeline for a single candidate
 * Runs apolloMatchAndEnrich -> enrichAndSaveProfiles -> searchAndSaveWebPresence -> scoreCandidates
 * for the test role "Head of Design - Ninety (Test)"
 *
 * Usage: npx tsx scripts/test-full-pipeline.ts
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

const ROLE = 'Head of Design - Ninety (Test)';

// Read JD from Airtable
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
  console.log(`=== Full Pipeline Test: ${ROLE} ===\n`);

  // Dynamic imports (after env is loaded)
  const { apolloMatchAndEnrich } = await import('../src/lib/tools/apollo.js');
  const { enrichAndSaveProfiles } = await import('../src/lib/tools/enrichlayer.js');
  const { searchAndSaveWebPresence } = await import('../src/lib/tools/nia.js');
  const { scoreCandidates } = await import('../src/lib/tools/scoring.js');

  // Step 1: Apollo Match + Enrich
  console.log('Step 1: Running apolloMatchAndEnrich...');
  const apolloResult = await apolloMatchAndEnrich.execute(
    { role: ROLE },
    { toolCallId: 'test', messages: [], abortSignal: undefined as unknown as AbortSignal },
  );
  console.log(`  Result: ${JSON.stringify(apolloResult, null, 2)}\n`);

  // Step 2: EnrichLayer
  console.log('Step 2: Running enrichAndSaveProfiles...');
  const enrichResult = await enrichAndSaveProfiles.execute(
    { role: ROLE },
    { toolCallId: 'test', messages: [], abortSignal: undefined as unknown as AbortSignal },
  );
  console.log(`  Result: ${JSON.stringify(enrichResult, null, 2)}\n`);

  // Step 3: Web Presence
  console.log('Step 3: Running searchAndSaveWebPresence...');
  const webResult = await searchAndSaveWebPresence.execute(
    { role: ROLE, role_type: 'design' },
    { toolCallId: 'test', messages: [], abortSignal: undefined as unknown as AbortSignal },
  );
  console.log(`  Result: ${JSON.stringify(webResult, null, 2)}\n`);

  // Step 4: Scoring
  console.log('Step 4: Running scoreCandidates...');
  const jd = await getJD();
  if (!jd) {
    console.error('No JD found in Airtable!');
    process.exit(1);
  }
  console.log(`  JD loaded (${jd.length} chars)`);

  const scoreResult = await scoreCandidates.execute(
    { role: ROLE, job_description: jd, role_type: 'design' },
    { toolCallId: 'test', messages: [], abortSignal: undefined as unknown as AbortSignal },
  );
  console.log(`  Result: ${JSON.stringify(scoreResult, null, 2)}\n`);

  console.log('=== Pipeline Test Complete ===');
}

main().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
