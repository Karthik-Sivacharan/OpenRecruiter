import { tool } from 'ai';
import { z } from 'zod';

const AIRTABLE_API_KEY = () => process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = () => process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID = () => process.env.AIRTABLE_TABLE_ID || '';

/** Base URL for all Airtable API calls */
function airtableUrl() {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID()}/${AIRTABLE_TABLE_ID()}`;
}

/** Shared headers for all Airtable API calls */
function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY()}`,
    'Content-Type': 'application/json',
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichedCandidate {
  apollo_id?: string | null;
  name?: string | null;
  email?: string | null;
  email_status?: string | null;
  title?: string | null;
  headline?: string | null;
  seniority?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  twitter_url?: string | null;
  photo_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_likely_to_engage?: boolean | null;
  employment_history?: Array<{
    company?: string | null;
    title?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    current?: boolean;
  }>;
  company?: {
    name?: string | null;
    domain?: string | null;
    industry?: string | null;
    size?: number | null;
    funding?: string | null;
    stage?: string | null;
    tech_stack?: string[];
    description?: string | null;
  };
}

/** Map an enriched candidate object to Airtable field names */
function mapCandidateToFields(
  candidate: EnrichedCandidate,
  role: string,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (candidate.name) fields['Name'] = candidate.name;
  if (candidate.email) fields['Email'] = candidate.email;
  if (candidate.email_status) fields['Email Status'] = candidate.email_status;
  if (candidate.title) fields['Title'] = candidate.title;
  if (candidate.headline) fields['Headline'] = candidate.headline;
  if (candidate.seniority) fields['Seniority'] = candidate.seniority;
  if (candidate.linkedin_url) fields['LinkedIn URL'] = candidate.linkedin_url;
  if (candidate.github_url) fields['GitHub URL'] = candidate.github_url;
  if (candidate.twitter_url) fields['Twitter URL'] = candidate.twitter_url;
  if (candidate.photo_url) fields['Photo URL'] = candidate.photo_url;
  if (candidate.city) fields['City'] = candidate.city;
  if (candidate.state) fields['State'] = candidate.state;
  if (candidate.country) fields['Country'] = candidate.country;
  if (candidate.is_likely_to_engage != null) {
    fields['Likely to Engage'] = String(candidate.is_likely_to_engage);
  }
  if (candidate.employment_history?.length) {
    fields['Employment History'] = JSON.stringify(candidate.employment_history);
  }
  if (candidate.company?.name) fields['Company'] = candidate.company.name;
  if (candidate.company?.domain) fields['Company Domain'] = candidate.company.domain;
  if (candidate.company?.industry) fields['Company Industry'] = candidate.company.industry;
  if (candidate.company?.size != null) fields['Company Size'] = candidate.company.size;
  if (candidate.company?.funding) fields['Company Funding'] = candidate.company.funding;
  if (candidate.company?.stage) fields['Company Stage'] = candidate.company.stage;
  if (candidate.company?.tech_stack?.length) {
    fields['Company Tech Stack'] = candidate.company.tech_stack.join(', ');
  }
  if (candidate.company?.description) fields['Company Description'] = candidate.company.description;
  if (candidate.apollo_id) fields['Apollo ID'] = candidate.apollo_id;

  fields['Role'] = role;
  fields['Pipeline Stage'] = 'Enriched';

  return fields;
}

// ---------------------------------------------------------------------------
// airtableCreateCandidates
// ---------------------------------------------------------------------------

export const airtableCreateCandidates = tool({
  description:
    'Create candidate rows in Airtable after Apollo enrichment. Pass the enriched candidate objects and role name. Handles batching (max 10 per request) automatically.',
  inputSchema: z.object({
    candidates: z
      .array(
        z.object({
          apollo_id: z.string().nullish(),
          name: z.string().nullish(),
          email: z.string().nullish(),
          email_status: z.string().nullish(),
          title: z.string().nullish(),
          headline: z.string().nullish(),
          seniority: z.string().nullish(),
          linkedin_url: z.string().nullish(),
          github_url: z.string().nullish(),
          twitter_url: z.string().nullish(),
          photo_url: z.string().nullish(),
          city: z.string().nullish(),
          state: z.string().nullish(),
          country: z.string().nullish(),
          is_likely_to_engage: z.boolean().nullish(),
          employment_history: z
            .array(
              z.object({
                company: z.string().nullish(),
                title: z.string().nullish(),
                start_date: z.string().nullish(),
                end_date: z.string().nullish(),
                current: z.boolean().optional(),
              }),
            )
            .optional(),
          company: z
            .object({
              name: z.string().nullish(),
              domain: z.string().nullish(),
              industry: z.string().nullish(),
              size: z.number().nullish(),
              funding: z.string().nullish(),
              stage: z.string().nullish(),
              tech_stack: z.array(z.string()).optional(),
              description: z.string().nullish(),
            })
            .optional(),
        }),
      )
      .describe('Array of enriched candidate objects from apolloBulkEnrich output'),
    role: z.string().describe('The role these candidates were sourced for'),
  }),
  execute: async ({ candidates, role }) => {
    const createdIds: string[] = [];
    const errors: string[] = [];

    // Airtable batch create supports max 10 records per request
    for (let i = 0; i < candidates.length; i += 10) {
      const batch = candidates.slice(i, i + 10);
      const records = batch.map((c) => ({ fields: mapCandidateToFields(c, role) }));

      const response = await fetch(airtableUrl(), {
        method: 'POST',
        headers: airtableHeaders(),
        body: JSON.stringify({ records }),
      });

      if (!response.ok) {
        const errText = await response.text();
        errors.push(`Batch ${Math.floor(i / 10) + 1} failed (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      for (const rec of data.records ?? []) {
        createdIds.push(rec.id);
      }
    }

    if (errors.length > 0) {
      return { created: createdIds.length, record_ids: createdIds, errors };
    }
    return { created: createdIds.length, record_ids: createdIds };
  },
});

// ---------------------------------------------------------------------------
// airtableUpdateCandidate
// ---------------------------------------------------------------------------

export const airtableUpdateCandidate = tool({
  description:
    'Update an existing candidate row in Airtable with new data. Used after each enrichment step (EnrichLayer, GitHub, Nia analysis, scoring, draft email, etc.).',
  inputSchema: z.object({
    record_id: z.string().describe('Airtable record ID (e.g. "recXXX")'),
    fields: z
      .record(z.string(), z.unknown())
      .describe(
        'Partial field map to update. Use exact Airtable field names like "Score", "Pipeline Stage", "Nia Analysis", etc.',
      ),
  }),
  execute: async ({ record_id, fields }) => {
    const response = await fetch(airtableUrl(), {
      method: 'PATCH',
      headers: airtableHeaders(),
      body: JSON.stringify({
        records: [{ id: record_id, fields }],
      }),
    });

    if (!response.ok) {
      return { error: `Airtable update error ${response.status}: ${await response.text()}` };
    }

    const data = await response.json();
    const updated = data.records?.[0];
    return { record_id: updated?.id, fields: updated?.fields };
  },
});

// ---------------------------------------------------------------------------
// airtableGetCandidates
// ---------------------------------------------------------------------------

export const airtableGetCandidates = tool({
  description:
    'Get all candidates from Airtable, optionally filtered by role name. Returns full row data for each candidate.',
  inputSchema: z.object({
    role: z
      .string()
      .optional()
      .describe('Filter by role name. If omitted, returns all candidates.'),
  }),
  execute: async ({ role }) => {
    const params = new URLSearchParams();
    if (role) {
      params.set('filterByFormula', `{Role}='${role}'`);
    }

    const url = `${airtableUrl()}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: airtableHeaders(),
    });

    if (!response.ok) {
      return { error: `Airtable get error ${response.status}: ${await response.text()}`, candidates: [] };
    }

    const data = await response.json();
    const candidates = (data.records ?? []).map(
      (rec: { id: string; fields: Record<string, unknown> }) => ({
        record_id: rec.id,
        ...rec.fields,
      }),
    );

    return { total: candidates.length, candidates };
  },
});
