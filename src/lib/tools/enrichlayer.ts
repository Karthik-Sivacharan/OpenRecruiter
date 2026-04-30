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
  recommendations: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  connections: z.number().nullable().optional(),
  extra: z
    .object({
      twitter_profile_id: z.string().nullable().optional(),
      facebook_profile_id: z.string().nullable().optional(),
      github_profile_id: z.string().nullable().optional(),
      website: z.string().nullable().optional(),
    })
    .passthrough()
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
// Internal: fetch a single profile from EnrichLayer API
// ---------------------------------------------------------------------------

async function fetchEnrichProfile(
  linkedinUrl: string,
): Promise<{ error: string | null; profile: z.infer<typeof ProfileSchema> | null }> {
  const params: Record<string, string | undefined> = {
    profile_url: linkedinUrl,
    use_cache: 'if-present',
    skills: 'include',
    personal_email: 'include',
    github_profile_id: 'include',
    twitter_profile_id: 'include',
    extra: 'include',
  };

  const url = buildUrl('/profile', params);
  const response = await fetch(url, { headers: enrichLayerHeaders() });

  if (!response.ok) {
    const text = await response.text();
    return { error: `EnrichLayer profile error ${response.status}: ${text}`, profile: null };
  }

  const raw: unknown = await response.json();
  const parsed = ProfileSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: `EnrichLayer response validation failed: ${parsed.error.message}`, profile: null };
  }

  return { error: null, profile: parsed.data };
}

// ---------------------------------------------------------------------------
// Internal: format EnrichLayer profile data into Airtable fields
// ---------------------------------------------------------------------------

function formatDatePart(d: z.infer<typeof DatePartSchema>): string {
  if (!d) return '';
  return d.year ? String(d.year) : '';
}

function formatProfileToAirtableFields(
  profile: z.infer<typeof ProfileSchema>,
  existingPersonalEmail: boolean,
  existingAllEmails: string,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  // Skills
  if (profile.skills.length > 0) {
    fields['Skills'] = profile.skills.join(', ');
  }

  // Education
  if (profile.education.length > 0) {
    fields['Education'] = profile.education
      .map((e) => {
        const degree = e.degree_name || e.field_of_study || 'Degree';
        const school = e.school || 'Unknown';
        const start = formatDatePart(e.starts_at);
        const end = formatDatePart(e.ends_at);
        const range = start || end ? ` (${start}–${end})` : '';
        return `${degree}, ${school}${range}`;
      })
      .join('\n');
  }

  // Certifications
  if (profile.certifications.length > 0) {
    fields['Certifications'] = profile.certifications
      .map((c) => {
        const name = c.name || 'Certification';
        const authority = c.authority ? ` — ${c.authority}` : '';
        const year = formatDatePart(c.starts_at);
        const yearStr = year ? ` (${year})` : '';
        return `${name}${authority}${yearStr}`;
      })
      .join('\n');
  }

  // EnrichLayer Experiences (separate from Apollo's Employment History)
  if (profile.experiences.length > 0) {
    fields['EnrichLayer Experiences'] = profile.experiences
      .map((e) => {
        const title = e.title || 'Role';
        const company = e.company || 'Unknown';
        const start = formatDatePart(e.starts_at);
        const end = e.ends_at ? formatDatePart(e.ends_at) : 'present';
        const range = start || end ? ` (${start}–${end})` : '';
        let line = `${title} @ ${company}${range}`;
        if (e.description) {
          line += `\n  ${e.description}`;
        }
        return line;
      })
      .join('\n');
  }

  // Summary (LinkedIn About)
  if (profile.summary) {
    fields['Summary'] = profile.summary;
  }

  // Recommendations
  if (profile.recommendations.length > 0) {
    fields['Recommendations'] = profile.recommendations.join('\n\n');
  }

  // Languages
  if (profile.languages.length > 0) {
    fields['Languages'] = profile.languages.join(', ');
  }

  // Personal Email — only set if Apollo didn't already
  if (!existingPersonalEmail && profile.personal_emails.length > 0) {
    fields['Personal Email'] = profile.personal_emails[0];
  }

  // Personal Website
  if (profile.extra?.website) {
    fields['Personal Website'] = profile.extra.website;
  }

  // GitHub URL
  if (profile.extra?.github_profile_id) {
    fields['GitHub URL'] = `https://github.com/${profile.extra.github_profile_id}`;
  }

  // Photo
  if (profile.profile_pic_url) {
    fields['Photo'] = [{ url: profile.profile_pic_url }];
  }

  // Append new emails to All Emails
  const existingLines = existingAllEmails ? existingAllEmails.split('\n') : [];
  const existingEmails = new Set(existingLines.map((l) => l.split(' ')[0].toLowerCase()));
  const newEmailLines: string[] = [];
  for (const pe of profile.personal_emails) {
    if (!existingEmails.has(pe.toLowerCase())) {
      newEmailLines.push(`${pe} (personal) [enrichlayer]`);
    }
  }
  if (newEmailLines.length > 0) {
    const combined = [...existingLines, ...newEmailLines].filter(Boolean).join('\n');
    fields['All Emails'] = combined;
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Internal: Airtable helpers
// ---------------------------------------------------------------------------

const AIRTABLE_API_KEY_EL = () => process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID_EL = () => process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID_EL = () => process.env.AIRTABLE_TABLE_ID || '';

function airtableUrlEL(): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID_EL()}/${AIRTABLE_TABLE_ID_EL()}`;
}

function airtableHeadersEL(): Record<string, string> {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY_EL()}`,
    'Content-Type': 'application/json',
  };
}

async function airtableBatchUpdate(
  updates: Array<{ id: string; fields: Record<string, unknown> }>,
): Promise<void> {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const response = await fetch(airtableUrlEL(), {
      method: 'PATCH',
      headers: airtableHeadersEL(),
      body: JSON.stringify({ typecast: true, records: batch }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Airtable batch update error: ${response.status}: ${text}`);
    }
  }
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetchByRole(
  role: string,
  extraFilter?: string,
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  const baseFormula = extraFilter
    ? `AND({Role}='${role}',${extraFilter})`
    : `{Role}='${role}'`;

  do {
    const params = new URLSearchParams({ filterByFormula: baseFormula });
    if (offset) params.set('offset', offset);
    const response = await fetch(`${airtableUrlEL()}?${params.toString()}`, {
      headers: airtableHeadersEL(),
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
// enrichAndSaveProfiles — Self-serving: fetches candidates from Airtable by role
// ---------------------------------------------------------------------------

export const enrichAndSaveProfiles = tool({
  description:
    'Enrich ALL candidates for a role via EnrichLayer. Internally fetches candidates from Airtable (Pipeline Stage "Enriched" with LinkedIn URL), enriches profiles in parallel, formats data (skills, education, certs, experiences, summary, photo, GitHub, portfolio), and batch-writes back to Airtable. Call ONCE with just the role name.',
  inputSchema: z.object({
    role: z.string().describe('The role name to enrich candidates for (e.g. "Senior Product Designer")'),
  }),
  execute: async ({ role }) => {
    // 1. Fetch candidates from Airtable that need enrichment
    const records = await airtableFetchByRole(role, `{Pipeline Stage}='Enriched'`);
    const candidates = records
      .filter((r) => r.fields['LinkedIn URL'])
      .map((r) => ({
        record_id: r.id,
        name: (r.fields['Name'] as string) ?? 'Unknown',
        linkedin_url: r.fields['LinkedIn URL'] as string,
        hasPersonalEmail: Boolean(r.fields['Personal Email']),
        existingAllEmails: (r.fields['All Emails'] as string) ?? '',
      }));

    if (candidates.length === 0) {
      return { total: 0, enriched: 0, failed: 0, results: [], message: 'No candidates with LinkedIn URLs found for this role.' };
    }

    // 2. Enrich all profiles in parallel
    const enrichResults = await Promise.allSettled(
      candidates.map(async (c) => {
        const result = await fetchEnrichProfile(c.linkedin_url);
        return { ...c, ...result };
      }),
    );

    // 3. Format results and build Airtable updates
    const airtableUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];
    const results: Array<{
      name: string;
      status: 'enriched' | 'error';
      fields_set: string[];
      error?: string;
    }> = [];

    for (let i = 0; i < enrichResults.length; i++) {
      const er = enrichResults[i];
      const candidate = candidates[i];

      if (er.status === 'rejected') {
        results.push({
          name: candidate.name,
          status: 'error',
          fields_set: [],
          error: er.reason instanceof Error ? er.reason.message : String(er.reason),
        });
        continue;
      }

      const { profile, error } = er.value;
      if (error || !profile) {
        results.push({
          name: candidate.name,
          status: 'error',
          fields_set: [],
          error: error ?? 'No profile returned',
        });
        continue;
      }

      const fields = formatProfileToAirtableFields(
        profile,
        candidate.hasPersonalEmail,
        candidate.existingAllEmails,
      );

      if (Object.keys(fields).length > 0) {
        airtableUpdates.push({ id: candidate.record_id, fields });
      }

      results.push({
        name: candidate.name,
        status: 'enriched',
        fields_set: Object.keys(fields),
      });
    }

    // 4. Batch-write to Airtable
    if (airtableUpdates.length > 0) {
      await airtableBatchUpdate(airtableUpdates);
    }

    const enriched = results.filter((r) => r.status === 'enriched').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return { total: candidates.length, enriched, failed, results };
  },
});

// ---------------------------------------------------------------------------
// enrichProfile — Fetch full profile by LinkedIn URL (single, kept for edge cases)
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
