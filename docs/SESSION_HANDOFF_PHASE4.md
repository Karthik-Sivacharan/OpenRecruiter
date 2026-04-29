# Session Handoff: Phase 4 In Progress

> 2026-04-29

## What Was Done This Session

### Phase 4A: Nia Oracle Deep Analysis (BUILT, DISABLED)

1. **Nia API research** — tested all endpoints against real candidates (Jaydev Kumar, Robyn Hwang, Jessica Tam)
   - Oracle (`POST /v2/oracle/jobs`): best quality, ~5 min, produces recruiter-grade evaluations
   - GitHub Tracer (`POST /v2/github/tracer`): deep code analysis, ~2-3 min
   - GitHub Tree (`GET /v2/github/tree/{owner}/{repo}`): instant repo pre-filter
   - Sandbox, Document Agent, GitHub Search: broken/unusable
   - Web Search (`POST /v2/search`, mode: web): working, used for portfolio/GitHub URL discovery

2. **`niaAnalyzeCandidates` tool built** in `lib/tools/nia.ts`
   - Batch Oracle research: fires all jobs in parallel, polls concurrently
   - **DISABLED** — hit Nia's daily rate limit (10/10 calls). Code stays in nia.ts, just not imported in route.ts
   - Re-enable: uncomment import + add to tools object (two lines in route.ts)

3. **Analysis approval gate added** to system prompt and pipeline docs
   - Recruiter asked "Run deep analysis? Or skip to outreach?" after enrichment

### Phase 4B: Candidate Scoring (SHIPPED)

4. **`scoreCandidates` batch tool** in `lib/tools/scoring.ts`
   - Takes all candidates + JD + role_type in ONE tool call
   - Calls Opus 4.6 internally via `generateText` with embedded scoring rubric
   - Role-type-aware weights (engineering, design, PM, other)
   - Parallel batches of up to 10 candidates
   - Updates Airtable internally (Fit Score, Fit Rationale, stage "Scored")
   - Returns sorted results for orchestrator to show

5. **Airtable field renames** (via Meta API):
   - Score → Fit Score
   - Score Rationale → Fit Rationale
   - Nia Summary created as singleLineText (needs manual change to Long text in Airtable UI)

### JD Fetching Fallback (SHIPPED)

6. **`fetchJobDescription` tool** in `lib/tools/jd-fetch.ts`
   - Uses Jina Reader (`r.jina.ai`) to render JS-heavy SPA pages (Ashby, Lever)
   - Silent fallback: web_fetch first → Jina if empty → ask for paste
   - Jina API key set in .env.local and Vercel

### UI Fixes (SHIPPED)

7. **Sidebar redirect** — new chats now appear in sidebar after first message
   - `chat.tsx` redirects from `/` to `/chat/{id}` via `router.replace`

8. **setChatTitle hidden** from chat UI via `HIDDEN_TOOLS` filter in `chat-messages.tsx`

9. **Chat title timing** — now set immediately after JD is read, not after enrichment

### Research Completed (not committed, in `data/`)

- `data/nia-tests/` — full Nia API dry run results
- `data/agentmail-research.md` — comprehensive AgentMail integration plan
- `data/airtable-audit.md` — field audit with removal/reorder recommendations
- `data/jina-reader-research.md` — Jina Reader capabilities and pricing
- `data/web-scraping-research.md` — Firecrawl/Browserless/Crawl4AI comparison
- `data/nia-web-fetch-research.md` — Nia fetch capabilities analysis
- `data/duplicate-search-bug-analysis.md` — root cause of duplicate search bug

## CRITICAL BUG: Duplicate Search on Enrichment Approval

**Root cause:** `pruneMessages` with `toolCalls: 'before-last-2-messages'` strips Apollo search results from context when user says "yes" to enrich. Orchestrator loses candidate data and re-starts from scratch.

**Fixes needed (do these FIRST in next session):**
1. Change `toolCalls: 'before-last-2-messages'` → `'before-last-5-messages'` in route.ts line 175
2. Add `'apolloSearchPeople'` to `excludeTools` array in contextManagement (route.ts line 198)
3. Add system prompt instruction: "NEVER re-search or re-fetch the JD after recruiter approves enrichment. Use the candidates you already found."
4. Bump `stepCountIs(15)` → `stepCountIs(30)` — pipeline easily exceeds 15 steps for 5+ candidates

## Git State

- Branch: `main` (all changes committed and pushed)
- Latest commits:
  - `b9fb755` docs: update pipeline docs for Jina Reader fallback
  - `5035581` feat: add Jina Reader fallback for JS-rendered JD pages
  - `9e9b9dc` feat: add batch candidate scoring with Opus 4.6
  - `b3d48a2` fix: set chat title immediately after JD + hide setChatTitle from UI
  - `cba2335` chore: disable niaAnalyzeCandidates until rate limits are sorted
  - `3b89865` feat: add Nia Oracle deep analysis + sidebar redirect fix
- Vercel: deployed, live at https://x2-openrecruiter.vercel.app

## Key Files Changed/Created

```
NEW:
  src/lib/tools/scoring.ts          # Batch scoring with Opus 4.6
  src/lib/tools/jd-fetch.ts         # Jina Reader fallback for JS pages

MODIFIED:
  src/lib/tools/nia.ts              # Added niaAnalyzeCandidates (disabled)
  src/app/api/chat/route.ts         # Scoring + Jina + system prompt updates
  src/components/chat.tsx           # Sidebar redirect fix
  src/components/chat-messages.tsx  # Hide setChatTitle from UI
  .claude/rules/recruiting-pipeline.md  # Scoring, analysis gate, Jina docs
  .claude/skills/scoring-rubric/SKILL.md  # Updated for Fit Score/Fit Rationale
  CLAUDE.md                         # Nia Oracle + Jina references
```

## What's Next

### Immediate (next session):
1. **FIX the duplicate search bug** (4 changes in route.ts — see above)
2. **Test scoring end-to-end** on Vercel after bug fix
3. **Airtable cleanup** — remove 6 dead fields, reorder columns (see `data/airtable-audit.md`)
4. **Manual Airtable UI changes** — Nia Summary to Long text, verify Hiring Company/Role work correctly as multipleSelects

### Phase 4C-D: Outreach (not started)
5. Outreach email drafting — personalized cold emails using `outreach-style` skill
6. AgentMail integration — create drafts, recruiter approves, send (see `data/agentmail-research.md`)
   - Key insight: AgentMail's `send_at` eliminates need for Vercel Cron for drip campaigns
   - Developer plan $20/mo is right for MVP

### Phase 5: Drip + Auto-Reply (not started)
7. Drip campaigns via AgentMail `send_at` (NOT Vercel Cron)
8. Auto-reply webhook with sentiment detection + drip cancellation

## Environment

- `.env.local` has all env vars including new JINA_API_KEY
- Vercel production has all env vars including JINA_API_KEY
- Nia daily limit: 10 Oracle calls/day (resets midnight UTC)
- Jina: 10M free tokens with API key
