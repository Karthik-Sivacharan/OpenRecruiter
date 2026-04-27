# Session Handoff: Phase 1 Complete → Phase 2

## What Was Built (Phase 1)

### App Skeleton
- Next.js 16 + TypeScript + Tailwind + App Router (`src/` directory)
- shadcn/ui + Vercel ai-elements (12 chat components)
- Vercel AI SDK v6 + @ai-sdk/anthropic + Zod
- Linear-inspired dark theme (#08090a base, Inter Variable with cv01/ss03)

### API Route (`src/app/api/chat/route.ts`)
- `streamText` with Sonnet 4.6 orchestrator (`MODEL_ORCHESTRATOR` env var)
- System prompt with 5-phase pipeline, approval gates, search strategy
- `stopWhen: stepCountIs(15)` for multi-step tool calling
- Tools: `web_fetch`, `apolloSearchPeople`, `apolloBulkEnrich`, `airtableCreateCandidates`, `airtableUpdateCandidate`, `airtableGetCandidates`

### Tool Files
- `src/lib/tools/apollo.ts` — search (multi-pass) + bulk enrich (batches of 10, by apollo_id)
- `src/lib/tools/airtable.ts` — create candidates, update rows, get pipeline

### Chat UI (`src/app/page.tsx` + `src/components/chat-messages.tsx`)
- useChat with DefaultChatTransport, auto-resubmit for agentic loop
- Empty state with suggestion chips
- Message rendering: text, reasoning, tool calls (with status badges), confirmation flow
- Sticky bottom PromptInput

### Claude Code System
- CLAUDE.md, PRODUCT.md, DESIGN.md at project root
- `.claude/rules/` — recruiting-pipeline.md, coding-standards.md (always loaded)
- `.claude/skills/` — scoring-rubric, outreach-style, drip-sequence, auto-reply-guide, follow-up-questions, sourcing-search (on-demand)
- Superpowers plugin (14 dev process skills) + Impeccable (design quality)
- `.mcp.json` — memory, sequential-thinking, context7

### Pipeline Flow (Current)
1. **Intake:** web_fetch reads JD URL → asks only missing follow-up questions
2. **Search (free):** Apollo multi-pass search → presents results → asks "Enrich?"
3. **Enrich (after approval):** Apollo bulk enrich → push to Airtable (stage: Enriched)
4. Future steps not built yet

### Model Routing
- Orchestrator: `claude-sonnet-4-6` (all chat + tool calling + writing)
- Scoring: `claude-opus-4-6` (candidate scoring only — not built yet)
- Batch: `claude-haiku-4-5-20251001` (reserved for future)

### API Keys (in .env.local, gitignored)
- ANTHROPIC_API_KEY, MODEL_ORCHESTRATOR, MODEL_SCORING, MODEL_BATCH
- APOLLO_API_KEY
- AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID

### Airtable Schema
- Table: "Candidate Leads" (tbla8PJMJKquIcG60) with 34 fields
- Incremental push: create after Apollo enrich, update after each subsequent step
- See `docs/AIRTABLE_SCHEMA.md` for full field mapping

## What's Next (Phase 2)

From `docs/FINAL_PLAN.md`:

| Task | What |
|------|------|
| 2A | EnrichLayer tools (`enrichProfile`, `enrichWorkEmail`) — skills, education, full LinkedIn data |
| 2B | PDL tool (`pdlEnrichPerson`) — github_url, websites[], profiles[] |
| 2C | GitHub tools (`githubSearchByEmail`, `githubFetchProfile`) — find GitHub from email, get bio/repos |
| 2D | Wire the full enrichment chain: Apollo → EnrichLayer → PDL → GitHub. Update Airtable after each step. |

### Key Docs to Read
- `docs/FINAL_PLAN.md` — full implementation plan with phases
- `docs/ENRICHMENT_AND_NIA.md` — EnrichLayer + Nia API reference
- `docs/AIRTABLE_SCHEMA.md` — field mapping for incremental updates
- `docs/ANTHROPIC_SDK_REFERENCE.md` — tool calling patterns
- `docs/ai-sdk-ui-research.md` — useChat, streamText, tool UI patterns
- `docs/BUSINESS_STRATEGY.md` — integration + pricing strategy
- `.claude/rules/recruiting-pipeline.md` — detailed pipeline steps
- `.claude/skills/sourcing-search/SKILL.md` — enrichment decision tree

### Business Model Decision
Full-service at $299-599/mo. OpenRecruiter provides Apollo, AgentMail, AI. Users only connect their CRM (via Nango at launch, API keys for demo).
