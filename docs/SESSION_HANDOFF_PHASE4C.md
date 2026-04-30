# Session Handoff: Phase 4C Outreach + Research

> 2026-04-29

## What Was Done This Session

### Bug Fix: Duplicate Search on Enrichment Approval (SHIPPED)
- Removed `pruneMessages` entirely (was stripping Apollo results mid-conversation)
- Now relying solely on Anthropic server-side `contextManagement` (free, triggers at 80K tokens)
- Bumped `stepCountIs(15)` → `stepCountIs(30)`
- Merged to main, deployed

### Phase 4C: Outreach Email Drafting (SHIPPED)
1. **`agentmailCreateDrafts` + `agentmailSendDrafts` tools** in `src/lib/tools/agentmail.ts`
   - Creates drafts with labels: `draft-ready`, `airtable-{recordId}`, `role-{slug}`
   - Auto-appends recruiter signature (from config)
   - Updates Airtable: Draft Email Subject/Body/Draft ID + stage "Draft Ready" / "Contacted"
   - `clientId` for idempotency

2. **Recruiter config** (`src/lib/config/recruiters.ts`)
   - Profiles keyed by AgentMail inbox ID
   - Carl Wheatley: name, title, intro, CTA, signature with social links
   - System prompt dynamically injects recruiter info via `buildSystemPrompt()`
   - Adding new recruiter = add entry + new AgentMail inbox

3. **Outreach-style skill** (`.claude/skills/outreach-style/SKILL.md`) — major rewrite
   - Golden Rule: every email must show you know the CANDIDATE + the ROLE + connect the two
   - 7-part structure: Subject → Intro → Hook → Pitch → Connection → CTA → Signature (auto)
   - Subject format: "Role at Company" (normal caps), e.g. "Senior Product Designer at ComfyUI"
   - Recruiter intro: "Hi {name}, I'm Carl, a former product designer turned design recruiter."
   - CTA: "Open to a quick conversation if this sounds interesting?"
   - Signature auto-appended by tool (not in draft body)
   - Hiring context rules: ALWAYS name hiring company (never agency), include JD detail, include comp
   - Anti-hallucination: ONLY use data from candidate's Airtable row. Flag thin-data template for sparse candidates.
   - Banned AI-isms list, pre-flight checklist, good + bad examples
   - Based on coreyhaines31/marketingskills cold-email skill + YC cold email principles + Demand Curve frameworks + cracking-distribution research

4. **`scoreCandidates` fix** — now returns `record_id` per candidate (was stripped before)

5. **Airtable schema additions** (created via Meta API):
   - AgentMail Draft ID (singleLineText)
   - AgentMail Message ID (singleLineText)
   - Sent At (singleLineText)

6. **Vercel build fix** — `agentmail` marked as `serverExternalPackages` in `next.config.ts` to avoid `@x402/fetch` optional dependency error

7. **Dry run completed** — Lola Jiang (score 9) email created in AgentMail + Airtable with full format

### Research Completed (saved as docs)
- `docs/PHASE_5_AUTO_REPLY_PLAN.md` — webhook implementation, intent classification, decision matrix
- `docs/PHASE_5_DRIP_CAMPAIGN_PLAN.md` — AgentMail `send_at` drafts, cancellation on reply, no Vercel Cron needed
- `docs/PHASE_4C_OUTREACH_PLAN.md` — original outreach plan with cold email research
- Juicebox competitive analysis (Graphiti + Mem0 differentiation) — discussed, not saved as doc

### Key Findings
- AgentMail does NOT have built-in auto-reply. Vercel webhook required.
- AgentMail `send_at` eliminates need for Vercel Cron for drip campaigns
- Interest-based CTAs ("Interested?") convert 2x better than meeting requests (Gong Labs, 304K emails)
- 75-125 words optimal for recruiting emails
- Comp range is #1 reply driver — include when available in JD

## Open Issues

### Jina Fallback Not Working on Vercel (needs debugging)
- `web_fetch` (Anthropic server tool) fails on JS-rendered job boards
- `fetchJobDescription` (Jina Reader) should be the fallback but may not be triggering
- `JINA_API_KEY` is set on Vercel
- Need to test: is the agent calling Jina as fallback? Or stopping after web_fetch?
- Next session: debug with a specific URL

### Not Started
- Phase 5A: Auto-reply webhook (`/api/agentmail-webhook/route.ts`)
- Phase 5B: Drip campaigns (create scheduled drafts after send)
- Graphiti + Mem0 integration
- `svix` npm install (needed for webhook verification)

## Git State

- Branch: `main`
- Latest commits:
  - `ab5df9a` chore: add social links to Carl's email signature
  - `72c8608` feat: add recruiter profiles + fix Vercel build
  - `a32e1c1` fix: prevent hallucination in outreach emails
  - `3c81024` fix: rewrite outreach skill to require JD context in every email
  - `9889adc` feat: add AgentMail outreach drafting + updated email style guide
  - `142be60` Merge branch 'feat/candidate-scoring' (duplicate search bug fix)
- Vercel: deployed, live at https://x2-openrecruiter.vercel.app
- Note: user prefers keeping feature branches after merging (see memory)

## Key Files Changed/Created

```
NEW:
  src/lib/config/recruiters.ts            # Recruiter profiles (Option D)
  src/lib/tools/agentmail.ts              # AgentMail draft/send tools
  docs/PHASE_4C_OUTREACH_PLAN.md          # Outreach implementation plan
  docs/PHASE_5_AUTO_REPLY_PLAN.md         # Auto-reply webhook plan
  docs/PHASE_5_DRIP_CAMPAIGN_PLAN.md      # Drip campaign plan

MODIFIED:
  src/app/api/chat/route.ts               # buildSystemPrompt(), outreach instructions, AgentMail tools
  src/lib/tools/scoring.ts                # Return record_id in results
  src/lib/tools/airtable.ts               # Fixed description (Score → Fit Score)
  .claude/skills/outreach-style/SKILL.md  # Full rewrite with JD context + recruiter config
  .claude/rules/recruiting-pipeline.md    # Added AgentMail fields to schema
  docs/AIRTABLE_SCHEMA.md                 # Score → Fit Score, new AgentMail fields
  next.config.ts                          # serverExternalPackages for agentmail
  package.json                            # Added agentmail dependency
```

## Environment Variables

All set on both `.env.local` and Vercel production:
- `AGENTMAIL_API_KEY` — am_us_inbox_xxx (inbox-scoped key)
- `AGENTMAIL_INBOX_ID` — carl.x2talent@agentmail.to
- `JINA_API_KEY` — set but needs debugging on Vercel

Still needed (Phase 5):
- `AGENTMAIL_WEBHOOK_SECRET` — will get when registering webhook

## AgentMail State

- Inbox: carl.x2talent@agentmail.to (display name: Carl Wheatley)
- Active draft: Lola Jiang (rec5OztHXgm6JN96s) — "Senior Product Designer at ComfyUI"
- Labels convention: `draft-ready`, `airtable-{recordId}`, `role-{slug}`
