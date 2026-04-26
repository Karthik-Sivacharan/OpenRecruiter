import { anthropic } from '@ai-sdk/anthropic';
import {
  streamText,
  tool,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

const SYSTEM_PROMPT = `You are OpenRecruiter, an autonomous AI recruiting agent. You run a 5-phase pipeline:

**Phase 1 — Intake (interactive):**
- Recruiter gives you a job description as a URL, PDF upload, or pasted text.
- If they give a URL, use the web_fetch tool to read the page content first.
- After reading the JD, extract all requirements (title, skills, experience, location, etc.).
- Only ask follow-up questions about info NOT already in the JD. Don't re-ask what the JD already tells you.
- Typical follow-ups: target candidate count, companies to target/avoid, salary range, outreach score threshold, timeline, any dealbreakers not in the JD.
- Wait for answers. Do not proceed until you have enough to build a strong search.

**Phase 2 — Autonomous Pipeline (no pauses):**
Once intake is complete, run the full chain without stopping:
Source (Apollo) -> Enrich -> Discover GitHub/portfolio -> Analyze -> Score -> Draft emails -> Write to CRM.
Use multi-pass title variations when searching. Put must-haves in API filters, nice-to-haves in post-enrichment scoring.

**Phase 3 — Recruiter Review:**
Present a summary table (name, score, title, company) sorted by score. Tell recruiter to review in the CRM. Ask: "Send all outreach, pick specific candidates, or send manually?"

**Phase 4 — Send + Drip (requires approval):**
Only send emails after explicit recruiter approval. Propose drip campaign details and wait for confirmation before scheduling.

**Phase 5 — Auto-Reply (runs automatically via webhook).**

**Approval gates — only pause for:**
- Sending outreach emails
- Drip campaign scheduling
Everything else runs autonomously.

**Search strategy:**
- Run 2-3 search passes with different title variations per role.
- Use person_titles, person_locations, person_seniorities as primary filters.
- Use technology UIDs (company-level) as a proxy for person skills.
- Set per_page to 100 for maximum coverage.
- Deduplicate results across passes by name/company.`;

interface ApolloPersonResult {
  first_name?: string;
  last_name?: string;
  title?: string;
  organization?: { name?: string };
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  email?: string;
  id?: string;
}

interface ApolloSearchResponse {
  pagination?: { total_entries?: number };
  people?: ApolloPersonResult[];
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic(
      process.env.MODEL_ORCHESTRATOR || 'claude-sonnet-4-6',
    ),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      // Anthropic server tool — fetches URL content server-side, no custom code needed
      web_fetch: anthropic.tools.webFetch_20250910({ maxUses: 3 }),

      apolloSearchPeople: tool({
        description:
          'Search for candidates matching job criteria using Apollo.io. Run multiple passes with different title variations for best coverage.',
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
            .describe(
              'Seniority levels: senior, manager, director, vp, head, c_suite, entry, intern',
            ),
          q_keywords: z
            .string()
            .optional()
            .describe('Free-text keyword search across name, title, employer'),
          currently_using_any_of_technology_uids: z
            .array(z.string())
            .optional()
            .describe(
              'Company tech stack UIDs like pytorch, kubernetes, react, amazon_web_services',
            ),
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
          per_page: z
            .number()
            .optional()
            .default(100)
            .describe('Results per page, max 100'),
          page: z
            .number()
            .optional()
            .default(1)
            .describe('Page number, 1-indexed'),
        }),
        execute: async (params): Promise<{
          error?: string;
          total: number;
          people: Array<{
            name: string;
            title: string | null;
            company: string | null;
            location: string | null;
            linkedin_url: string | null;
            email: string | null;
            apollo_id: string | null;
          }>;
        }> => {
          const response = await fetch(
            'https://api.apollo.io/api/v1/mixed_people/api_search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': process.env.APOLLO_API_KEY || '',
              },
              body: JSON.stringify(params),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            return {
              error: `Apollo API error ${response.status}: ${errorText}`,
              total: 0,
              people: [],
            };
          }

          const data: ApolloSearchResponse = await response.json();

          return {
            total: data.pagination?.total_entries ?? 0,
            people: (data.people ?? []).map((p) => ({
              name: [p.first_name, p.last_name].filter(Boolean).join(' '),
              title: p.title ?? null,
              company: p.organization?.name ?? null,
              location: p.city
                ? [p.city, p.state].filter(Boolean).join(', ')
                : p.country ?? null,
              linkedin_url: p.linkedin_url ?? null,
              email: p.email ?? null,
              apollo_id: p.id ?? null,
            })),
          };
        },
      }),
    },
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
