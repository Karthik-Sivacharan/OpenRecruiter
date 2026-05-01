/**
 * Dry test: Fetch a resume PDF from Airtable and pass it to Claude Opus
 * via Vercel AI SDK's `generateText()` with `type: 'file'` content part.
 *
 * Usage: npx tsx scripts/test-pdf-to-claude.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

// Load .env.local manually (no dotenv dependency)
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

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID!;

async function main() {
  console.log('1. Fetching test candidate from Airtable...');

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula={Name}='Amarsh Vutukuri'&fields[]=Name&fields[]=Resume&fields[]=Intake Notes`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!res.ok) {
    console.error(`Airtable fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  const record = data.records?.[0];
  if (!record) {
    console.error('No record found for Amarsh Vutukuri');
    process.exit(1);
  }

  console.log(`   Found: ${record.fields.Name}`);

  const resumeAttachments = record.fields.Resume as Array<{ url: string; filename: string }> | undefined;
  if (!resumeAttachments?.length) {
    console.error('No resume attachment found');
    process.exit(1);
  }

  const resumeUrl = resumeAttachments[0].url;
  console.log(`   Resume URL: ${resumeUrl.slice(0, 80)}...`);

  // 2. Download PDF into buffer
  console.log('\n2. Downloading PDF from Airtable...');
  const pdfRes = await fetch(resumeUrl);
  if (!pdfRes.ok) {
    console.error(`PDF download failed: ${pdfRes.status}`);
    process.exit(1);
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  console.log(`   Downloaded: ${pdfBuffer.length} bytes`);

  // 3. Pass PDF to Claude Opus via generateText with file content part
  console.log('\n3. Sending PDF to Claude Opus via AI SDK generateText()...');

  const intakeNotes = (record.fields['Intake Notes'] as string) ?? '';

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'), // Using Sonnet for dry test (cheaper)
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: pdfBuffer,
            mediaType: 'application/pdf' as const,
          },
          {
            type: 'text',
            text: `This is a candidate's resume PDF. Please provide a brief summary (3-4 sentences) of their experience, key skills, and what level of role they'd be suited for.

Additional intake notes from the candidate:
${intakeNotes}`,
          },
        ],
      },
    ],
    maxOutputTokens: 500,
  });

  console.log('\n4. Claude response:');
  console.log('---');
  console.log(result.text);
  console.log('---');
  console.log(`\nTokens used: ${result.usage.inputTokens} input, ${result.usage.outputTokens} output`);
  console.log('\nDry test PASSED - PDF-to-Claude via AI SDK works!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
