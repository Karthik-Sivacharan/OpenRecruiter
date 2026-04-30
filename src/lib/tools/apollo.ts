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
// apolloMultiSearch — run multiple search passes in parallel + deduplicate
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
      .describe('Array of search configurations — each pass uses different title variations or filters'),
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
