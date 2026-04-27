import { tool } from 'ai';
import { z } from 'zod';

const ENRICHLAYER_API_KEY = () => process.env.ENRICHLAYER_API_KEY || '';
const ENRICHLAYER_BASE = 'https://enrichlayer.com/api/v2';

/** Shared headers for all EnrichLayer API calls */
function enrichLayerHeaders() {
  return { Authorization: `Bearer ${ENRICHLAYER_API_KEY()}` };
}

// ---------------------------------------------------------------------------
// Zod schemas for API response validation
// ---------------------------------------------------------------------------

const PersonSearchResultSchema = z.object({ id: z.string() }).passthrough();

const PersonProfileSchema = z.object({
  personal_emails: z.array(z.string()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  education: z.array(z.object({
    school: z.string().nullish(), degree: z.string().nullish(),
    field_of_study: z.string().nullish(),
    start_date: z.string().nullish(), end_date: z.string().nullish(),
  }).passthrough()).optional().default([]),
  experiences: z.array(z.object({
    company: z.string().nullish(), title: z.string().nullish(),
    description: z.string().nullish(),
    start_date: z.string().nullish(), end_date: z.string().nullish(),
    current: z.boolean().nullish(),
  }).passthrough()).optional().default([]),
  certifications: z.array(z.object({
    name: z.string().nullish(), authority: z.string().nullish(),
    url: z.string().nullish(),
  }).passthrough()).optional().default([]),
  headline: z.string().nullish(),
  summary: z.string().nullish(),
}).passthrough();

const PersonalEmailResponseSchema = z.object({
  personal_emails: z.array(z.string()).optional().default([]),
}).passthrough();

const WorkEmailResponseSchema = z.object({
  work_email: z.string().nullish(),
}).passthrough();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichLayerResult {
  name: string;
  personal_emails: string[];
  skills: string[];
  education: Array<{ school: string | null; degree: string | null; field_of_study: string | null; start_date: string | null; end_date: string | null }>;
  experiences: Array<{ company: string | null; title: string | null; description: string | null; start_date: string | null; end_date: string | null; current: boolean }>;
  certifications: Array<{ name: string | null; authority: string | null; url: string | null }>;
  headline: string | null;
  summary: string | null;
  enrichlayer_id: string | null;
  enrichment_status: 'success' | 'not_found' | 'error';
  personal_email_source: 'profile' | 'fallback_endpoint' | 'none';
  work_email: string | null;
  work_email_source: 'fallback_endpoint' | 'none';
}

function emptyResult(name: string, status: EnrichLayerResult['enrichment_status']): EnrichLayerResult {
  return {
    name, personal_emails: [], skills: [], education: [], experiences: [],
    certifications: [], headline: null, summary: null, enrichlayer_id: null,
    enrichment_status: status, personal_email_source: 'none',
    work_email: null, work_email_source: 'none',
  };
}

// ---------------------------------------------------------------------------
// Helper: GET with error handling
// ---------------------------------------------------------------------------

interface FetchOk { ok: true; data: unknown }
interface FetchErr { ok: false; status: number; body: string }

async function enrichLayerGet(endpoint: string, params?: Record<string, string>): Promise<FetchOk | FetchErr> {
  const url = new URL(`${ENRICHLAYER_BASE}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const response = await fetch(url.toString(), { method: 'GET', headers: enrichLayerHeaders() });
  if (!response.ok) {
    const body = await response.text();
    console.error(`EnrichLayer ${endpoint} error ${response.status}: ${body}`);
    return { ok: false, status: response.status, body };
  }
  const data: unknown = await response.json();
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Core: enrich a single candidate
// ---------------------------------------------------------------------------

async function enrichSingleCandidate(
  candidate: { name: string; company?: string; linkedin_url?: string },
  hasApolloEmail: boolean,
): Promise<EnrichLayerResult> {
  // Step 1: Search for person to get EnrichLayer ID (2 credits)
  const searchParams: Record<string, string> = { name: candidate.name };
  if (candidate.company) searchParams.company = candidate.company;
  if (candidate.linkedin_url) searchParams.linkedin_url = candidate.linkedin_url;

  const searchResult = await enrichLayerGet('/people', searchParams);
  if (searchResult.ok === false) {
    return emptyResult(candidate.name, searchResult.status === 404 ? 'not_found' : 'error');
  }
  const searchParsed = PersonSearchResultSchema.safeParse(searchResult.data);
  if (!searchParsed.success) {
    console.error(`EnrichLayer /people parse error: ${searchParsed.error.message}`);
    return emptyResult(candidate.name, 'not_found');
  }
  const personId = searchParsed.data.id;

  // Step 2: Get full profile (1 credit)
  const profileResult = await enrichLayerGet(`/people/${personId}`);
  if (!profileResult.ok) return emptyResult(candidate.name, 'error');

  const profileParsed = PersonProfileSchema.safeParse(profileResult.data);
  if (!profileParsed.success) {
    console.error(`EnrichLayer /people/${personId} parse error: ${profileParsed.error.message}`);
    return emptyResult(candidate.name, 'error');
  }

  const profile = profileParsed.data;
  const result: EnrichLayerResult = {
    name: candidate.name,
    personal_emails: profile.personal_emails,
    skills: profile.skills,
    education: profile.education.map((e) => ({
      school: e.school ?? null, degree: e.degree ?? null,
      field_of_study: e.field_of_study ?? null,
      start_date: e.start_date ?? null, end_date: e.end_date ?? null,
    })),
    experiences: profile.experiences.map((e) => ({
      company: e.company ?? null, title: e.title ?? null,
      description: e.description ?? null,
      start_date: e.start_date ?? null, end_date: e.end_date ?? null,
      current: e.current ?? false,
    })),
    certifications: profile.certifications.map((c) => ({
      name: c.name ?? null, authority: c.authority ?? null, url: c.url ?? null,
    })),
    headline: profile.headline ?? null,
    summary: profile.summary ?? null,
    enrichlayer_id: personId,
    enrichment_status: 'success',
    personal_email_source: profile.personal_emails.length > 0 ? 'profile' : 'none',
    work_email: null,
    work_email_source: 'none',
  };

  // Step 3: If no personal emails from profile, try fallback (1 credit/email)
  if (result.personal_emails.length === 0) {
    const emailResult = await enrichLayerGet(`/people/${personId}/personal-email`);
    if (emailResult.ok) {
      const parsed = PersonalEmailResponseSchema.safeParse(emailResult.data);
      if (parsed.success && parsed.data.personal_emails.length > 0) {
        result.personal_emails = parsed.data.personal_emails;
        result.personal_email_source = 'fallback_endpoint';
      }
    }
  }

  // Step 4: If no email at all (no personal + no Apollo), try work email (3 credits)
  if (result.personal_emails.length === 0 && !hasApolloEmail) {
    const workResult = await enrichLayerGet(`/people/${personId}/work-email`);
    if (workResult.ok) {
      const parsed = WorkEmailResponseSchema.safeParse(workResult.data);
      if (parsed.success && parsed.data.work_email) {
        result.work_email = parsed.data.work_email;
        result.work_email_source = 'fallback_endpoint';
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// enrichLayerEnrich tool
// ---------------------------------------------------------------------------

export const enrichLayerEnrich = tool({
  description:
    'Deep-enrich candidates via EnrichLayer to get skills, education, experiences, certifications, and personal emails. Pass candidates from Apollo enrichment. Processes in batches of 10.',
  inputSchema: z.object({
    candidates: z.array(z.object({
      name: z.string().describe('Full name from Apollo'),
      company: z.string().optional().describe('Current company from Apollo'),
      linkedin_url: z.string().optional().describe('LinkedIn URL from Apollo'),
      has_apollo_email: z.boolean().optional().default(false)
        .describe('Whether Apollo already found a verified email for this candidate'),
    })).describe('Array of candidates to enrich via EnrichLayer'),
  }),
  execute: async ({ candidates }) => {
    const results: EnrichLayerResult[] = [];
    const errors: string[] = [];

    // Process in batches of 10 to respect rate limits
    for (let i = 0; i < candidates.length; i += 10) {
      const batch = candidates.slice(i, i + 10);
      const batchResults = await Promise.all(
        batch.map(async (c) => {
          try {
            return await enrichSingleCandidate(
              { name: c.name, company: c.company, linkedin_url: c.linkedin_url },
              c.has_apollo_email ?? false,
            );
          } catch (err) {
            errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`);
            return emptyResult(c.name, 'error');
          }
        }),
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter((r) => r.enrichment_status === 'success').length;
    const notFound = results.filter((r) => r.enrichment_status === 'not_found').length;
    const errored = results.filter((r) => r.enrichment_status === 'error').length;

    return {
      total: results.length, succeeded, not_found: notFound, errored, results,
      ...(errors.length > 0 ? { errors } : {}),
    };
  },
});
