# Session Handoff: Phase 2 Complete → Phase 3

## What Was Built (Phase 2)

### EnrichLayer Integration (`src/lib/tools/enrichlayer.ts`)
- 3 tools: `enrichProfile`, `enrichLookupPerson`, `enrichWorkEmail`
- URL-based API (`/profile?profile_url=<linkedin>`) — NOT ID-based
- Returns full parsed profile directly (no lossy formatter — learned the hard way)
- Zod schemas with `.passthrough()` on `extra` to prevent silent field stripping
- `extra.website` captures personal website from LinkedIn Contact Info

### Apollo Improvements (`src/lib/tools/apollo.ts`)
- `reveal_personal_emails: true` — gets personal emails (gmail, etc.) directly from Apollo
- Captures: `personal_emails`, `departments`, `functions`, `email_confidence`, `facebook_url`
- Response maps new fields into structured output

### Nia Web Search (`src/lib/tools/nia.ts`)
- `niaWebSearch` tool — searches web for portfolio/GitHub when enrichment didn't find them
- Role-aware query construction in system prompt (designer→portfolio, engineer→github, PM→blog)
- Verification logic: must match candidate name + employment history/school/URL before saving
- 1 Nia credit per search, only for candidates missing links

### Airtable Updates (`src/lib/tools/airtable.ts`)
- Recruiter-readable formatting: Employment History, All Emails as text, not JSON
- Photo renders as thumbnail (attachment type) instead of raw URL
- Empty arrays skipped (blank cell instead of "[]")
- New fields created: Personal Email, Personal Website, Summary, Recommendations, Languages, All Emails, Department, Email Confidence, EnrichLayer Experiences, Certifications, EnrichLayer ID, Photo

### System Prompt (`src/app/api/chat/route.ts`)
- 7-step Phase 3 pipeline: Apollo → Airtable → EnrichLayer → Save → Email fallback → Nia discovery → Done
- Strict data-saving rules: "NEVER generate, infer, or embellish"
- Email priority: personal > verified work > extrapolated work
- EnrichLayer fields formatted as readable text, not JSON
- Nia web search with verification before saving URLs

### Migration Script (`scripts/migrate-airtable-format.ts`)
- Reformats existing rows: JSON → readable text, Photo URL → attachment, clears "[]"
- Run with: `source .env.local && AIRTABLE_API_KEY="$AIRTABLE_API_KEY" AIRTABLE_BASE_ID="$AIRTABLE_BASE_ID" AIRTABLE_TABLE_ID="$AIRTABLE_TABLE_ID" npx tsx scripts/migrate-airtable-format.ts`

### Research Docs
- `docs/NIA_CAPABILITIES.md` — full Nia audit (46+ endpoints, pricing, recruiting use cases)
- `docs/ENRICHMENT_AND_NIA.md` — corrected EnrichLayer API reference (URL-based, not ID-based)

### Bug Fixes
- Fixed ai-elements TypeScript errors (Base UI breaking changes)
- Fixed `extra.website` being silently stripped by Zod schema
- Fixed certifications not being saved (missing from Zod schema)
- Fixed `formatProfile` dropping fields (removed in favor of raw parsed data)

### Key Lessons Learned
- Always curl-test APIs before writing code (saved as feedback memory)
- Zod strips unknown fields by default — use `.passthrough()` for external API data
- Don't put a formatting layer between API response and LLM — data gets lost
- EnrichLayer API is URL-based, not ID-based despite what their /docs page says

## Current Pipeline Flow

```
1. Intake: JD fetch → follow-up questions → wait for answers
2. Search: Apollo multi-pass → present results → wait for approval
3. Apollo Enrich: bulk enrich → personal emails, departments → CREATE Airtable rows
4. EnrichLayer: enrichProfile → skills, education, certs, summary, recommendations, languages, website → UPDATE Airtable
5. Email fallback: enrichWorkEmail (only if no email at all)
6. Nia Web Search: find portfolio/GitHub for candidates missing them → verify → UPDATE Airtable
7. Done: show summary, ask about outreach
```

## API Keys (in .env.local)
- ANTHROPIC_API_KEY, MODEL_ORCHESTRATOR, MODEL_SCORING, MODEL_BATCH
- APOLLO_API_KEY
- AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID
- ENRICHLAYER_API_KEY
- NIA_API_KEY

## What's Next

### Phase 3: Chat Persistence + Deployment
Make the app production-ready with saved conversations and public access.
See `docs/CHAT_PERSISTENCE_RESEARCH.md` for full architecture.
1. Neon Postgres + Drizzle schema for conversations
2. Chat save/load/continue (useChat with initialMessages)
3. Sidebar UI for conversation history
4. Per-role Airtable tables (created dynamically per intake)
5. Deploy to Vercel with env vars

### Phase 4: Scoring + Outreach
1. **Scoring** — Opus 4.6 scores each candidate 1-10 with rationale based on all enriched data
2. **Email Drafting** — Sonnet writes personalized outreach using summary, recommendations, role context
3. **Send** — AgentMail integration, update stage to "Contacted"

### Phase 5: Follow-up + Auto-Reply
1. **Drip Campaign** — Vercel Cron for Day 3/7/14 follow-ups
2. **Auto-Reply** — AgentMail webhook → contextual reply from Airtable row

### Research done but not implemented:
- LinkdAPI ($0.005/profile) — LinkedIn Contact Info websites + Featured section
- Firecrawl ($99/mo, MCP server) — crawl portfolio sites into structured data
- Exa ($40/mo, MCP server) — semantic web search for candidate presence
- Nia Tracer (15 credits) — deep GitHub code analysis for engineers
- Nia Oracle (15 credits) — autonomous web research for non-code candidates
- Claude Vision — visual design quality assessment from screenshots
- Apollo org enrichment + job postings — company context + hiring signals
- Headcount growth data from Apollo — outreach personalization

### Airtable fields ready but not populated yet:
- Score, Score Rationale (scoring step)
- Nia Analysis (Tracer/Oracle step)
- Draft Email Subject, Draft Email Body (drafting step)
- AgentMail Thread ID (send step)
- Reply Content (auto-reply step)
