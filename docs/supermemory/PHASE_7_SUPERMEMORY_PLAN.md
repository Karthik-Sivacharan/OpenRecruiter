# Phase 7: Talent Pool Memory (Supermemory)

> Date: 2026-04-30
> Updated: 2026-04-30 (architecture correction - shared container, not per-candidate)

## Decision

Supermemory over Mem0 because:
- Graph memory (Update/Extends/Derives relationships) included on free tier (Mem0 charges $249/mo)
- Native Vercel AI SDK integration (@supermemory/tools/ai-sdk)
- 10K searches/mo free vs Mem0's 1K
- Advanced metadata filtering (nested AND/OR, numeric operators)
- PDF/URL content processing built-in (resumes later)

## How It Works (Simple English)

1. Every time the pipeline finishes (drafts written, stages updated), we save each candidate's full profile into a shared Supermemory "talent-pool" container
2. Supermemory extracts facts from each profile ("James knows Go and distributed systems", "Sarah wants remote work") and builds a knowledge graph connecting them
3. Each candidate is identified by a customId (their LinkedIn slug) so their memories are grouped
4. When a new JD comes in, we search the talent-pool container - Supermemory finds semantically matching memories across ALL candidates in one call
5. Each result carries metadata (airtable_record_id, linkedin_url, role, fit_score) so we can identify who the match is and look them up
6. When a recruiter adds notes ("Sarah wants remote"), those get added to the talent pool too
7. When data changes (job change, re-enrichment), re-adding to the same customId triggers Update relationships - old facts are preserved in history

## Architecture

```
Pipeline runs (source, enrich, score, draft outreach)
  |
  v
Agent asks: "Save these candidates to your talent pool?"
  |
  v
syncToTalentPool tool (fetches from Airtable, sends to Supermemory)
  - containerTag: "talent-pool" (shared for ALL candidates)
  - customId: "candidate-{linkedin-slug}" (groups memories per candidate)
  - metadata: { role, fit_score, stage, linkedin_url, airtable_record_id }
  |
  v
Supermemory API (hosted, no infra)
  - Extracts facts from profile text
  - Builds graph relationships (Update/Extends/Derives)
  - Indexes for semantic search
  |
  v
New JD comes in -> searchTalentPool tool
  - search.memories({ containerTag: "talent-pool", q: jd_summary })
  - Returns matching memories with metadata
  - Agent uses airtable_record_id to identify candidates
  |
  v
Agent presents: "Found 3 past candidates who match this role"
```

## Data Model

### Container Strategy

All candidates share ONE container. This is how Supermemory is designed to work - containerTag represents the "user" of the system (the recruiter/talent pool), not the entities being stored.

```
containerTag: "talent-pool"        # shared for all candidates
customId: "candidate-{linkedin-slug}"  # groups memories per candidate
```

### Metadata (per document add)
```json
{
  "type": "candidate_profile",
  "airtable_record_id": "rec5OztHXgm6JN96s",
  "linkedin_url": "https://linkedin.com/in/sarah-chen-a1b2c3",
  "role": "ml-engineer-ramp",
  "hiring_company": "Ramp",
  "fit_score": "8",
  "stage": "scored"
}
```

Metadata propagates to every extracted memory. Verified: when searching, each result carries the full metadata from its parent document including airtable_record_id and linkedin_url.

### Profile Content (what we send as text)

Full version (~800-1500 tokens per candidate). See CANDIDATE_DATA_SCHEMA.md for complete field list.

Includes: Name, Title, Company, Location, Skills, Education, Employment History, EnrichLayer Experiences, Certifications, Languages, Summary, plus Recruiting Context (Role, Hiring Company, Fit Score, Fit Rationale, Pipeline Stage, Recruiter Notes).

### Graph Relationships (auto-built by Supermemory)

- **Updates**: "Sarah works at Stripe" gets superseded by "Sarah moved to Notion" - old fact preserved in history
- **Extends**: "Sarah has 8 years experience" supplements "Sarah is a Staff ML Engineer" - both remain queryable
- **Derives**: System infers connections from combining profile + recruiter notes

## Search Flow

### How search.memories works with shared container

```typescript
const results = await client.search.memories({
  q: "backend engineer distributed systems Go fintech",
  containerTag: "talent-pool",
  threshold: 0.3,
  limit: 10,
  include: { documents: true },
});

// Each result:
// {
//   memory: "James Park's technical skills include Go, Rust, distributed systems...",
//   similarity: 0.724,
//   metadata: {
//     airtable_record_id: "rec123",
//     linkedin_url: "https://linkedin.com/in/james-park",
//     role: "backend-engineer-notion",
//     fit_score: "6",
//     stage: "contacted"
//   },
//   documents: [{ title: "Candidate Profile: James Park..." }]
// }
```

One call. No tag arrays. Scales to thousands of candidates.

### Identifying candidates from results

- `metadata.airtable_record_id` - direct lookup key for full Airtable data
- `metadata.linkedin_url` - unique candidate identifier for dedup
- `documents[0].title` - human-readable name ("Candidate Profile: James Park...")
- `memory` text itself contains the candidate's name

### Dedup in results

Multiple memories from the same candidate may match. Group results by `metadata.linkedin_url` or `metadata.airtable_record_id` to present one entry per candidate.

## Implementation Phases

### Phase 7A: Setup + Proof of Concept - DONE

- Supermemory account created, API key set
- SDK installed: `supermemory`, `@supermemory/tools`
- Verified: add, search.memories (per-container), search.documents (cross-container), profile
- Test script: `scripts/test-supermemory.ts`
- Key finding: containerTag is a FILTER, not a partition. Omitting it returns 0 results. Must always pass a containerTag.

### Phase 7B: syncToTalentPool Tool - DONE

File: `src/lib/tools/talent-pool.ts`

- Self-serving: takes `{ role }`, fetches from Airtable internally
- Sends each candidate to shared `talent-pool` container with `customId: candidate-{slug}`
- Full profile content + metadata with airtable_record_id and linkedin_url
- Batched adds (5 parallel) + batched Airtable update for Supermemory Synced At
- Skips candidates without LinkedIn URL

### Phase 7C: searchTalentPool Tool - NEXT

- Input: `{ query: string }`
- Calls `client.search.memories({ containerTag: "talent-pool", q: query, include: { documents: true } })`
- Groups results by linkedin_url (dedup)
- Returns: `{ results: [{ name, title, company, role, fit_score, stage, airtable_record_id, memory_snippet, score }] }`
- Agent presents matches to recruiter with context

### Phase 7D: Wire Into Chat Route

- Register both tools in route.ts
- Update buildSystemPrompt():
  - Phase 1: after JD fetch, call searchTalentPool before follow-up questions
  - End of pipeline: ask recruiter "Save to talent pool?" then call syncToTalentPool
- Optional: UI toggle near send button to enable/disable proactive talent pool search

### Phase 7E: Recruiter Notes (can defer)

When recruiter mentions something about a candidate:
- Agent calls addMemory with containerTag: "talent-pool", customId: candidate slug
- Memory gets linked to candidate via Extends relationship

### Phase 7F: Backfill Existing Data (can defer)

One-time script to import all existing Airtable candidates into talent pool.

### Phase 7G: Daily Batch Sync (can defer)

Query Airtable for records where Last Modified Time > Supermemory Synced At. Re-sync changed records only.

## Airtable Fields for Sync Tracking

| Field | Type | Purpose |
|-------|------|---------|
| Supermemory Synced At | singleLineText | ISO timestamp of last sync |
| Last Modified Time | lastModifiedTime | Auto-updated by Airtable on any change |

Daily batch filter: records where Synced At is blank OR Last Modified Time > Synced At.

## Environment Variables

```
SUPERMEMORY_API_KEY=sm_xxx    # from console.supermemory.ai
```

Only new env var needed. Set in .env.local and Vercel production.

## Cost

| Item | Cost |
|------|------|
| Supermemory Free | $0 |
| Infrastructure | $0 (hosted API) |
| LLM/embeddings | $0 (included) |
| **Total** | **$0/month** |

Free tier: 1M tokens/mo, 10K searches/mo. Upgrade to Pro ($19/mo) if exceeded.

## Key Files

```
CREATED:
  src/lib/tools/talent-pool.ts    # syncToTalentPool (done) + searchTalentPool (next)
  scripts/test-supermemory.ts     # Phase 7A proof of concept

TO MODIFY:
  src/app/api/chat/route.ts       # Register tools, update system prompt
  .claude/rules/recruiting-pipeline.md  # Add talent pool steps
```
