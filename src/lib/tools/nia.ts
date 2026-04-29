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
