import { tool } from 'ai';
import { z } from 'zod';

import { parallel } from '@/lib/clients/parallel';

const JINA_API_KEY = () => process.env.JINA_API_KEY || '';

// ---------------------------------------------------------------------------
// Zod schema for Jina Reader API response
// ---------------------------------------------------------------------------

const JinaResponseSchema = z.object({
  data: z.object({
    title: z.string().nullable().optional(),
    content: z.string(),
    url: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// fetchJobDescription - render JS-heavy pages via Jina Reader
// ---------------------------------------------------------------------------

export const fetchJobDescription = tool({
  description:
    'Fetch a URL and extract its content. Uses Parallel Extract API as primary (handles standard pages with focused extraction), with Jina Reader as fallback for JS-heavy SPA job boards (Ashby, Lever, Greenhouse). Returns the page as markdown.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to fetch and render'),
  }),
  execute: async ({ url }): Promise<{ title: string | null; content: string; url: string } | { error: string }> => {
    // -----------------------------------------------------------------------
    // Primary: Parallel Extract API
    // -----------------------------------------------------------------------
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
      // If we get here, Extract returned empty/short — fall through to Jina
    } catch (err) {
      // Parallel Extract failed — fall through to Jina silently
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Parallel Extract error (falling back to Jina): ${message}`);
    }

    // -----------------------------------------------------------------------
    // Fallback: Jina Reader (handles JS-heavy SPA pages)
    // -----------------------------------------------------------------------
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${JINA_API_KEY()}`,
          Accept: 'application/json',
          'X-Return-Format': 'markdown',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Jina Reader error ${response.status}: ${text}`);
        return { error: `Jina Reader error ${response.status}: ${text}` };
      }

      const raw: unknown = await response.json();
      const parsed = JinaResponseSchema.safeParse(raw);

      if (!parsed.success) {
        console.error(`Jina Reader parse error: ${parsed.error.message}`);
        return { error: `Jina Reader response validation failed: ${parsed.error.message}` };
      }

      return {
        title: parsed.data.data.title ?? null,
        content: parsed.data.data.content,
        url: parsed.data.data.url ?? url,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Jina Reader fetch error: ${message}`);
      return { error: `Jina Reader fetch error: ${message}` };
    }
  },
});
