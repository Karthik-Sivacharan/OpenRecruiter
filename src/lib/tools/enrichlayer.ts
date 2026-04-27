import { tool } from 'ai';
import { z } from 'zod';

const ENRICHLAYER_API_KEY = () => process.env.ENRICHLAYER_API_KEY || '';
const ENRICHLAYER_BASE = 'https://enrichlayer.com/api/v2';

/** Shared headers for all EnrichLayer API calls */
function enrichLayerHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${ENRICHLAYER_API_KEY()}`,
  };
}

// ---------------------------------------------------------------------------
// Zod schemas for API response validation
// ---------------------------------------------------------------------------

const DatePartSchema = z
  .object({
    day: z.number().nullable().optional(),
    month: z.number().nullable().optional(),
    year: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const ExperienceSchema = z.object({
  starts_at: DatePartSchema,
  ends_at: DatePartSchema,
  company: z.string().nullable().optional(),
  company_linkedin_profile_url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
});

const EducationSchema = z.object({
  starts_at: DatePartSchema,
  ends_at: DatePartSchema,
  field_of_study: z.string().nullable().optional(),
  degree_name: z.string().nullable().optional(),
  school: z.string().nullable().optional(),
  school_linkedin_profile_url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  activities_and_societies: z.string().nullable().optional(),
});

const ProfileSchema = z.object({
  public_identifier: z.string().nullable().optional(),
  profile_pic_url: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  follower_count: z.number().nullable().optional(),
  occupation: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  location_str: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  country_full_name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  experiences: z.array(ExperienceSchema).optional().default([]),
  education: z.array(EducationSchema).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  certifications: z.array(z.object({
    starts_at: DatePartSchema,
    ends_at: DatePartSchema,
    name: z.string().nullable().optional(),
    license_number: z.string().nullable().optional(),
    display_source: z.string().nullable().optional(),
    authority: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  connections: z.number().nullable().optional(),
  extra: z
    .object({
      twitter_profile_id: z.string().nullable().optional(),
      facebook_profile_id: z.string().nullable().optional(),
      github_profile_id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  personal_emails: z.array(z.string()).optional().default([]),
  personal_numbers: z.array(z.string()).optional().default([]),
  inferred_salary: z
    .object({
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  gender: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  meta: z
    .object({
      thin_profile: z.boolean().optional(),
      last_updated: z.string().nullable().optional(),
    })
    .optional(),
});

const ResolveResponseSchema = z.object({
  url: z.string().nullable().optional(),
  name_similarity_score: z.number().nullable().optional(),
  company_similarity_score: z.number().nullable().optional(),
  title_similarity_score: z.number().nullable().optional(),
  location_similarity_score: z.number().nullable().optional(),
  profile: ProfileSchema.nullable().optional(),
});

const WorkEmailResponseSchema = z.object({
  email: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  email_queue_count: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helper: build URL with query params
// ---------------------------------------------------------------------------

function buildUrl(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(`${ENRICHLAYER_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// enrichProfile — Fetch full profile by LinkedIn URL
// ---------------------------------------------------------------------------

export const enrichProfile = tool({
  description:
    'Enrich a candidate profile via EnrichLayer using their LinkedIn URL. Returns full profile: experiences, education, skills, GitHub/Twitter IDs, personal emails. Costs 1 credit.',
  inputSchema: z.object({
    linkedin_url: z
      .string()
      .describe('LinkedIn profile URL, e.g. "https://www.linkedin.com/in/samcarlson2"'),
    include_skills: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include skills data (default true)'),
    include_personal_email: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include personal email if available'),
    include_github: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include GitHub profile ID'),
  }),
  execute: async ({ linkedin_url, include_skills, include_personal_email, include_github }) => {
    const params: Record<string, string | undefined> = {
      profile_url: linkedin_url,
      use_cache: 'if-present',
    };

    if (include_skills) params.skills = 'include';
    if (include_personal_email) params.personal_email = 'include';
    if (include_github) {
      params.github_profile_id = 'include';
      params.twitter_profile_id = 'include';
      params.extra = 'include';
    }

    const url = buildUrl('/profile', params);
    const response = await fetch(url, { headers: enrichLayerHeaders() });

    if (!response.ok) {
      const text = await response.text();
      return {
        error: `EnrichLayer profile error ${response.status}: ${text}`,
        profile: null,
      };
    }

    const raw: unknown = await response.json();
    const parsed = ProfileSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        error: `EnrichLayer response validation failed: ${parsed.error.message}`,
        profile: null,
      };
    }

    return { error: null, profile: parsed.data };
  },
});

// ---------------------------------------------------------------------------
// enrichLookupPerson — Find person by name + company (no LinkedIn URL needed)
// ---------------------------------------------------------------------------

export const enrichLookupPerson = tool({
  description:
    'Look up a person on EnrichLayer by name and company domain. Use when you have a name but no LinkedIn URL. Returns matched profile with similarity scores. Costs 2 credits.',
  inputSchema: z.object({
    first_name: z.string().describe('First name of the person'),
    last_name: z.string().describe('Last name of the person'),
    company_domain: z
      .string()
      .optional()
      .describe('Company domain, e.g. "assembled.com"'),
    title: z
      .string()
      .optional()
      .describe('Job title for better matching'),
    location: z
      .string()
      .optional()
      .describe('Location for better matching'),
    enrich_profile: z
      .boolean()
      .optional()
      .default(true)
      .describe('Return full enriched profile (default true, costs 1 extra credit)'),
  }),
  execute: async ({ first_name, last_name, company_domain, title, location, enrich_profile }) => {
    const params: Record<string, string | undefined> = {
      first_name,
      last_name,
      company_domain,
      title,
      location,
      similarity_checks: 'include',
    };

    if (enrich_profile) {
      params.enrich_profile = 'enrich';
    }

    const url = buildUrl('/profile/resolve', params);
    const response = await fetch(url, { headers: enrichLayerHeaders() });

    if (!response.ok) {
      const text = await response.text();
      return {
        error: `EnrichLayer lookup error ${response.status}: ${text}`,
        match: null,
      };
    }

    const raw: unknown = await response.json();
    const parsed = ResolveResponseSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        error: `EnrichLayer response validation failed: ${parsed.error.message}`,
        match: null,
      };
    }

    const data = parsed.data;

    return {
      error: null,
      match: {
        linkedin_url: data.url ?? null,
        similarity: {
          name: data.name_similarity_score ?? null,
          company: data.company_similarity_score ?? null,
          title: data.title_similarity_score ?? null,
          location: data.location_similarity_score ?? null,
        },
        profile: data.profile ?? null,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// enrichWorkEmail — Get work email from LinkedIn URL
// ---------------------------------------------------------------------------

export const enrichWorkEmail = tool({
  description:
    'Look up a work email for a candidate using their LinkedIn URL via EnrichLayer. Returns the email if found, or queues it for async lookup. Costs 1 credit.',
  inputSchema: z.object({
    linkedin_url: z
      .string()
      .describe('LinkedIn profile URL, e.g. "https://www.linkedin.com/in/samcarlson2"'),
  }),
  execute: async ({ linkedin_url }) => {
    const url = buildUrl('/profile/email', {
      profile_url: linkedin_url,
    });

    const response = await fetch(url, { headers: enrichLayerHeaders() });

    if (!response.ok) {
      const text = await response.text();
      return {
        error: `EnrichLayer email error ${response.status}: ${text}`,
        email: null,
        status: 'error',
      };
    }

    const raw: unknown = await response.json();
    const parsed = WorkEmailResponseSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        error: `EnrichLayer response validation failed: ${parsed.error.message}`,
        email: null,
        status: 'error',
      };
    }

    const data = parsed.data;

    // The API may return an email directly, or queue it for async lookup
    if (data.email) {
      return {
        error: null,
        email: data.email,
        status: data.status ?? 'email_found',
      };
    }

    return {
      error: null,
      email: null,
      status: 'queued',
      queue_count: data.email_queue_count ?? null,
      notes: data.notes ?? null,
    };
  },
});
