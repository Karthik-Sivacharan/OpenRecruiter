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
// Email slug extraction (fallback when LinkedIn URL is missing)
// ---------------------------------------------------------------------------

function extractEmailSlug(email: string): string {
  // Lowercase, replace @ and . with hyphens (e.g. "gmihci-gmail-com")
  return email.toLowerCase().replace(/[@.]/g, '-');
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
  addCtx('Intake Notes', 'Intake Notes');

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

const TALENT_POOL_TAG = 'talent-pool';

interface SyncedCandidate {
  name: string;
  customId: string;
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

    // 2. Partition into syncable vs skipped
    // customId fallback chain:
    //   1. candidate-{linkedin-slug} (preferred - globally unique)
    //   2. candidate-email-{email-slug} (fallback when no LinkedIn URL)
    //   3. Skip with warning (neither LinkedIn nor email available)
    const toSync: Array<{ record: AirtableRecord; slug: string; customId: string }> = [];
    let skipped = 0;

    for (const record of records) {
      const linkedinUrl = record.fields['LinkedIn URL'];
      const email = record.fields['Email'];
      const hasLinkedin = linkedinUrl && typeof linkedinUrl === 'string' && linkedinUrl.trim();
      const hasEmail = email && typeof email === 'string' && email.trim();

      if (hasLinkedin) {
        const slug = extractLinkedInSlug(linkedinUrl);
        if (slug) {
          const customId = `candidate-${slug}`.slice(0, 100);
          toSync.push({ record, slug, customId });
          continue;
        }
      }

      if (hasEmail) {
        const emailSlug = extractEmailSlug(email);
        const customId = `candidate-email-${emailSlug}`.slice(0, 100);
        toSync.push({ record, slug: emailSlug, customId });
        continue;
      }

      const name = record.fields['Name'] ?? 'Unknown';
      console.warn(`Skipping candidate "${name}" (record ${record.id}) - no LinkedIn URL or Email`);
      skipped++;
    }

    if (toSync.length === 0) {
      return { synced: 0, skipped, candidates: [], message: 'No candidates with LinkedIn URLs or emails to sync.' };
    }

    // 3. Sync to Supermemory in batches of 5
    const syncedCandidates: SyncedCandidate[] = [];
    const syncedRecordIds: string[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
      const batch = toSync.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async ({ record, customId }) => {
          const profileText = buildProfileContent(record.fields);
          const linkedinUrl = typeof record.fields['LinkedIn URL'] === 'string'
            ? record.fields['LinkedIn URL']
            : '';
          const metadata = buildMetadata(record.fields, linkedinUrl, record.id);

          await supermemoryClient.add({
            content: profileText,
            containerTag: TALENT_POOL_TAG,
            customId,
            metadata,
            entityContext: ENTITY_CONTEXT,
          });

          return {
            name: (record.fields['Name'] as string) ?? 'Unknown',
            customId,
            recordId: record.id,
          };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          syncedCandidates.push({
            name: result.value.name,
            customId: result.value.customId,
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

// ---------------------------------------------------------------------------
// Name/title extraction from Supermemory document title
// ---------------------------------------------------------------------------

function parseDocTitle(docTitle: string): { name: string; title: string } {
  const cleaned = docTitle.replace(/^Candidate Profile:\s*/i, '');
  const commaIdx = cleaned.indexOf(',');
  if (commaIdx === -1) return { name: cleaned.trim(), title: '' };
  return {
    name: cleaned.slice(0, commaIdx).trim(),
    title: cleaned.slice(commaIdx + 1).trim(),
  };
}

// ---------------------------------------------------------------------------
// Search result types
// ---------------------------------------------------------------------------

interface TalentPoolResult {
  name: string;
  title: string;
  role: string;
  hiring_company: string;
  fit_score: string;
  stage: string;
  score: number;
  airtable_record_id: string;
  linkedin_url: string;
  matching_memories: string[];
}

interface TalentPoolSearchResponse {
  results: TalentPoolResult[];
  total: number;
  timing_ms: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Group search results by candidate linkedin_url
// ---------------------------------------------------------------------------

interface MemoryHit {
  memory?: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  documents?: Array<{ title?: string; metadata?: Record<string, unknown> | null }>;
}

function groupMemoriesByCandidate(
  memories: MemoryHit[],
): Map<string, TalentPoolResult> {
  const grouped = new Map<string, TalentPoolResult>();

  for (const hit of memories) {
    const meta = hit.metadata ?? {};
    const linkedinUrl = typeof meta.linkedin_url === 'string' ? meta.linkedin_url : '';
    const key = linkedinUrl || `unknown-${grouped.size}`;
    const similarity = hit.similarity;
    const snippet = typeof hit.memory === 'string' ? hit.memory : '';

    const existing = grouped.get(key);

    if (existing) {
      if (similarity > existing.score) {
        existing.score = similarity;
      }
      if (existing.matching_memories.length < 3 && snippet) {
        existing.matching_memories.push(snippet);
      }
    } else {
      const docTitleStr = hit.documents?.[0]?.title ?? '';
      const parsed = parseDocTitle(docTitleStr);

      const metaStr = (field: string): string => {
        const val = meta[field];
        return typeof val === 'string' ? val : '';
      };

      grouped.set(key, {
        name: parsed.name || metaStr('name') || 'Unknown',
        title: parsed.title,
        role: metaStr('role'),
        hiring_company: metaStr('hiring_company'),
        fit_score: metaStr('fit_score'),
        stage: metaStr('stage'),
        score: similarity,
        airtable_record_id: metaStr('airtable_record_id'),
        linkedin_url: linkedinUrl,
        matching_memories: snippet ? [snippet] : [],
      });
    }
  }

  return grouped;
}

// ---------------------------------------------------------------------------
// searchTalentPool - query the talent pool for cross-role matching
// ---------------------------------------------------------------------------

export const searchTalentPool = tool({
  description:
    'Search the talent pool for candidates matching a job description or query. Returns past candidates who could be relevant for a new role. Call this during intake after fetching the JD, or when the recruiter asks about their candidate pool.',
  inputSchema: z.object({
    query: z.string().describe('Job description summary or natural language query (e.g. "backend engineer with Go and distributed systems experience")'),
  }),
  execute: async ({ query }): Promise<TalentPoolSearchResponse> => {
    const startMs = Date.now();

    try {
      const client = new Supermemory();

      const results = await client.search.memories({
        q: query,
        containerTag: TALENT_POOL_TAG,
        threshold: 0.3,
        limit: 20,
        include: { documents: true },
      });

      const hits = results.results ?? [];

      if (hits.length === 0) {
        return {
          results: [],
          total: 0,
          timing_ms: Date.now() - startMs,
          message: 'No matching candidates found in your talent pool.',
        };
      }

      const grouped = groupMemoriesByCandidate(hits);
      const sorted = Array.from(grouped.values()).sort((a, b) => b.score - a.score);

      return {
        results: sorted,
        total: sorted.length,
        timing_ms: Date.now() - startMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Supermemory search error: ${message}`);
      return {
        results: [],
        total: 0,
        timing_ms: Date.now() - startMs,
        message: `Talent pool search failed: ${message}`,
      };
    }
  },
});
