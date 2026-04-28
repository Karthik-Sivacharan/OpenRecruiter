/**
 * Migration script: reformat existing Airtable rows to recruiter-readable text.
 *
 * Run with: npx tsx scripts/migrate-airtable-format.ts
 *
 * What it does:
 * - Employment History: JSON → "Title @ Company (Mon Year–Mon Year)" per line
 * - All Emails: JSON → "email (type, status) [source]" per line
 * - Photo URL → Photo (attachment) — copies URL into attachment field
 * - Empty "[]" → clears the field
 */

import 'dotenv/config';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || '';
const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatEmploymentHistory(raw: string): string | null {
  try {
    const history = JSON.parse(raw);
    if (!Array.isArray(history) || history.length === 0) return null;
    return history
      .map((eh: Record<string, unknown>) => {
        const start = formatDate(eh.start_date as string);
        const end = eh.current ? 'present' : formatDate(eh.end_date as string);
        const dateRange = start || end ? ` (${start}–${end})` : '';
        return `${eh.title ?? eh.organization_name ?? 'Unknown Role'} @ ${eh.company ?? eh.organization_name ?? 'Unknown'}${dateRange}`;
      })
      .join('\n');
  } catch {
    return null; // not JSON, already formatted or empty
  }
}

function formatAllEmails(raw: string): string | null {
  try {
    const emails = JSON.parse(raw);
    if (!Array.isArray(emails) || emails.length === 0) return null;
    return emails
      .map((e: Record<string, unknown>) => {
        const status = e.status || e.validation || '';
        const conf = e.confidence != null ? `, ${Math.round(Number(e.confidence) * 100)}% confidence` : '';
        const source = e.source ? ` [${e.source}]` : '';
        const type = e.type || (String(e.validation) === 'personal' ? 'personal' : 'work');
        return `${e.email} (${type}${status ? ', ' + status : ''}${conf})${source}`;
      })
      .join('\n');
  } catch {
    return null;
  }
}

async function getAllRecords(): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = offset ? `${BASE_URL}?offset=${offset}` : BASE_URL;
    const res = await fetch(url, { headers });
    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);

  return records;
}

async function updateRecord(id: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(BASE_URL, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ records: [{ id, fields }] }),
  });
  if (!res.ok) {
    console.error(`Failed to update ${id}: ${res.status} ${await res.text()}`);
  }
}

async function migrate() {
  console.log('Fetching all records...');
  const records = await getAllRecords();
  console.log(`Found ${records.length} records. Migrating...`);

  let updated = 0;

  for (const record of records) {
    const fields: Record<string, unknown> = {};
    let needsUpdate = false;

    // Employment History: JSON → readable text
    const empHistory = record.fields['Employment History'] as string | undefined;
    if (empHistory && empHistory.startsWith('[')) {
      const formatted = formatEmploymentHistory(empHistory);
      if (formatted) {
        fields['Employment History'] = formatted;
        needsUpdate = true;
      }
    }

    // All Emails: JSON → readable text
    const allEmails = record.fields['All Emails'] as string | undefined;
    if (allEmails && allEmails.startsWith('[')) {
      const formatted = formatAllEmails(allEmails);
      if (formatted) {
        fields['All Emails'] = formatted;
        needsUpdate = true;
      }
    }

    // Photo URL → Photo (attachment)
    const photoUrl = record.fields['Photo URL'] as string | undefined;
    if (photoUrl && !record.fields['Photo']) {
      fields['Photo'] = [{ url: photoUrl }];
      needsUpdate = true;
    }

    // Clear empty arrays "[]"
    for (const field of ['Certifications', 'Education', 'Recommendations']) {
      const val = record.fields[field] as string | undefined;
      if (val === '[]') {
        fields[field] = null;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      console.log(`  Updating ${record.fields['Name']}...`);
      await updateRecord(record.id, fields);
      updated++;
      // Rate limit: 5 req/sec for Airtable
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log(`Done. Updated ${updated}/${records.length} records.`);
}

migrate().catch(console.error);
