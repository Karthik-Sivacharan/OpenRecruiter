import { tool } from 'ai';
import { z } from 'zod';
import { Supermemory } from 'supermemory';

// ---------------------------------------------------------------------------
// Airtable helpers (same pattern as scoring.ts)
// ---------------------------------------------------------------------------

const AIRTABLE_API_KEY = () => process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = () => process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID = () => process.env.AIRTABLE_TABLE_ID || '';

function airtableUrl(): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID()}/${AIRTABLE_TABLE_ID()}`;
}

function airtableHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY()}`,
    'Content-Type': 'application/json',
  };
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetchByRole(role: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ filterByFormula: `{Role}='${role}'` });
    if (offset) params.set('offset', offset);
    const response = await fetch(`${airtableUrl()}?${params.toString()}`, {
      headers: airtableHeaders(),
    });
    if (!response.ok) {
      console.error(`Airtable fetch error: ${response.status}`);
      break;
    }
    const data = await response.json();
    for (const rec of data.records ?? []) {
      records.push({ id: rec.id, fields: rec.fields ?? {} });
    }
    offset = data.offset;
  } while (offset);

  return records;
}

async function airtableBatchUpdateSyncedAt(recordIds: string[], timestamp: string): Promise<void> {
  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const records = batch.map((id) => ({
      id,
      fields: { 'Supermemory Synced At': timestamp },
    }));

    const response = await fetch(airtableUrl(), {
      method: 'PATCH',
      headers: airtableHeaders(),
      body: JSON.stringify({ typecast: true, records }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Airtable batch update error: ${response.status}: ${text}`);
    }
  }
}

// ---------------------------------------------------------------------------
// LinkedIn slug extraction
// ---------------------------------------------------------------------------

function extractLinkedInSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^\/?#]+)/);
  if (!match) return null;
  // Replace dots with hyphens to satisfy containerTag charset
  return match[1].replace(/\./g, '-');
}

// ---------------------------------------------------------------------------
// Profile content builder
// ---------------------------------------------------------------------------

function buildProfileContent(fields: Record<string, unknown>): string {
  const lines: string[] = [];

  const add = (label: string, key: string) => {
    const val = fields[key];
    if (val && typeof val === 'string' && val.trim()) {
      lines.push(`${label}: ${val}`);
    } else if (val && typeof val === 'number') {
      lines.push(`${label}: ${val}`);
    }
  };

  // Candidate profile
  add('Name', 'Name');
  add('Title', 'Title');
  add('Company', 'Current Company');
  add('Location', 'City');
  add('Headline', 'Headline');
  add('Skills', 'Skills');
  add('Education', 'Education');
  add('Employment History', 'Employment History');
  add('EnrichLayer Experiences', 'EnrichLayer Experiences');
  add('Certifications', 'Certifications');
  add('Languages', 'Languages');
  add('Summary', 'Summary');
  add('Current Company Industry', 'Current Company Industry');
  add('Current Company Size', 'Current Company Size');

  // Recruiting context
  const contextLines: string[] = [];
  const addCtx = (label: string, key: string) => {
    const val = fields[key];
    if (val && typeof val === 'string' && val.trim()) {
      contextLines.push(`${label}: ${val}`);
    } else if (val && typeof val === 'number') {
      contextLines.push(`${label}: ${val}/10`);
    }
  };

  addCtx('Role', 'Role');
  addCtx('Hiring Company', 'Hiring Company');

  const fitScore = fields['Fit Score'];
  if (fitScore && typeof fitScore === 'number') {
    contextLines.push(`Fit Score: ${fitScore}/10`);
  }

  addCtx('Fit Rationale', 'Fit Rationale');
  addCtx('Pipeline Stage', 'Pipeline Stage');
  addCtx('Recruiter Notes', 'Recruiter Notes');

  if (contextLines.length > 0) {
    lines.push('');
    lines.push('--- Recruiting Context ---');
    lines.push(...contextLines);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Metadata builder
// ---------------------------------------------------------------------------

function buildMetadata(
  fields: Record<string, unknown>,
  linkedinUrl: string,
  recordId: string,
): Record<string, string | number | boolean | string[]> {
  const meta: Record<string, string | number | boolean | string[]> = {
    type: 'candidate_profile',
    airtable_record_id: recordId,
    linkedin_url: linkedinUrl,
  };

  const addStr = (metaKey: string, fieldKey: string) => {
    const val = fields[fieldKey];
    if (val && typeof val === 'string' && val.trim()) {
      meta[metaKey] = val;
    }
  };

  const addNum = (metaKey: string, fieldKey: string) => {
    const val = fields[fieldKey];
    if (val && typeof val === 'number') {
      meta[metaKey] = String(val);
    }
  };

  addStr('role', 'Role');
  addStr('hiring_company', 'Hiring Company');
  addNum('fit_score', 'Fit Score');
  addStr('stage', 'Pipeline Stage');

  return meta;
}

// ---------------------------------------------------------------------------
// Entity context for Supermemory extraction
// ---------------------------------------------------------------------------

const ENTITY_CONTEXT =
  'This is a recruiting candidate profile. Extract: skills and technologies, job history with companies and dates, education, fit assessment for the role, recruiter observations about preferences and availability, outreach status and candidate responses.';

// ---------------------------------------------------------------------------
// syncToTalentPool - batch tool
// ---------------------------------------------------------------------------

interface SyncedCandidate {
  name: string;
  containerTag: string;
}

export const syncToTalentPool = tool({
  description:
    'Sync scored candidates to the Supermemory talent pool for future cross-role matching. Self-serving: fetches candidates from Airtable by role name, builds profiles, and syncs to Supermemory. Call this after outreach drafts are created.',
  inputSchema: z.object({
    role: z.string().describe('The role name to sync candidates for (e.g. "Senior ML Engineer")'),
  }),
  execute: async ({ role }) => {
    const supermemoryClient = new Supermemory();

    // 1. Fetch all candidates for this role
    const records = await airtableFetchByRole(role);

    if (records.length === 0) {
      return { synced: 0, skipped: 0, candidates: [], message: 'No candidates found for this role.' };
    }

    // 2. Partition into syncable (has LinkedIn URL) vs skipped
    const toSync: Array<{ record: AirtableRecord; slug: string; containerTag: string }> = [];
    let skipped = 0;

    for (const record of records) {
      const linkedinUrl = record.fields['LinkedIn URL'];
      if (!linkedinUrl || typeof linkedinUrl !== 'string' || !linkedinUrl.trim()) {
        skipped++;
        continue;
      }

      const slug = extractLinkedInSlug(linkedinUrl);
      if (!slug) {
        skipped++;
        continue;
      }

      const containerTag = `candidate-${slug}`.slice(0, 100);
      toSync.push({ record, slug, containerTag });
    }

    if (toSync.length === 0) {
      return { synced: 0, skipped, candidates: [], message: 'No candidates with LinkedIn URLs to sync.' };
    }

    // 3. Sync to Supermemory in batches of 5
    const syncedCandidates: SyncedCandidate[] = [];
    const syncedRecordIds: string[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
      const batch = toSync.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async ({ record, containerTag }) => {
          const profileText = buildProfileContent(record.fields);
          const linkedinUrl = record.fields['LinkedIn URL'] as string;
          const metadata = buildMetadata(record.fields, linkedinUrl, record.id);

          await supermemoryClient.add({
            content: profileText,
            containerTag,
            metadata,
            entityContext: ENTITY_CONTEXT,
          });

          return {
            name: (record.fields['Name'] as string) ?? 'Unknown',
            containerTag,
            recordId: record.id,
          };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          syncedCandidates.push({
            name: result.value.name,
            containerTag: result.value.containerTag,
          });
          syncedRecordIds.push(result.value.recordId);
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.error(`Supermemory add error: ${reason}`);
          skipped++;
        }
      }
    }

    // 4. Batch-update Airtable with sync timestamp
    if (syncedRecordIds.length > 0) {
      const timestamp = new Date().toISOString();
      await airtableBatchUpdateSyncedAt(syncedRecordIds, timestamp);
    }

    return {
      synced: syncedCandidates.length,
      skipped,
      candidates: syncedCandidates,
    };
  },
});
