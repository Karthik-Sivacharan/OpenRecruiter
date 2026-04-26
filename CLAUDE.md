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

## Pipeline Flow (5 Phases)

1. **Intake:** Fetch JD, ask follow-up questions (only about info NOT in JD). Wait for answers.
2. **Search (free):** Apollo multi-pass search. Present results. Ask "Enrich these X candidates?"
3. **Enrich + Analyze (autonomous after approval):** Apollo enrich → push to Airtable → EnrichLayer → PDL/GitHub → Nia → Score → Draft emails. Push to Airtable after EACH step so no data is lost.
4. **Recruiter review:** "Done, go check Airtable." Show summary. Wait.
5. **Send + Drip:** Recruiter controls sending. Confirm drip before scheduling.
6. **Auto-reply:** AgentMail webhook reads candidate's Airtable row for context, auto-replies, updates Airtable.

See `.claude/rules/recruiting-pipeline.md` for the detailed step-by-step.

## Approval Gates (NEVER Skip These)

- **Intake questions:** Wait for recruiter to answer before sourcing
- **Enrichment:** After search, before spending credits — "Enrich these X candidates?"
- **Sending outreach:** Recruiter chooses: send all, pick specific, or send manually via AgentMail
- **Drip campaign:** Propose details, confirm with recruiter before scheduling
- **Everything else** (each enrichment step, analysis, scoring, drafting): runs autonomously once enrichment approved

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
