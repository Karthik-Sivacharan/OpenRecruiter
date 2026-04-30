import { tool } from 'ai';
import { z } from 'zod';

const NIA_API_KEY = () => process.env.NIA_API_KEY || '';
const NIA_BASE = 'https://apigcp.trynia.ai/v2';
const ORACLE_POLL_INTERVAL_MS = 10_000;
const ORACLE_TIMEOUT_MS = 300_000; // 5 minutes

/** Shared headers for all Nia API calls */
function niaHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${NIA_API_KEY()}`,
    'Content-Type': 'application/json',
  };
}

/** Sleep helper for polling */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Zod schemas for API response validation
// ---------------------------------------------------------------------------

const WebSearchResultSchema = z.object({
  url: z.string().optional(),
  link: z.string().optional(),
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
}).passthrough();

const WebSearchResponseSchema = z.object({
  github_repos: z.array(WebSearchResultSchema).optional().default([]),
  documentation: z.array(WebSearchResultSchema).optional().default([]),
  other_content: z.array(WebSearchResultSchema).optional().default([]),
  results: z.array(WebSearchResultSchema).optional().default([]),
  total_results: z.number().optional(),
}).passthrough();

const OracleJobCreateSchema = z.object({
  job_id: z.string(),
  session_id: z.string().optional(),
  status: z.string(),
  message: z.string().optional(),
}).passthrough();

const OracleJobResultSchema = z.object({
  job_id: z.string(),
  status: z.string(),
  final_report: z.string().nullable().optional(),
  citations: z.array(z.unknown()).optional().default([]),
  iterations: z.number().optional(),
  duration_ms: z.number().optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// niaWebSearch — Search the web for candidate presence
// ---------------------------------------------------------------------------

export const niaWebSearch = tool({
  description:
    'Search the web via Nia to find a candidate\'s GitHub profile, portfolio, personal website, blog, or other online presence. Use ONLY when enrichment steps (Apollo, EnrichLayer) did not provide the URL you need. Costs 1 Nia credit per search.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('Search query. Always include the candidate\'s full name AND company. Add context like "portfolio", "github.com", "behance.net", "blog" based on what you\'re looking for.'),
    num_results: z
      .number()
      .optional()
      .default(5)
      .describe('Number of results (1-10, default 5)'),
    category: z
      .enum(['github', 'company', 'research', 'news', 'tweet', 'pdf', 'blog'])
      .optional()
      .describe('Filter results by category. Use "github" when searching for GitHub profiles, "blog" for portfolios/blogs.'),
  }),
  execute: async ({ query, num_results, category }) => {
    const body: Record<string, unknown> = {
      mode: 'web',
      query,
      num_results,
    };
    if (category) body.category = category;

    const response = await fetch(`${NIA_BASE}/search`, {
      method: 'POST',
      headers: niaHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Nia web search error ${response.status}: ${text}`);
      return { error: `Nia web search error ${response.status}: ${text}`, results: [] };
    }

    const raw: unknown = await response.json();
    const parsed = WebSearchResponseSchema.safeParse(raw);

    if (!parsed.success) {
      console.error(`Nia web search parse error: ${parsed.error.message}`);
      return { error: `Nia response validation failed: ${parsed.error.message}`, results: [] };
    }

    const data = parsed.data;

    // Merge all result arrays into one flat list
    const allResults = [
      ...data.github_repos,
      ...data.documentation,
      ...data.other_content,
      ...data.results,
    ].map((r) => ({
      url: r.url ?? r.link ?? null,
      title: r.title ?? null,
      snippet: r.summary ?? r.description ?? r.snippet ?? null,
    }));

    return {
      total: allResults.length,
      results: allResults,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal: Airtable helpers
// ---------------------------------------------------------------------------

const AIRTABLE_API_KEY_NIA = () => process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID_NIA = () => process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID_NIA = () => process.env.AIRTABLE_TABLE_ID || '';

function airtableUrlNia(): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID_NIA()}/${AIRTABLE_TABLE_ID_NIA()}`;
}

function airtableHeadersNia(): Record<string, string> {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY_NIA()}`,
    'Content-Type': 'application/json',
  };
}

async function airtableBatchUpdateNia(
  updates: Array<{ id: string; fields: Record<string, unknown> }>,
): Promise<void> {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const response = await fetch(airtableUrlNia(), {
      method: 'PATCH',
      headers: airtableHeadersNia(),
      body: JSON.stringify({ typecast: true, records: batch }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Airtable batch update error (nia): ${response.status}: ${text}`);
    }
  }
}

interface AirtableRecordNia {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetchByRoleNia(
  role: string,
  extraFilter?: string,
): Promise<AirtableRecordNia[]> {
  const records: AirtableRecordNia[] = [];
  let offset: string | undefined;
  const baseFormula = extraFilter
    ? `AND({Role}='${role}',${extraFilter})`
    : `{Role}='${role}'`;

  do {
    const params = new URLSearchParams({ filterByFormula: baseFormula });
    if (offset) params.set('offset', offset);
    const response = await fetch(`${airtableUrlNia()}?${params.toString()}`, {
      headers: airtableHeadersNia(),
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

/** Extract company names from employment history text */
function extractCompanies(historyText: string | undefined): string[] {
  if (!historyText) return [];
  // Employment history format: "Title @ Company (dates)"
  return historyText
    .split('\n')
    .map((line) => {
      const match = line.match(/@ (.+?)(?:\s*\(|$)/);
      return match?.[1]?.trim() ?? '';
    })
    .filter(Boolean);
}

/** Extract school names from education text */
function extractSchools(educationText: string | undefined): string[] {
  if (!educationText) return [];
  // Education format: "Degree, School (dates)"
  return educationText
    .split('\n')
    .map((line) => {
      const match = line.match(/, (.+?)(?:\s*\(|$)/);
      return match?.[1]?.trim() ?? '';
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Internal: web search for a single candidate
// ---------------------------------------------------------------------------

interface WebSearchResult {
  url: string | null;
  title: string | null;
  snippet: string | null;
}

async function searchWeb(
  query: string,
  category?: string,
  numResults = 5,
): Promise<WebSearchResult[]> {
  const body: Record<string, unknown> = {
    mode: 'web',
    query,
    num_results: numResults,
  };
  if (category) body.category = category;

  const response = await fetch(`${NIA_BASE}/search`, {
    method: 'POST',
    headers: niaHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return [];
  }

  const raw: unknown = await response.json();
  const parsed = WebSearchResponseSchema.safeParse(raw);
  if (!parsed.success) return [];

  const data = parsed.data;
  return [
    ...data.github_repos,
    ...data.documentation,
    ...data.other_content,
    ...data.results,
  ].map((r) => ({
    url: r.url ?? r.link ?? null,
    title: r.title ?? null,
    snippet: r.summary ?? r.description ?? r.snippet ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Internal: verify a search result belongs to the candidate
// ---------------------------------------------------------------------------

function verifyResult(
  result: WebSearchResult,
  name: string,
  companies: string[],
  schools: string[],
): boolean {
  const text = [result.title, result.snippet, result.url]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const nameLower = name.toLowerCase();
  const nameParts = nameLower.split(' ').filter((p) => p.length > 2);

  // Check if name appears in result
  const nameMatch = text.includes(nameLower) ||
    nameParts.every((part) => text.includes(part));
  if (!nameMatch) return false;

  // Check if any company or school matches
  const companyMatch = companies.some((c) => c && text.includes(c.toLowerCase()));
  const schoolMatch = schools.some((s) => s && text.includes(s.toLowerCase()));
  const urlContainsName = result.url
    ? nameParts.some((part) => result.url!.toLowerCase().includes(part))
    : false;

  return companyMatch || schoolMatch || urlContainsName;
}

// ---------------------------------------------------------------------------
// searchAndSaveWebPresence — Batch web search + verify + save to Airtable
// ---------------------------------------------------------------------------

export const searchAndSaveWebPresence = tool({
  description:
    'Search for online presence (GitHub, portfolio, personal site) for candidates missing these URLs. Internally fetches candidates from Airtable by role, identifies who is missing URLs, searches in parallel, verifies results, and batch-writes to Airtable. Call ONCE with just the role name and type.',
  inputSchema: z.object({
    role: z.string().describe('The role name (e.g. "Senior Product Designer")'),
    role_type: z
      .enum(['engineering', 'design', 'pm', 'other'])
      .describe('Role type determines search query style'),
  }),
  execute: async ({ role, role_type }) => {
    // 1. Fetch all candidates for this role
    const records = await airtableFetchByRoleNia(role);

    // 2. Filter to those missing Personal Website or GitHub URL
    const candidates = records
      .filter((r) => !r.fields['Personal Website'] || !r.fields['GitHub URL'])
      .map((r) => {
        const hasWebsite = Boolean(r.fields['Personal Website']);
        const hasGithub = Boolean(r.fields['GitHub URL']);
        const missing: 'both' | 'website' | 'github' = !hasWebsite && !hasGithub ? 'both' : !hasWebsite ? 'website' : 'github';
        const name = (r.fields['Name'] as string) ?? 'Unknown';
        const company = (r.fields['Current Company'] as string) ?? '';
        const allCompanies = [company, ...extractCompanies(r.fields['Employment History'] as string | undefined)].filter(Boolean);
        const allSchools = extractSchools(r.fields['Education'] as string | undefined);

        return { record_id: r.id, name, company, allCompanies, allSchools, missing };
      });

    if (candidates.length === 0) {
      return { total: 0, found: 0, results: [], message: 'All candidates already have web presence URLs.' };
    }

    // 3. Run all searches in parallel
    const airtableUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];
    const results: Array<{
      name: string;
      personal_website: string | null;
      github_url: string | null;
      status: 'found' | 'not_found' | 'error';
    }> = [];

    const searchResults = await Promise.allSettled(
      candidates.map(async (c) => {
        let query: string;
        let category: string | undefined;
        const needsWebsite = c.missing === 'both' || c.missing === 'website';
        const needsGithub = c.missing === 'both' || c.missing === 'github';

        if (role_type === 'design') {
          query = `"${c.name}" "${c.company}" portfolio OR behance.net OR dribbble.com`;
        } else if (role_type === 'engineering') {
          query = `"${c.name}" "${c.company}" github.com`;
          category = 'github';
        } else {
          query = `"${c.name}" "${c.company}" blog OR portfolio OR medium.com`;
        }

        const webResults = await searchWeb(query, category);

        let personalWebsite: string | null = null;
        let githubUrl: string | null = null;

        for (const wr of webResults) {
          if (!wr.url) continue;
          if (!verifyResult(wr, c.name, c.allCompanies, c.allSchools)) continue;

          if (needsGithub && !githubUrl && wr.url.includes('github.com/')) {
            githubUrl = wr.url;
          } else if (needsWebsite && !personalWebsite && !wr.url.includes('linkedin.com')) {
            personalWebsite = wr.url;
          }

          if ((!needsGithub || githubUrl) && (!needsWebsite || personalWebsite)) break;
        }

        return { ...c, personalWebsite, githubUrl };
      }),
    );

    for (let i = 0; i < searchResults.length; i++) {
      const sr = searchResults[i];
      const candidate = candidates[i];

      if (sr.status === 'rejected') {
        results.push({ name: candidate.name, personal_website: null, github_url: null, status: 'error' });
        continue;
      }

      const { personalWebsite, githubUrl } = sr.value;
      const fields: Record<string, unknown> = {};
      if (personalWebsite) fields['Personal Website'] = personalWebsite;
      if (githubUrl) fields['GitHub URL'] = githubUrl;

      if (Object.keys(fields).length > 0) {
        airtableUpdates.push({ id: candidate.record_id, fields });
      }

      results.push({
        name: candidate.name,
        personal_website: personalWebsite,
        github_url: githubUrl,
        status: personalWebsite || githubUrl ? 'found' : 'not_found',
      });
    }

    // 4. Batch-write to Airtable
    if (airtableUpdates.length > 0) {
      await airtableBatchUpdateNia(airtableUpdates);
    }

    const found = results.filter((r) => r.status === 'found').length;
    return { total: candidates.length, found, results };
  },
});

// ---------------------------------------------------------------------------
// Oracle helpers — create job + poll until complete
// ---------------------------------------------------------------------------

interface OracleResult {
  candidate_name: string;
  status: 'completed' | 'timeout' | 'error';
  final_report: string | null;
  duration_ms: number | null;
  error?: string;
}

async function createOracleJob(query: string): Promise<string> {
  const response = await fetch(`${NIA_BASE}/oracle/jobs`, {
    method: 'POST',
    headers: niaHeaders(),
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Oracle job creation failed ${response.status}: ${text}`);
  }

  const raw: unknown = await response.json();
  const parsed = OracleJobCreateSchema.parse(raw);
  return parsed.job_id;
}

async function pollOracleJob(jobId: string): Promise<{
  status: string;
  final_report: string | null;
  duration_ms: number | null;
}> {
  const start = Date.now();

  while (Date.now() - start < ORACLE_TIMEOUT_MS) {
    await sleep(ORACLE_POLL_INTERVAL_MS);

    const response = await fetch(`${NIA_BASE}/oracle/jobs/${jobId}`, {
      method: 'GET',
      headers: niaHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Oracle poll error ${response.status}: ${text}`);
      continue;
    }

    const raw: unknown = await response.json();
    const parsed = OracleJobResultSchema.safeParse(raw);

    if (!parsed.success) {
      console.error(`Oracle poll parse error: ${parsed.error.message}`);
      continue;
    }

    if (parsed.data.status === 'completed') {
      return {
        status: 'completed',
        final_report: parsed.data.final_report ?? null,
        duration_ms: parsed.data.duration_ms ?? null,
      };
    }

    if (parsed.data.status === 'failed' || parsed.data.status === 'error') {
      return {
        status: parsed.data.status,
        final_report: null,
        duration_ms: parsed.data.duration_ms ?? null,
      };
    }
  }

  return { status: 'timeout', final_report: null, duration_ms: null };
}

// ---------------------------------------------------------------------------
// niaAnalyzeCandidates — batch Oracle research on multiple candidates
// ---------------------------------------------------------------------------

const CandidateInputSchema = z.object({
  name: z.string().describe('Candidate full name'),
  title: z.string().describe('Current job title'),
  company: z.string().describe('Current company'),
  linkedin_url: z.string().nullish().describe('LinkedIn profile URL'),
  personal_website: z.string().nullish().describe('Portfolio or personal site URL'),
  github_url: z.string().nullish().describe('GitHub profile URL'),
});

export const niaAnalyzeCandidates = tool({
  description:
    'Run deep research analysis on candidates using Nia Oracle. Fires all jobs in parallel, polls until complete (~5 min). Returns a full research report per candidate covering career trajectory, fit assessment, strengths, concerns, and interview recommendations. Use AFTER enrichment is complete and recruiter has approved analysis.',
  inputSchema: z.object({
    candidates: z
      .array(CandidateInputSchema)
      .min(1)
      .max(20)
      .describe('Array of candidates to analyze'),
    hiring_role: z.string().describe('The role being hired for (e.g. "Senior Product Designer")'),
    hiring_company: z.string().describe('The company hiring (e.g. "Fulcrum")'),
    key_requirements: z
      .string()
      .describe('Top 3-5 requirements from the JD, comma-separated (e.g. "5+ years B2B SaaS, complex workflows, visual design fundamentals")'),
  }),
  execute: async ({ candidates, hiring_role, hiring_company, key_requirements }) => {
    const results: OracleResult[] = [];

    // Build queries and fire all Oracle jobs in parallel
    const jobs = await Promise.allSettled(
      candidates.map(async (c) => {
        const urlLines: string[] = [];
        if (c.linkedin_url) urlLines.push(`LinkedIn: ${c.linkedin_url}`);
        if (c.personal_website) urlLines.push(`Portfolio: ${c.personal_website}`);
        if (c.github_url) urlLines.push(`GitHub: ${c.github_url}`);
        const urlSection = urlLines.length > 0
          ? `\n${urlLines.join('\n')}`
          : '';

        const query = `Research ${c.name}, currently ${c.title} at ${c.company}.${urlSection}

Evaluate their fit for ${hiring_role} at ${hiring_company}.
Key requirements: ${key_requirements}.

Provide: career trajectory with dates, fit assessment against each requirement, strengths, concerns, and specific interview recommendations.`;

        const jobId = await createOracleJob(query);
        return { name: c.name, jobId };
      }),
    );

    // Collect successful job creations
    const activeJobs: Array<{ name: string; jobId: string }> = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (job.status === 'fulfilled') {
        activeJobs.push(job.value);
      } else {
        results.push({
          candidate_name: candidates[i].name,
          status: 'error',
          final_report: null,
          duration_ms: null,
          error: job.reason instanceof Error ? job.reason.message : String(job.reason),
        });
      }
    }

    // Poll all active jobs in parallel
    const pollResults = await Promise.allSettled(
      activeJobs.map(async ({ name, jobId }) => {
        const result = await pollOracleJob(jobId);
        return { name, ...result };
      }),
    );

    for (const pr of pollResults) {
      if (pr.status === 'fulfilled') {
        results.push({
          candidate_name: pr.value.name,
          status: pr.value.status === 'completed' ? 'completed' : pr.value.status === 'timeout' ? 'timeout' : 'error',
          final_report: pr.value.final_report,
          duration_ms: pr.value.duration_ms,
        });
      } else {
        results.push({
          candidate_name: 'unknown',
          status: 'error',
          final_report: null,
          duration_ms: null,
          error: pr.reason instanceof Error ? pr.reason.message : String(pr.reason),
        });
      }
    }

    const completed = results.filter((r) => r.status === 'completed').length;
    const failed = results.filter((r) => r.status !== 'completed').length;

    return {
      total: results.length,
      completed,
      failed,
      results,
    };
  },
});
