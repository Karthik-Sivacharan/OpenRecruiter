# OpenRecruiter

An autonomous AI recruiting agency. Give it a job description URL + preferences, and it runs the entire pipeline: source, enrich, discover GitHub/portfolio, deep-analyze, score, draft hyper-personalized emails, and run drip campaigns.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript strict)
- **AI:** Vercel AI SDK v6 (`ai`, `@ai-sdk/anthropic`)
  - Orchestrator: Sonnet 4.6 (`MODEL_ORCHESTRATOR` env var) — all chat + tool calling + writing
  - Scoring: Opus 4.6 (`MODEL_SCORING` env var) — called internally by scoreCandidate tool only
  - Batch: Haiku 4.5 (`MODEL_BATCH` env var) — reserved for future high-volume operations
- **UI:** shadcn/ui + Vercel ai-elements (chat components), Tailwind CSS
- **CRM:** Attio (MCP)
- **Sourcing:** Apollo.io (MCP)
- **Email:** AgentMail (REST)
- **Knowledge Graph:** Graphiti + Neo4j (MCP, recruiting domain only)
- **Agent Memory:** Mem0 (per-role context compression)
- **Enrichment:** EnrichLayer, PDL, GitHub GraphQL (REST)
- **Analysis:** Nia Tracer (REST)
- **Deploy:** Vercel

## Architecture

```
app/                    # Next.js App Router pages
  api/
    chat/route.ts       # Main chat endpoint (Vercel AI SDK streamText)
    agentmail-webhook/  # Auto-reply serverless function
    drip/               # Drip campaign follow-up (Vercel Cron)
  page.tsx              # Chat UI (ai-elements components)
components/             # shadcn + ai-elements components
lib/
  tools/                # AI SDK tool functions (Apollo, Attio, EnrichLayer, etc.)
  agents/               # Agent configurations and prompts
  utils/                # Shared utilities
.claude/
  rules/                # Always-loaded instructions (pipeline, coding standards)
  skills/               # On-demand skills (scoring, outreach, drip, etc.)
```

## Running Tests

```bash
npm run test            # Unit tests (vitest)
npm run test:e2e        # E2E tests (playwright)
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
```

## MCP Servers Available

| Server | Purpose | Auto-Connected |
|--------|---------|---------------|
| Apollo.io | Candidate sourcing + enrichment | Yes |
| Attio | CRM pipeline tracking | Yes |
| Twilio | SMS follow-ups | Yes |
| Graphiti | Recruiting knowledge graph (candidates, companies, temporal facts) | Yes (Docker) |
| Mem0 | Per-role agent memory | Yes |
| MCP Memory | Dev entity-relation knowledge | Yes |
| Sequential Thinking | Complex reasoning chains | Yes |
| Context7 | Live docs lookup (AI SDK, Next.js) | Yes |
| BrowserOS | Browser automation | Yes |

## Pipeline Steps (What the Agent Does)

1. **Intake:** Fetch JD from URL, ask follow-up questions, save role to Graphiti
2. **Source:** Apollo search (FREE) -> confirm before enriching (costs credits)
3. **Enrich:** Apollo bulk enrich -> EnrichLayer profiles -> PDL for GitHub/socials
4. **Discover:** GitHub lookup chain (PDL -> GitHub email search -> name fallback -> Nia web search)
5. **Analyze:** Nia Tracer on GitHub repos + portfolio sites
6. **Score:** Holistic scoring using scoring-rubric skill (Claude Opus)
7. **CRM:** Save everything to Attio pipeline + Graphiti knowledge graph
8. **Outreach:** Draft emails using outreach-style skill -> AgentMail drafts -> recruiter approves -> send
9. **Drip:** Day 3 + Day 7 follow-ups via Vercel Cron
10. **Reply:** AgentMail webhook -> contextual auto-reply with screening link

## Approval Gates (NEVER Skip These)

- Enrichment that costs credits: ask before spending
- Sending outreach emails: always show drafts, wait for "send" or "send all"
- Drip campaign setup: confirm cadence before scheduling

## Memory Rules

- **Graphiti:** ONLY for recruiting domain (candidates, companies, roles, interactions, assessments)
- **Mem0:** Per-role working context (search preferences, recruiter adjustments)
- **MCP Memory:** Dev knowledge (API quirks, architecture decisions)
- **Auto-memory:** User preferences, project decisions, feedback

## Coding Standards

See `.claude/rules/coding-standards.md` for details. Key points:
- TypeScript strict, no `any`
- Prefer `const`, arrow functions, early returns
- Zod for all API response validation
- Error boundaries at system boundaries only
- Files under 300 lines, functions under 50 lines
