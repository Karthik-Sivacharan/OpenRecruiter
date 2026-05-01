# Session Handoff: Phase 7 Supermemory Talent Pool

> 2026-05-01

## What Was Done This Session

### Phase 7A: Setup + Proof of Concept (DONE)
- Created Supermemory account, got API key
- Installed `supermemory` + `@supermemory/tools` npm packages
- API key set in `.env.local` and Vercel production
- Test script at `scripts/test-supermemory.ts` verified: add, search, profile APIs all work
- Key discovery: `containerTag` is required for search (omitting returns 0 results)

### Phase 7B: syncToTalentPool Tool (DONE)
- File: `src/lib/tools/talent-pool.ts`
- Self-serving: takes `{ role }`, fetches candidates from Airtable internally
- Architecture: shared `talent-pool` containerTag (NOT per-candidate containers)
  - Per-candidate grouping via `customId: "candidate-{linkedin-slug}"`
  - This is how Supermemory is designed - containerTag = user of system, not entity being stored
- Builds full profile content: Name, Title, Company, Skills, Education, Employment History, EnrichLayer Experiences, Certifications, Languages, Summary, plus Recruiting Context (Role, Hiring Company, Fit Score, Rationale, Stage, Recruiter Notes, Intake Notes)
- Metadata: `{ type, airtable_record_id, linkedin_url, role, hiring_company, fit_score, stage }`
- Metadata propagates to every extracted memory (verified)
- Batched adds (5 parallel via Promise.allSettled) + batched Airtable update for `Supermemory Synced At`
- Skips candidates without LinkedIn URL

### Phase 7C: searchTalentPool Tool (DONE)
- Same file: `src/lib/tools/talent-pool.ts`
- Calls `client.search.memories({ containerTag: "talent-pool", q: query, threshold: 0.3, limit: 20, include: { documents: true } })`
- Groups results by `metadata.linkedin_url` (dedup - multiple memories from same candidate may match)
- Returns: name, title, role, hiring_company, fit_score, stage, score, airtable_record_id, linkedin_url, matching_memories (up to 3 snippets)
- Extracts candidate name from document title via `parseDocTitle()`

### Real Data Synced
- Deleted 3 test candidates from Supermemory
- Synced 34 real candidates (role: "Head of Design - Ninety"), 3 skipped (no LinkedIn URL)
- `Supermemory Synced At` timestamps updated in Airtable for all synced records
- Search against real data NOT YET TESTED

### Airtable Changes
- Created `Supermemory Synced At` field (singleLineText) via API
- Created `Last Modified Time` field (lastModifiedTime) manually in UI - auto-populates for all records
- New fields added by user: Resume (attachment), Phone (phoneNumber), Personal Website Password (singleLineText), Intake Notes (multilineText)
- Pipeline stages now include "Imported" as first stage

### Architecture Decisions (Important Context)
1. **Shared container, not per-candidate**: All candidates go into `containerTag: "talent-pool"`. Per-candidate isolation via `customId: "candidate-{slug}"`. This is because Supermemory's search only works WITHIN a container - you can't search globally across containers.
2. **Metadata propagation verified**: Every extracted memory carries the parent document's metadata (airtable_record_id, linkedin_url, role, etc.). This is how we identify candidates from search results.
3. **containerTags (plural) is deprecated** in the SDK. The `search.documents` with `containerTags` array still works but is being phased out.
4. **Daily batch sync pattern**: Query Airtable where `Last Modified Time > Supermemory Synced At` to find changed records. Re-sync only those.

### Docs Created/Updated
- `docs/supermemory/PHASE_7_SUPERMEMORY_PLAN.md` - Full plan with correct architecture
- `docs/supermemory/CANDIDATE_DATA_SCHEMA.md` - What we send, what we skip, token budget
- `docs/supermemory/PHASE_7_TALENT_POOL_PLAN.md` - Summary + tools evaluation
- `docs/AIRTABLE_SCHEMA.md` - All 55+ fields from actual table
- `docs/PHASE_6_UI_POLISH.md` - UI improvement plan (empty state, sidebar, JD card)

### Other Worktree Branches (Not Merged)
- `worktree-agent-a767a296` (commit `88f23ce`): Docs reorganization into subfolders (architecture/, research/, phases/, handoffs/, schema/). Has potential merge conflicts with schema doc updates. Cherry-pick when ready.

## Git State

- Branch: `feat/supermemory` (6 commits ahead of main)
- Main: up to date with feat/supermemory as of commit `facda57` (the Intake Notes commit `f693dfb` is only on feat/supermemory, not merged to main yet)
- Latest commits on feat/supermemory:
  ```
  f693dfb feat: add Intake Notes to talent pool sync + update docs
  facda57 feat: add searchTalentPool tool for talent pool matching
  096a715 feat: shared container architecture + updated docs
  9458d03 feat: supermemory SDK setup + Phase 7A test script
  fac3d7d feat: add syncToTalentPool tool for Supermemory talent pool
  ```
- All committed, nothing uncommitted

## Environment Variables

Set in both `.env.local` and Vercel production:
- `SUPERMEMORY_API_KEY` = `sm_e77t8qRobtMmumNs4RL7sD_jXA01qlomMVO3dlWqUFssgtVcV8SFZOJXZ4flB5AEr2yVlts5ZNVgDYrHDA92v7P`

## What's Next (In Order)

### 1. Search Verification (5 min)
Run `searchTalentPool` against the 34 real candidates with design-related queries. Verify correct candidates surface with metadata.

### 2. Phase 7D: Wire Into Chat Route (1-2 hours)
- Import and register `syncToTalentPool` + `searchTalentPool` in `src/app/api/chat/route.ts`
- Update `buildSystemPrompt()`:
  - Phase 1 intake: after JD fetch, call searchTalentPool before follow-up questions
  - End of pipeline: ask recruiter "Save to talent pool?" then call syncToTalentPool
- Optional: UI toggle near send button to enable/disable proactive talent pool search

### 3. Merge to Main
After 7D is verified, merge `feat/supermemory` to main and push.

### 4. Phase 7E: Recruiter Notes (defer)
When recruiter mentions something about a candidate in chat, agent saves it to talent pool.

### 5. Phase 7F: Backfill (defer)
One-time script to import candidates from other roles (currently only "Head of Design - Ninety" is synced).

### 6. Phase 7G: Daily Batch Sync (defer)
Vercel Cron or manual trigger to sync changed records.

### 7. Scoring System Improvements (separate track)
Current scoring rubric was built for outbound sourcing. For inbound applicants (candidates who applied with resumes + intake notes), it needs tightening:
- **Separate inbound rubric** with stricter criteria - candidates self-selected, so bar should be higher
- **Salary alignment dimension** - Intake Notes contain salary expectations, JD has comp range, but rubric doesn't score this
- **Work authorization** - currently buried in free-text Intake Notes, needs structured evaluation
- **Data source labeling** - Opus doesn't know what's verified (Apollo/EnrichLayer) vs self-reported (Intake Notes/resume)
- **Deduplication** - resume, Apollo employment history, and EnrichLayer experiences often repeat same roles, inflating signal
- **Missing data handling** - no guidance for Opus when portfolio is missing for design roles (35% of score)
- **DOCX resume support** - 5/37 candidates had .docx resumes that Claude API rejected (only accepts PDFs). Need to detect and either convert or skip gracefully
- **Inbound email flow** - need response emails for applicants (not cold outbound). Different tone: "thanks for applying" vs "hey I found your profile"

### 8. Phase 6: UI Polish (separate track)
Empty state, right sidebar JD card, sidebar polish. See `docs/PHASE_6_UI_POLISH.md`.

## Key Files

```
src/lib/tools/talent-pool.ts    # syncToTalentPool + searchTalentPool (455 lines)
scripts/test-supermemory.ts     # Phase 7A proof of concept test script
docs/supermemory/               # All Supermemory docs (plan, schema, talent pool)
docs/AIRTABLE_SCHEMA.md         # Complete Airtable field reference
```

## Supermemory State

- Container: `talent-pool` with 34 real candidates
- Each candidate has 5-10 extracted memories (facts)
- Metadata on every memory: type, airtable_record_id, linkedin_url, role, hiring_company, fit_score, stage
- Free tier usage: ~34 documents added, 0 searches used against real data yet
