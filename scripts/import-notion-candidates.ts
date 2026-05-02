/**
 * One-time import script: Notion CSV -> Airtable
 * Reads the Ninety Head of Design candidates CSV export from Notion,
 * maps fields to the Airtable schema, builds Intake Notes, and pushes
 * candidates with resume attachments.
 *
 * Usage: npx tsx scripts/import-notion-candidates.ts
 *
 * Options:
 *   --dry-run    Print mapped records without pushing to Airtable
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'csv-parse/sync';

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

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
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

// ---------------------------------------------------------------------------
// Config -- update these for each import run
// ---------------------------------------------------------------------------

const CSV_PATH = resolve(
  process.env.HOME!,
  'Downloads/Ninety-Head-of-Design-Candidates',
  'Ninety - Head Of Design Candidates 352dd4da4635808eb9becbf7d9f47a19_all.csv',
);

const HIRING_CONTEXT = {
  Role: 'Head of Design - Ninety',
  // These will be filled in when the JD is provided:
  'Hiring Company': '',
  'Hiring Role': '',
  'Hiring JD URL': '',
  'Hiring Job Description': '',
};

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// CSV column names (from Notion export)
// ---------------------------------------------------------------------------

const COL = {
  name: 'Name',
  ai_tools: 'Any AI tools/projects you\'ve been playing with?',
  bio: 'Anything you\'d like to tell us about you? We\'d love to get to know you. What kind of opportunities are you looking for? Which ones you want to avoid? What gets you excited?',
  work_auth: 'Are you legally authorized to work in the United States?',
  company: 'Current Company',
  title: 'Current Title',
  email: 'Email',
  linkedin: 'LinkedIn Profile',
  location: 'Location',
  phone: 'Phone',
  portfolio: 'Portfolio',
  portfolio_password: 'Portfolio Password',
  referred_by: 'Referred By',
  resume: 'Resume Attachments',
  roles_interested: 'Roles Interested In? ',
  looking_for: 'What are you looking for?',
  salary: 'What salary range are you looking for?',
  work_pref: 'Work Preference',
  years_exp: 'Years of Experience ',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(val: string | undefined): string {
  return (val ?? '').trim();
}

function normalizeLinkedIn(url: string): string {
  let cleaned = url.trim();
  if (!cleaned) return '';
  if (!cleaned.startsWith('http')) cleaned = `https://${cleaned}`;
  return cleaned;
}

function normalizeUrl(url: string): string {
  let cleaned = url.trim();
  if (!cleaned) return '';
  if (!cleaned.startsWith('http')) cleaned = `https://${cleaned}`;
  return cleaned;
}

interface AirtableRecord {
  fields: Record<string, unknown>;
}

function buildIntakeNotes(row: Record<string, string>): string {
  const parts: string[] = [];

  const add = (label: string, val: string) => {
    const cleaned = clean(val);
    if (cleaned) parts.push(`${label}: ${cleaned}`);
  };

  add('Years of Experience', row[COL.years_exp]);
  add('Work Authorization (US)', row[COL.work_auth]);
  add('Salary Range', row[COL.salary]);
  add('Work Preference', row[COL.work_pref]);
  add('Employment Type', row[COL.looking_for]);
  add('Roles Interested', row[COL.roles_interested]);
  add('AI Tools', row[COL.ai_tools]);
  add('Referred By', row[COL.referred_by]);

  const bio = clean(row[COL.bio]);
  if (bio) {
    parts.push('');
    parts.push(`Bio: ${bio}`);
  }

  return parts.join('\n');
}

function mapRow(row: Record<string, string>): AirtableRecord | null {
  const name = clean(row[COL.name]);
  if (!name) return null;

  const fields: Record<string, unknown> = {};

  // Direct mappings
  fields['Name'] = name;
  const email = clean(row[COL.email]);
  if (email) fields['Email'] = email;
  const title = clean(row[COL.title]);
  if (title) fields['Title'] = title;
  const company = clean(row[COL.company]);
  if (company) fields['Current Company'] = company;

  const linkedin = normalizeLinkedIn(row[COL.linkedin]);
  if (linkedin) fields['LinkedIn URL'] = linkedin;

  const portfolio = normalizeUrl(row[COL.portfolio]);
  if (portfolio) fields['Personal Website'] = portfolio;

  const location = clean(row[COL.location]);
  if (location) fields['City'] = location;

  const phone = clean(row[COL.phone]);
  if (phone) fields['Phone'] = phone;

  const portfolioPassword = clean(row[COL.portfolio_password]);
  if (portfolioPassword) fields['Personal Website Password'] = portfolioPassword;

  // Resume attachment
  const resumeUrl = clean(row[COL.resume]);
  if (resumeUrl) {
    fields['Resume'] = [{ url: resumeUrl, filename: `${name.replace(/\s+/g, '-')}-Resume.pdf` }];
  }

  // Intake Notes (combined form data)
  const intakeNotes = buildIntakeNotes(row);
  if (intakeNotes) fields['Intake Notes'] = intakeNotes;

  // Hiring context
  fields['Role'] = HIRING_CONTEXT.Role;
  if (HIRING_CONTEXT['Hiring Company']) fields['Hiring Company'] = HIRING_CONTEXT['Hiring Company'];
  if (HIRING_CONTEXT['Hiring Role']) fields['Hiring Role'] = HIRING_CONTEXT['Hiring Role'];
  if (HIRING_CONTEXT['Hiring JD URL']) fields['Hiring JD URL'] = HIRING_CONTEXT['Hiring JD URL'];
  if (HIRING_CONTEXT['Hiring Job Description']) fields['Hiring Job Description'] = HIRING_CONTEXT['Hiring Job Description'];

  // Pipeline stage
  fields['Pipeline Stage'] = 'Imported';

  return { fields };
}

// ---------------------------------------------------------------------------
// Airtable API
// ---------------------------------------------------------------------------

/**
 * Normalize a LinkedIn URL for dedup comparison:
 * - lowercase
 * - strip trailing slashes
 * - remove query params and fragments
 * e.g. "https://LinkedIn.com/in/JohnDoe/?ref=foo" -> "https://linkedin.com/in/johndoe"
 */
function normalizeLinkedInForDedup(url: string): string {
  let cleaned = url.trim().toLowerCase();
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    // Reconstruct without query params or hash
    cleaned = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    // If URL parsing fails, just use the lowercased string
  }
  // Remove trailing slashes
  return cleaned.replace(/\/+$/, '');
}

/**
 * Normalize an email for dedup comparison: lowercase + trim.
 */
function normalizeEmailForDedup(email: string): string {
  return email.trim().toLowerCase();
}

interface ExistingCandidates {
  linkedinUrls: Set<string>;
  emails: Set<string>;
}

/**
 * Fetch all existing candidates from Airtable and collect their
 * LinkedIn URLs and emails into Sets for fast duplicate lookup.
 * Paginates through all records (not filtered by role, so dedup is global).
 */
async function fetchExistingCandidates(): Promise<ExistingCandidates> {
  const linkedinUrls = new Set<string>();
  const emails = new Set<string>();
  let offset: string | undefined;

  do {
    // Request both LinkedIn URL and Email fields for dedup matching
    const params = new URLSearchParams();
    params.append('fields[]', 'LinkedIn URL');
    params.append('fields[]', 'Email');
    if (offset) params.set('offset', offset);

    const res = await fetch(`${AIRTABLE_URL}?${params}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) {
      console.error(`   Warning: failed to fetch existing candidates (${res.status})`);
      break;
    }
    const data = await res.json() as {
      records?: Array<{ fields?: { 'LinkedIn URL'?: string; Email?: string } }>;
      offset?: string;
    };
    for (const rec of data.records ?? []) {
      const linkedinUrl = rec.fields?.['LinkedIn URL'];
      if (typeof linkedinUrl === 'string' && linkedinUrl.trim()) {
        linkedinUrls.add(normalizeLinkedInForDedup(linkedinUrl));
      }
      const email = rec.fields?.Email;
      if (typeof email === 'string' && email.trim()) {
        emails.add(normalizeEmailForDedup(email));
      }
    }
    offset = data.offset;
  } while (offset);

  return { linkedinUrls, emails };
}

async function pushBatch(records: AirtableRecord[]): Promise<number> {
  const res = await fetch(AIRTABLE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records, typecast: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  Airtable error: ${res.status} ${text}`);
    return 0;
  }

  const data = await res.json();
  return data.records?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Notion -> Airtable Import ===\n');

  // 1. Read and parse CSV
  console.log(`1. Reading CSV: ${CSV_PATH}`);
  const rawCsv = readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
  const rows: Record<string, string>[] = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`   Parsed ${rows.length} rows`);

  // 2. Map rows to Airtable records
  const records: AirtableRecord[] = [];
  const skippedEmpty: string[] = [];

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped) {
      skippedEmpty.push('(empty name)');
      continue;
    }
    records.push(mapped);
  }

  console.log(`   Mapped ${records.length} candidates (${skippedEmpty.length} skipped - empty name)`);

  // 3. Check for duplicates by LinkedIn URL or email
  console.log('\n2. Checking for existing candidates in Airtable...');
  const existing = await fetchExistingCandidates();
  console.log(`   Found ${existing.linkedinUrls.size} LinkedIn URLs and ${existing.emails.size} emails in Airtable`);

  let skippedDuplicates = 0;
  const newRecords = records.filter((r) => {
    const name = r.fields['Name'] as string;

    // Check LinkedIn URL match (primary dedup key)
    const linkedinRaw = r.fields['LinkedIn URL'] as string | undefined;
    if (linkedinRaw) {
      const normalizedLinkedin = normalizeLinkedInForDedup(linkedinRaw);
      if (normalizedLinkedin && existing.linkedinUrls.has(normalizedLinkedin)) {
        console.log(`   Skipping ${name} - already exists (matched on LinkedIn URL)`);
        skippedDuplicates++;
        return false;
      }
    }

    // Check email match (secondary dedup key)
    const emailRaw = r.fields['Email'] as string | undefined;
    if (emailRaw) {
      const normalizedEmail = normalizeEmailForDedup(emailRaw);
      if (normalizedEmail && existing.emails.has(normalizedEmail)) {
        console.log(`   Skipping ${name} - already exists (matched on email)`);
        skippedDuplicates++;
        return false;
      }
    }

    return true;
  });

  console.log(`   ${newRecords.length} new candidates to import, ${skippedDuplicates} skipped (already in Airtable)`);

  if (newRecords.length === 0) {
    console.log('\nNothing to import. Done.');
    return;
  }

  // 4. Dry run or push
  if (DRY_RUN) {
    console.log('\n3. DRY RUN - would push these candidates:\n');
    for (const rec of newRecords) {
      const f = rec.fields;
      console.log(`   ${f['Name']} | ${f['Title'] ?? 'N/A'} @ ${f['Current Company'] ?? 'N/A'} | ${f['Email'] ?? 'no email'}`);
      const resume = f['Resume'] as Array<{ url: string }> | undefined;
      console.log(`     LinkedIn: ${f['LinkedIn URL'] ?? 'none'}`);
      console.log(`     Resume: ${resume?.[0]?.url ? 'yes' : 'no'}`);
      console.log(`     Intake Notes: ${((f['Intake Notes'] as string) ?? '').split('\n').length} lines`);
      console.log('');
    }
    console.log(`Total: ${newRecords.length} candidates (dry run, nothing pushed)`);
    return;
  }

  console.log('\n3. Pushing to Airtable in batches of 10...');
  let totalPushed = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const batch = newRecords.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(newRecords.length / BATCH_SIZE);

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} records)... `);
    const pushed = await pushBatch(batch);
    totalPushed += pushed;
    console.log(`done (${pushed} created)`);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < newRecords.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log(`\nImport complete: ${totalPushed} new candidates imported, ${skippedDuplicates} skipped (already in Airtable)`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
