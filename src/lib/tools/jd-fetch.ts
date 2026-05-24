import { tool } from 'ai';
import { z } from 'zod';

import { parallel } from '@/lib/clients/parallel';

// ---------------------------------------------------------------------------
// fetchJobDescription - extract JD content via Parallel Extract API
// ---------------------------------------------------------------------------

export const fetchJobDescription = tool({
  description:
    'Fetch a URL and extract its content via Parallel Extract API. Handles JavaScript-rendered pages (Ashby, Lever, Greenhouse) and PDFs. Uses objective-focused extraction to return clean job description markdown, stripping nav bars, footers, and irrelevant page chrome.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to fetch and render'),
  }),
  execute: async ({ url }): Promise<{ title: string | null; content: string; url: string } | { error: string }> => {
    try {
      const extract = await parallel.extract({
        urls: [url],
        objective:
          'Extract the complete job description including title, requirements, qualifications, compensation, location, and company details',
        advanced_settings: { full_content: true },
      });

      const result = extract.results?.[0];
      if (result) {
        const content = result.full_content || result.excerpts?.join('\n') || '';
        if (content.length >= 100) {
          return {
            title: result.title ?? null,
            content,
            url: result.url ?? url,
          };
        }
      }

      // Extract returned empty/short content
      const errorDetail = extract.errors?.[0];
      return {
        error: errorDetail
          ? `Parallel Extract error: ${errorDetail.error_type} (${errorDetail.http_status_code ?? 'unknown'})`
          : 'Parallel Extract returned insufficient content',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Parallel Extract error: ${message}`);
      return { error: `Parallel Extract error: ${message}` };
    }
  },
});

// ---------------------------------------------------------------------------
// Old Jina Reader implementation (replaced by Parallel Extract API)
// ---------------------------------------------------------------------------
// const JINA_API_KEY = () => process.env.JINA_API_KEY || '';
//
// const JinaResponseSchema = z.object({
//   data: z.object({
//     title: z.string().nullable().optional(),
//     content: z.string(),
//     url: z.string().optional(),
//   }),
// });
//
// execute: async ({ url }) => {
//   const response = await fetch(`https://r.jina.ai/${url}`, {
//     method: 'GET',
//     headers: {
//       Authorization: `Bearer ${JINA_API_KEY()}`,
//       Accept: 'application/json',
//       'X-Return-Format': 'markdown',
//     },
//   });
//   const raw = await response.json();
//   const parsed = JinaResponseSchema.safeParse(raw);
//   return {
//     title: parsed.data.data.title ?? null,
//     content: parsed.data.data.content,
//     url: parsed.data.data.url ?? url,
//   };
// }
