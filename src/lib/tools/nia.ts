import { tool } from 'ai';
import { z } from 'zod';

const NIA_API_KEY = () => process.env.NIA_API_KEY || '';
const NIA_BASE = 'https://apigcp.trynia.ai/v2';

/** Shared headers for all Nia API calls */
function niaHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${NIA_API_KEY()}`,
    'Content-Type': 'application/json',
  };
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
