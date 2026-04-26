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
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  github_url?: string;
  twitter_url?: string;
  photo_url?: string;
  seniority?: string;
  departments?: string[];
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
// apolloSearchPeople
// ---------------------------------------------------------------------------

export const apolloSearchPeople = tool({
  description:
    'Search for candidates matching job criteria using Apollo.io. Run multiple passes with different title variations for best coverage. Returns basic info (no emails — use apolloBulkEnrich after).',
  inputSchema: z.object({
    person_titles: z
      .array(z.string())
      .describe('Job titles to search for, e.g. ["ml engineer", "machine learning engineer"]'),
    person_locations: z
      .array(z.string())
      .optional()
      .describe('Locations like "San Francisco, CA", "Bay Area"'),
    person_seniorities: z
      .array(z.string())
      .optional()
      .describe('Seniority levels: senior, manager, director, vp, head, c_suite, entry, intern'),
    q_keywords: z
      .string()
      .optional()
      .describe('Free-text keyword search across name, title, employer'),
    currently_using_any_of_technology_uids: z
      .array(z.string())
      .optional()
      .describe('Company tech stack UIDs like pytorch, kubernetes, react, amazon_web_services'),
    currently_using_all_of_technology_uids: z
      .array(z.string())
      .optional()
      .describe('ALL of these tech UIDs must be in the company stack'),
    organization_num_employees_ranges: z
      .array(z.string())
      .optional()
      .describe('Company size ranges like "51,200", "201,500", "1001,5000"'),
    q_organization_keyword_tags: z
      .array(z.string())
      .optional()
      .describe('Industry tags like "SaaS", "fintech", "artificial intelligence"'),
    contact_email_status: z
      .array(z.string())
      .optional()
      .describe('Email status filter, e.g. ["verified", "likely to engage"]'),
    per_page: z.number().optional().default(100).describe('Results per page, max 100'),
    page: z.number().optional().default(1).describe('Page number, 1-indexed'),
  }),
  execute: async (params) => {
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
          title: p.title ?? null,
          headline: p.headline ?? null,
          seniority: p.seniority ?? null,
          linkedin_url: p.linkedin_url ?? null,
          github_url: p.github_url ?? null,
          twitter_url: p.twitter_url ?? null,
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
