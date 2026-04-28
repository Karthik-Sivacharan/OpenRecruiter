# Session Handoff: Phase 3 Complete

> 2026-04-28

## What Was Done This Session

### Phase 3: Deploy + Chat Persistence + Context Management (COMPLETE)

1. **Vercel Deploy** — live at https://x2-openrecruiter.vercel.app
   - Hobby plan (free), auto-deploy on push to main
   - `maxDuration=300`, `runtime='nodejs'` on chat route
   - All 10 env vars set in production
   - @vercel/analytics + @vercel/speed-insights installed
   - Authentication disabled (public)

2. **Neon Postgres + Drizzle** — chat persistence
   - `conversations` table: id, title, roleName, messages (JSONB), timestamps
   - Queries: createChat, loadChat, saveChat (upsert), listChats, updateChatMeta
   - Neon free tier (0.5GB), provisioned via Vercel Marketplace
   - Fetch retry wrapper for Neon cold start failures

3. **Chat Save/Load/Resume**
   - `onFinish` + `consumeStream` saves messages after each turn
   - `/chat/[id]` server component loads from DB
   - Extracted `Chat` client component (accepts id + initialMessages)
   - `prepareSendMessagesRequest` sends chatId to server
   - `page.tsx` generates nanoid for new chats

4. **Sidebar UI**
   - shadcn `sidebar` component (not dashboard-01)
   - `app-sidebar.tsx` — New Search button + recent chat list
   - `SidebarProvider` in layout.tsx, mobile hamburger trigger
   - `setChatTitle` tool — agent sets "Company - Role" after intake

5. **Context Management**
   - `pruneMessages` — strips old tool calls (before-last-2-messages) + reasoning (before-last-message)
   - Tool-result clearing — Anthropic server-side at 80k tokens, keeps last 5 tool uses
   - Compaction deferred (would cost ~$0.60/trigger at 150k tokens)

6. **Airtable Schema Updates**
   - Renamed: Company → Current Company (+ Domain, Industry, Size, Description)
   - Deleted: Current Company Funding, Current Company Stage, Current Company Tech Stack
   - Added: Hiring Company (multiSelect), Hiring Role (multiSelect), Hiring JD URL, Hiring Job Description
   - `typecast: true` on all create/update API calls
   - System prompt tells agent to pass JD context when creating candidates

## Git State

- Branch: `main` (feat/chat-persistence merged, 11 commits)
- All committed and pushed, Vercel deployed
- No uncommitted changes

## Key Files Changed/Created

```
NEW:
  drizzle.config.ts
  src/lib/db/schema.ts, index.ts, queries.ts
  src/components/chat.tsx
  src/components/app-sidebar.tsx
  src/app/chat/[id]/page.tsx
  src/app/api/conversations/route.ts
  src/components/ui/sidebar.tsx, sheet.tsx, skeleton.tsx
  src/hooks/use-mobile.ts

MODIFIED:
  src/app/api/chat/route.ts (persistence, pruneMessages, tool-result clearing, setChatTitle, hiring fields)
  src/app/page.tsx (thin wrapper for Chat component)
  src/app/layout.tsx (SidebarProvider + AppSidebar)
  src/lib/tools/airtable.ts (Current Company rename, Hiring fields, typecast)
  .claude/rules/recruiting-pipeline.md (schema docs updated)
  package.json (added @neondatabase/serverless, drizzle-orm, drizzle-kit, @vercel/analytics, @vercel/speed-insights)
```

## What's Next: Phase 4 — Scoring + Outreach

Per `recruiting-pipeline.md` Phase 3 Step 4 (still marked "future"):

1. **Nia Tracer** — `niaTracer` tool for deep code/portfolio analysis (not same as `niaWebSearch` which just finds URLs)
2. **scoreCandidate** — tool that calls Opus 4.6 internally to score each candidate against JD requirements
3. **Outreach email drafting** — personalized emails using `.claude/skills/outreach-style/`
4. **AgentMail draft creation** — `agentmailCreateDraft` tool to stage emails (recruiter approves before sending)
5. Update Airtable with score, rationale, draft email. Stage: "Scored"

Then Phase 5: Drip campaigns (Vercel Cron) + Auto-reply (AgentMail webhook)

## Environment

- `.env.local` has all env vars (Neon DATABASE_URL + original 10 API keys)
- Vercel production has all env vars
- Neon DB has 1 real chat + test DB script at `scripts/test-db.ts`
- Airtable schema updated live (fields renamed/added/deleted via Meta API)
