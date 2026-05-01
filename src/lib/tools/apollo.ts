import { tool } from 'ai';
import { z } from 'zod';

const APOLLO_API_KEY = () => process.env.APOLLO_API_KEY || '';
const APOLLO_BASE = 'https://api.apollo.io/api/v1';

/** Shared headers for all Apollo API calls */
function apolloHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': APOLLO_API_KEY(),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApolloSearchPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  headline?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  email?: string;
  organization?: { name?: string; primary_domain?: string };
}

interface ApolloEnrichedPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  headline?: string;
  email?: string;
  email_status?: string;
  extrapolated_email_confidence?: number;
  personal_emails?: string[];
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  github_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  photo_url?: string;
  seniority?: string;
  departments?: string[];
  functions?: string[];
  is_likely_to_engage?: boolean;
  employment_history?: Array<{
    organization_name?: string;
    title?: string;
    start_date?: string;
    end_date?: string;
    current?: boolean;
  }>;
  organization?: {
    name?: string;
    primary_domain?: string;
    website_url?: string;
    industry?: string;
    estimated_num_employees?: number;
    total_funding_printed?: string;
    latest_funding_stage?: string;
    technology_names?: string[];
    short_description?: string;
  };
}

// ---------------------------------------------------------------------------
// Internal: run a single Apollo search
// ---------------------------------------------------------------------------

interface ApolloSearchParams {
  person_titles?: string[];
  person_locations?: string[];
  person_seniorities?: string[];
  q_keywords?: string;
  currently_using_any_of_technology_uids?: string[];
  currently_using_all_of_technology_uids?: string[];
  organization_num_employees_ranges?: string[];
  q_organization_keyword_tags?: string[];
  contact_email_status?: string[];
  per_page?: number;
  page?: number;
}

interface ApolloSearchResult {
  name: string;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  apollo_id: string | null;
}

async function runApolloSearch(
  params: ApolloSearchParams,
): Promise<{ total: number; people: ApolloSearchResult[]; error?: string }> {
  const response = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: apolloHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    return { error: `Apollo search error ${response.status}: ${await response.text()}`, total: 0, people: [] };
  }

  const data = await response.json();

  return {
    total: data.pagination?.total_entries ?? 0,
    people: ((data.people ?? []) as ApolloSearchPerson[]).map((p) => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(' '),
      title: p.title ?? null,
      company: p.organization?.name ?? null,
      location: p.city ? [p.city, p.state].filter(Boolean).join(', ') : p.country ?? null,
      linkedin_url: p.linkedin_url ?? null,
      email: p.email ?? null,
      apollo_id: p.id ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// apolloMultiSearch - run multiple search passes in parallel + deduplicate
// ---------------------------------------------------------------------------

const SearchPassSchema = z.object({
  person_titles: z
    .array(z.string())
    .describe('Job titles for this pass, e.g. ["ml engineer", "machine learning engineer"]'),
  person_locations: z.array(z.string()).optional().describe('Locations'),
  person_seniorities: z.array(z.string()).optional().describe('Seniority levels'),
  q_keywords: z.string().optional().describe('Free-text keyword search'),
  currently_using_any_of_technology_uids: z.array(z.string()).optional().describe('Tech stack UIDs (any)'),
  currently_using_all_of_technology_uids: z.array(z.string()).optional().describe('Tech stack UIDs (all)'),
  organization_num_employees_ranges: z.array(z.string()).optional().describe('Company size ranges'),
  q_organization_keyword_tags: z.array(z.string()).optional().describe('Industry tags'),
  contact_email_status: z.array(z.string()).optional().describe('Email status filter'),
  per_page: z.number().optional().default(25).describe('Results per page per pass (default 25)'),
});

export const apolloMultiSearch = tool({
  description:
    'Run 2-3 search passes in parallel with different title/keyword variations, then deduplicate results by name+company. Returns one merged, deduplicated candidate list. Call this ONCE instead of multiple apolloSearchPeople calls.',
  inputSchema: z.object({
    passes: z
      .array(SearchPassSchema)
      .min(1)
      .max(5)
      .describe('Array of search configurations - each pass uses different title variations or filters'),
  }),
  execute: async ({ passes }) => {
    // Run all search passes in parallel
    const passResults = await Promise.allSettled(
      passes.map((pass) => runApolloSearch(pass)),
    );

    // Collect all results
    const allPeople: ApolloSearchResult[] = [];
    const passStats: Array<{ total: number; returned: number; error?: string }> = [];

    for (const pr of passResults) {
      if (pr.status === 'fulfilled') {
        allPeople.push(...pr.value.people);
        passStats.push({ total: pr.value.total, returned: pr.value.people.length, error: pr.value.error });
      } else {
        passStats.push({
          total: 0,
          returned: 0,
          error: pr.reason instanceof Error ? pr.reason.message : String(pr.reason),
        });
      }
    }

    // Deduplicate by apollo_id, then by name+company
    const seen = new Set<string>();
    const deduplicated: ApolloSearchResult[] = [];

    for (const person of allPeople) {
      // Primary: deduplicate by apollo_id
      if (person.apollo_id && seen.has(person.apollo_id)) continue;
      if (person.apollo_id) seen.add(person.apollo_id);

      // Secondary: deduplicate by name+company
      const key = `${(person.name ?? '').toLowerCase()}|${(person.company ?? '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      deduplicated.push(person);
    }

    return {
      passes: passStats,
      total_before_dedup: allPeople.length,
      total: deduplicated.length,
      people: deduplicated,
    };
  },
});

// ---------------------------------------------------------------------------
// apolloBulkEnrich
// ---------------------------------------------------------------------------

export const apolloBulkEnrich = tool({
  description:
    'Enrich candidates to get emails, employment history, company details, and social URLs. Pass apollo_ids from search results. Batches of up to 10. Costs 1 credit per person.',
  inputSchema: z.object({
    apollo_ids: z
      .array(z.string())
      .max(10)
      .describe('Apollo person IDs from search results. Max 10 per call.'),
  }),
  execute: async ({ apollo_ids }) => {
    // Apollo bulk match expects a "details" array with objects containing "id"
    const response = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
      method: 'POST',
      headers: apolloHeaders(),
      body: JSON.stringify({
        details: apollo_ids.map((id) => ({ id })),
        reveal_personal_emails: true,
      }),
    });

    if (!response.ok) {
      return { error: `Apollo enrich error ${response.status}: ${await response.text()}`, people: [] };
    }

    const data = await response.json();

    // Response has "matches" array aligned with input "details" array
    const matches: (ApolloEnrichedPerson | null)[] = data.matches ?? data.people ?? [];

    return {
      people: matches
        .filter((p): p is ApolloEnrichedPerson => p !== null)
        .map((p) => ({
          apollo_id: p.id ?? null,
          name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' '),
          email: p.email ?? null,
          email_status: p.email_status ?? null,
          email_confidence: p.extrapolated_email_confidence ?? null,
          personal_emails: p.personal_emails ?? [],
          title: p.title ?? null,
          headline: p.headline ?? null,
          seniority: p.seniority ?? null,
          departments: p.departments ?? [],
          functions: p.functions ?? [],
          linkedin_url: p.linkedin_url ?? null,
          github_url: p.github_url ?? null,
          twitter_url: p.twitter_url ?? null,
          facebook_url: p.facebook_url ?? null,
          photo_url: p.photo_url ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          country: p.country ?? null,
          is_likely_to_engage: p.is_likely_to_engage ?? null,
          employment_history: (p.employment_history ?? []).map((eh) => ({
            company: eh.organization_name ?? null,
            title: eh.title ?? null,
            start_date: eh.start_date ?? null,
            end_date: eh.end_date ?? null,
            current: eh.current ?? false,
          })),
          company: {
            name: p.organization?.name ?? null,
            domain: p.organization?.primary_domain ?? null,
            industry: p.organization?.industry ?? null,
            size: p.organization?.estimated_num_employees ?? null,
            funding: p.organization?.total_funding_printed ?? null,
            stage: p.organization?.latest_funding_stage ?? null,
            tech_stack: p.organization?.technology_names ?? [],
            description: p.organization?.short_description ?? null,
          },
        })),
    };
  },
});

// ---------------------------------------------------------------------------
// Internal: Airtable helpers for self-serving Apollo match
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

interface AirtableRecordApollo {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetchByRoleApollo(
  role: string,
  extraFilter: string,
): Promise<AirtableRecordApollo[]> {
  const records: AirtableRecordApollo[] = [];
  let offset: string | undefined;
  const baseFormula = `AND({Role}='${role}',${extraFilter})`;

  do {
    const params = new URLSearchParams({ filterByFormula: baseFormula });
    if (offset) params.set('offset', offset);
    const response = await fetch(`${airtableUrl()}?${params.toString()}`, {
      headers: airtableHeaders(),
    });
    if (!response.ok) break;
    const data = await response.json();
    for (const rec of data.records ?? []) {
      records.push({ id: rec.id, fields: rec.fields ?? {} });
    }
    offset = data.offset;
  } while (offset);

  return records;
}

// ---------------------------------------------------------------------------
// Internal: format Apollo enrichment data to Airtable fields
// ---------------------------------------------------------------------------

function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatEmploymentHistory(
  history: ApolloEnrichedPerson['employment_history'],
): string | null {
  if (!history?.length) return null;
  return history
    .map((eh) => {
      const start = formatDate(eh.start_date);
      const end = eh.current ? 'present' : formatDate(eh.end_date);
      const dateRange = start || end ? ` (${start}-${end})` : '';
      return `${eh.title ?? 'Unknown Role'} @ ${eh.organization_name ?? 'Unknown'}${dateRange}`;
    })
    .join('\n');
}

function apolloPersonToAirtableFields(p: ApolloEnrichedPerson): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (p.id) fields['Apollo ID'] = p.id;
  if (p.email) fields['Email'] = p.email;
  if (p.email_status) fields['Email Status'] = p.email_status;
  if (p.extrapolated_email_confidence != null) {
    fields['Email Confidence'] = String(p.extrapolated_email_confidence);
  }
  if (p.personal_emails?.length) fields['Personal Email'] = p.personal_emails[0];
  if (p.headline) fields['Headline'] = p.headline;
  if (p.seniority) fields['Seniority'] = p.seniority;
  if (p.departments?.length) fields['Department'] = p.departments.join(', ');
  if (p.github_url) fields['GitHub URL'] = p.github_url;
  if (p.twitter_url) fields['Twitter URL'] = p.twitter_url;
  if (p.photo_url) fields['Photo'] = [{ url: p.photo_url }];
  if (p.is_likely_to_engage != null) fields['Likely to Engage'] = String(p.is_likely_to_engage);

  const historyText = formatEmploymentHistory(p.employment_history);
  if (historyText) fields['Employment History'] = historyText;

  if (p.organization?.name) fields['Current Company'] = p.organization.name;
  if (p.organization?.primary_domain) fields['Current Company Domain'] = p.organization.primary_domain;
  if (p.organization?.industry) fields['Current Company Industry'] = p.organization.industry;
  if (p.organization?.estimated_num_employees != null) {
    fields['Current Company Size'] = p.organization.estimated_num_employees;
  }
  if (p.organization?.total_funding_printed) fields['Current Company Funding'] = p.organization.total_funding_printed;
  if (p.organization?.latest_funding_stage) fields['Current Company Stage'] = p.organization.latest_funding_stage;
  if (p.organization?.technology_names?.length) {
    fields['Current Company Tech Stack'] = p.organization.technology_names.join(', ');
  }
  if (p.organization?.short_description) fields['Current Company Description'] = p.organization.short_description;

  return fields;
}

// ---------------------------------------------------------------------------
// apolloMatchAndEnrich - self-serving: match + enrich candidates by email/LinkedIn
// ---------------------------------------------------------------------------

export const apolloMatchAndEnrich = tool({
  description:
    'Match and enrich ALL candidates for a role via Apollo. Internally fetches candidates from Airtable (Pipeline Stage "Imported" or "Enriched" without Apollo ID), matches them by email + LinkedIn URL + name, and writes employment history, company details, email verification, and Apollo ID back to Airtable. Call ONCE with just the role name. Costs 1 credit per matched person.',
  inputSchema: z.object({
    role: z.string().describe('The role name to enrich candidates for (e.g. "Head of Design - Ninety")'),
  }),
  execute: async ({ role }) => {
    // 1. Fetch candidates without Apollo ID
    const records = await airtableFetchByRoleApollo(
      role,
      `AND(OR({Pipeline Stage}='Imported',{Pipeline Stage}='Enriched'),{Apollo ID}='')`,
    );

    if (records.length === 0) {
      return { total: 0, matched: 0, failed: 0, results: [], message: 'No candidates without Apollo ID found for this role.' };
    }

    const candidates = records.map((r) => ({
      record_id: r.id,
      name: (r.fields['Name'] as string) ?? '',
      email: (r.fields['Email'] as string) ?? '',
      linkedin_url: (r.fields['LinkedIn URL'] as string) ?? '',
      company: (r.fields['Current Company'] as string) ?? '',
    }));

    // 2. Match via Apollo in batches of 10
    const results: Array<{ name: string; status: 'matched' | 'not_found' | 'error'; fields_set: string[] }> = [];

    for (let i = 0; i < candidates.length; i += 10) {
      const batch = candidates.slice(i, i + 10);

      const details = batch.map((c) => {
        const detail: Record<string, string> = {};
        if (c.email) detail.email = c.email;
        if (c.linkedin_url) detail.linkedin_url = c.linkedin_url;
        if (c.name) {
          detail.name = c.name;
          const parts = c.name.split(' ');
          if (parts.length >= 2) {
            detail.first_name = parts[0];
            detail.last_name = parts.slice(1).join(' ');
          }
        }
        if (c.company) detail.organization_name = c.company;
        return detail;
      });

      const response = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
        method: 'POST',
        headers: apolloHeaders(),
        body: JSON.stringify({ details, reveal_personal_emails: true }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Apollo bulk_match error: ${response.status}: ${errText}`);
        for (const c of batch) {
          results.push({ name: c.name, status: 'error', fields_set: [] });
        }
        continue;
      }

      const data = await response.json();
      const matches: (ApolloEnrichedPerson | null)[] = data.matches ?? [];

      // 3. Update Airtable with matched data
      const airtableUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];

      for (let j = 0; j < batch.length; j++) {
        const candidate = batch[j];
        const match = matches[j] ?? null;

        if (!match || !match.id) {
          results.push({ name: candidate.name, status: 'not_found', fields_set: [] });
          continue;
        }

        const fields = apolloPersonToAirtableFields(match);
        if (Object.keys(fields).length > 0) {
          airtableUpdates.push({ id: candidate.record_id, fields });
        }
        results.push({ name: candidate.name, status: 'matched', fields_set: Object.keys(fields) });
      }

      // Batch update Airtable
      if (airtableUpdates.length > 0) {
        const updateRes = await fetch(airtableUrl(), {
          method: 'PATCH',
          headers: airtableHeaders(),
          body: JSON.stringify({ records: airtableUpdates, typecast: true }),
        });
        if (!updateRes.ok) {
          console.error(`Airtable update error: ${updateRes.status}: ${await updateRes.text()}`);
        }
      }

      // Rate limit pause between batches
      if (i + 10 < candidates.length) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    const matched = results.filter((r) => r.status === 'matched').length;
    const notFound = results.filter((r) => r.status === 'not_found').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return { total: candidates.length, matched, not_found: notFound, failed, results };
  },
});
