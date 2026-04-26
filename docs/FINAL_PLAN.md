# OpenRecruiter v2: Final Consolidated Plan

## What We're Building

A Next.js chat app where a recruiter types a job description link + preferences, and the AI agent sources, enriches, discovers online presence, deep-analyzes GitHub/portfolio, scores holistically, drafts hyper-personalized emails, and runs drip campaigns. No VPS. No OpenClaw.

---

## Architecture

```
+---------------------------------------------------+
|  Next.js App (your-recruiter.vercel.app)          |
|                                                    |
|  +----------------------------------------------+ |
|  |  Chat Interface (Vercel AI SDK - useChat)    | |
|  |  Plain chat. Airtable open in separate tab.  | |
|  +----------------------------------------------+ |
|                                                    |
|  Backend: /api/chat/route.ts                      |
|  +-- Vercel AI SDK (streamText, useChat)          |
|  +-- @ai-sdk/anthropic (Claude Sonnet/Opus)       |
|  +-- Custom tool functions:                       |
|      +-- Apollo (REST)                            |
|      +-- EnrichLayer (REST)                       |
|      +-- PDL (REST)                               |
|      +-- GitHub GraphQL (REST)                    |
|      +-- Nia (REST + nia-ai-ts)                   |
|      +-- AgentMail (REST)                         |
|      +-- Airtable (REST)                          |
|      +-- Graphiti (REST to local Docker)          |
|                                                    |
|  /api/agentmail-webhook/route.ts                  |
|  +-- Auto-reply serverless function               |
|                                                    |
|  /api/drip/route.ts                               |
|  +-- Drip campaign follow-up (Vercel Cron)        |
+---------------------------------------------------+
         |
         v
+---------------------------------------------------+
|  Local Docker (dev) / Cloud (prod)                |
|  +-- Graphiti + Neo4j (knowledge graph)           |
+---------------------------------------------------+
```

---

## Happy Path: Full Pipeline

| # | Who | What Happens | API / Tool | Graphiti |
|---|---|---|---|---|
| | | **INTAKE** | | |
| 1 | Recruiter | Gives JD link + preferences: *"Source for https://eragon.ai/careers/ml-engineer. 5+ yrs ML, PyTorch, SF preferred, 20 candidates, outreach above 7/10."* | -- | -- |
| 2 | Agent | Fetches JD. Asks follow-ups: remote OK? company size? companies to avoid? salary range? must-haves? | `WebFetch` (Vercel AI SDK built-in) | -- |
| 3 | Recruiter | Answers preferences | -- | -- |
| 4 | Agent | Saves role + preferences to knowledge graph | `graphitiAddEpisode` (Graphiti REST) | Role entity created with all constraints |
| | | **SOURCING** | | |
| 5 | Agent | Searches for matching candidates | `apolloSearchPeople` (Apollo REST, FREE) | -- |
| 6 | Agent | Enriches all to get work emails | `apolloBulkEnrich` (Apollo REST, 1 credit/person) | -- |
| 7 | Agent | Deep enriches all via EnrichLayer: full job history, education, skills, certs | `enrichProfile` (EnrichLayer REST, 1 credit/person) | -- |
| 8 | Agent | Verifies work emails where Apollo email is missing or low-confidence | `enrichWorkEmail` (EnrichLayer REST, 3 credits/person) | -- |
| 9 | Agent | Saves all enriched candidates to Airtable + Graphiti | `airtableCreateRecord` (Airtable REST), `graphitiAddEpisode` (Graphiti REST) | Candidate entities created with full profiles |
| | | **TEST CHECKPOINT 1**: Verify Airtable has all candidates with enriched data | | |
| | | **GITHUB + PORTFOLIO DISCOVERY** | | |
| 10 | Agent | Finds GitHub profiles -- lookup chain: (1) PDL enrichment for github_username (2) GitHub GraphQL email search (3) Name-based fallback (4) Nia web search | `pdlEnrichPerson` (PDL REST, 1 credit), `githubSearchByEmail` (GitHub GraphQL, FREE), `niaWebSearch` (Nia REST, 1 credit) | -- |
| 11 | Agent | For candidates with GitHub: fetches websiteUrl, bio, profile README for portfolio/blog links | `githubFetchProfile` (GitHub GraphQL, FREE) | -- |
| 12 | Agent | For candidates WITHOUT GitHub: searches for portfolio/blog via Nia web search | `niaWebSearch` (Nia REST, 1 credit) | -- |
| 13 | Agent | Updates Airtable + Graphiti with all discovered links | `airtableUpdateStatus` (Airtable REST), `graphitiAddEpisode` (Graphiti REST) | Links added as facts on candidate entities |
| | | **TEST CHECKPOINT 2**: Verify Airtable shows GitHub + portfolio URLs | | |
| | | **NIA DEEP ANALYSIS** | | |
| 14 | Agent | Runs Nia Tracer (fast) on all candidates with GitHub repos | `niaTracer` (Nia REST, 15 credits/candidate, mode: tracer-fast) | -- |
| 15 | Agent | Runs Nia Tracer on portfolio/blog sites for candidates who have them | `niaTracer` (Nia REST, 15 credits/site) | -- |
| 16 | Agent | Updates Graphiti with Tracer analysis results | `graphitiAddEpisode` (Graphiti REST) | GitHub/portfolio analysis as facts on candidates |
| | | **TEST CHECKPOINT 3**: Verify Graphiti has analysis data, query a candidate | | |
| | | **SCORING** | | |
| 17 | Agent | Scores each candidate holistically: EnrichLayer profile + GitHub Tracer + portfolio analysis + JD match. Uses `.claude/skills/scoring-rubric.md` | Claude Opus 4.6 reasoning (Anthropic API) | -- |
| 18 | Agent | Updates Airtable with scores + analysis notes. Updates Graphiti with assessments. | `airtableUpdateStatus` (Airtable REST), `graphitiAddEpisode` (Graphiti REST) | Assessment entities linked to candidates + role |
| 19 | Agent | Presents results table. Asks: *"14 candidates scored 7+. Shall I prepare outreach for them?"* | -- | -- |
| | | **TEST CHECKPOINT 4**: Verify Airtable scores, check scoring quality | | |
| | | **OUTREACH (DRAFT FIRST)** | | |
| 20 | Recruiter | *"Prepare outreach for the 8+ candidates. I'll review before sending."* | -- | -- |
| 21 | Agent | Generates hyper-personalized email per candidate using all enrichment + analysis data. Uses `.claude/skills/outreach-style.md` | Claude Sonnet 4.6 reasoning (Anthropic API) | -- |
| 22 | Agent | Creates drafts in AgentMail (NOT sent). Stores draft content in Airtable notes field. | `agentmailCreateDraft` (AgentMail REST) | `addEpisode`: draft outreach logged |
| 23 | Agent | *"8 drafts ready. Review in Airtable or here. Say 'send all' or review individually."* | -- | -- |
| | | **TEST CHECKPOINT 5**: Verify drafts in AgentMail, check email quality | | |
| | | **SEND + DRIP SETUP** | | |
| 24 | Recruiter | Reviews. *"Send all 8."* | -- | -- |
| 25 | Agent | Sends all via AgentMail. Updates Airtable to "Contacted". Schedules drip follow-ups per `.claude/skills/drip-sequence.md` (Day 3, Day 7). | `agentmailSendEmail` (AgentMail REST), `airtableUpdateStatus` (Airtable REST) | `addEpisode`: outreach sent + drip scheduled |
| 26 | Agent | *"8 sent. Drip follow-ups: Day 3 + Day 7. Pipeline updated."* | -- | -- |
| | | **TEST CHECKPOINT 6**: Verify emails received, Airtable shows "Contacted" | | |
| | | **AUTO-REPLY + DRIP** | | |
| 27 | Candidate | Replies to email | -- | -- |
| 28 | Webhook | `/api/agentmail-webhook` fires. Generates contextual reply using Graphiti context. Sends in same thread. Updates Airtable to "Replied". | Claude API (Anthropic), AgentMail REST, Airtable REST, `graphitiSearchNodes` + `graphitiAddEpisode` (Graphiti REST) | Reply + auto-response logged |
| 29 | Cron | Day 3: Drip follow-up #1 fires for non-responders | `/api/drip/route.ts` via Vercel Cron, AgentMail REST, Airtable REST | `addEpisode`: follow-up #1 sent |
| 30 | Cron | Day 7: Drip follow-up #2 (final) fires for still-silent candidates | Same as above | `addEpisode`: follow-up #2 sent |
| | | **TEST CHECKPOINT 7**: Verify auto-reply works, drip fires on schedule | | |
| | | **PIPELINE CHECK-IN** | | |
| 31 | Recruiter | *"Pipeline status for Eragon ML?"* | -- | -- |
| 32 | Agent | Queries Graphiti (temporal history) + Airtable (current status) | `graphitiSearchFacts` + `graphitiSearchNodes` (Graphiti REST), `airtableGetPipeline` (Airtable REST) | -- |
| 33 | Agent | *"8 contacted. 3 replied. 1 clicked screening link. 5 in drip. Recommend: deep research on Priya, reply to Marcus re: remote..."* | -- | -- |

---

## All Tool Functions (With Exact APIs)

### Apollo Tools (REST: `https://api.apollo.io/v1/`)

| Tool Function | Endpoint | Method | Credits |
|---|---|---|---|
| `apolloSearchPeople` | `/mixed_people/api_search` | POST | FREE |
| `apolloEnrichPerson` | `/people/match` | POST | 1 |
| `apolloBulkEnrich` | `/people/bulk_match` | POST | 1/person |
| `apolloCreateContact` | `/contacts` | POST | FREE |

### EnrichLayer Tools (REST: `https://enrichlayer.com/api/v2/`)

| Tool Function | Endpoint | Method | Credits |
|---|---|---|---|
| `enrichProfile` | `/profile?profile_url=<linkedin>` | GET | 1 (+extras) |
| `enrichWorkEmail` | `/profile/email?profile_url=<linkedin>` | GET | 3 |
| `enrichPersonalEmail` | `/contact-api/personal-email?profile_url=<linkedin>` | GET | 1/email |
| `enrichPersonalPhone` | `/contact-api/personal-contact?profile_url=<linkedin>` | GET | 1/number |
| `enrichRoleLookup` | `/find/company/role/?role=X&company_name=Y` | GET | 3 |
| `enrichReverseEmail` | `/profile/resolve/email?email=X` | GET | 3 |

### PDL Tools (REST: `https://api.peopledatalabs.com/v5/`)

| Tool Function | Endpoint | Method | Credits |
|---|---|---|---|
| `pdlEnrichPerson` | `/person/enrich?profile=<linkedin>&email=<email>` | GET | 1 |

Returns: `github_url`, `github_username`, `profiles[]`, `websites[]`, `facebook_url`, `twitter_url`

### GitHub Tools (GraphQL: `https://api.github.com/graphql`)

| Tool Function | What It Does | Cost |
|---|---|---|
| `githubSearchByEmail` | `search(query: "email in:email", type: USER)` -- returns login, url, websiteUrl, bio | FREE (5000/hr) |
| `githubSearchByName` | Fallback: `search(query: "name", type: USER)` | FREE |
| `githubFetchProfile` | Get websiteUrl, bio, README from username | FREE |
| `githubFetchReadme` | `GET /repos/{user}/{user}/readme` -- parse for portfolio links | FREE |

### Nia Tools (REST: `https://apigcp.trynia.ai/v2/`)

| Tool Function | Endpoint | Method | Credits |
|---|---|---|---|
| `niaWebSearch` | `/search` (mode: web) | POST | 1 |
| `niaTracer` | `/github/tracer` (create) + `/{id}/stream` (SSE) | POST + GET | 15 |
| `niaOracle` | `/oracle/jobs` (create) + `/{id}` (poll) | POST + GET | 15 |
| `niaExtract` | `/extract/detect` (create) + `/{id}` (poll) | POST + GET | ~5 |

### AgentMail Tools (REST: `https://api.agentmail.to/v0/`)

| Tool Function | Endpoint | Method | Cost |
|---|---|---|---|
| `agentmailCreateDraft` | `/inboxes/{id}/drafts` | POST | Included |
| `agentmailSendDraft` | `/inboxes/{id}/drafts/{id}/send` | POST | Included |
| `agentmailSendEmail` | `/inboxes/{id}/messages` | POST | Included |
| `agentmailReplyInThread` | `/inboxes/{id}/messages` (with thread_id) | POST | Included |
| `agentmailListMessages` | `/inboxes/{id}/messages` | GET | Included |

### Airtable Tools (REST: `https://api.airtable.com/v0/{baseId}/{table}`)

| Tool Function | What It Does | Cost |
|---|---|---|
| `airtableCreateRecord` | Add candidate with all fields | FREE |
| `airtableUpdateStatus` | Update pipeline stage, scores, notes, draft email | FREE |
| `airtableFindByEmail` | Lookup by email (filterByFormula) | FREE |
| `airtableGetPipeline` | Get all candidates for a role (view filter) | FREE |

### Graphiti Tools (REST: `http://localhost:8000/` or cloud endpoint)

| Tool Function | Endpoint | What It Does |
|---|---|---|
| `graphitiAddEpisode` | `/mcp/` tool: `add_episode` | Ingest text -- auto-extracts entities + relations |
| `graphitiSearchNodes` | `/mcp/` tool: `search_nodes` | Find entities by semantic query |
| `graphitiSearchFacts` | `/mcp/` tool: `search_facts` | Find relationships with temporal context |
| `graphitiGetEpisodes` | `/mcp/` tool: `get_episodes` | Get recent episodes by group |

---

## Skill / MD Files

| File | Purpose |
|---|---|
| `.claude/skills/scoring-rubric.md` | How to score candidates. Weights per role type (engineering, design, PM). Factors: experience, company quality, skill overlap, GitHub code quality, portfolio depth, education. Scale 1-10 with examples. |
| `.claude/skills/outreach-style.md` | Hyper-personalized email guide. Reference specific candidate work (GitHub projects, portfolio pieces, papers). Tone: warm, direct, no corporate fluff. Structure: hook (specific to them), role pitch (2 sentences), CTA. Max 150 words. |
| `.claude/skills/drip-sequence.md` | Follow-up cadence. Day 3: gentle bump, different angle. Day 7: value-add (team info, recent news). Day 14: break-up email. When to stop. Templates per stage. |
| `.claude/skills/follow-up-questions.md` | What to ask recruiter before sourcing. Role-specific questions. Preferences to capture. |
| `.claude/skills/auto-reply-guide.md` | How to handle candidate replies. Interested: share screening link + enthusiasm. Questions: answer + re-engage. Not interested: thank gracefully, ask for referrals. Timing: respond within minutes. |
| `CLAUDE.md` | Master instructions: full pipeline steps, tool usage order, Graphiti logging at every step, approval gates (enrichment credits, sending emails), never send without recruiter approval. |

---

## Graphiti Involvement at Every Step

| Step | Episode Logged | Entities/Relations Created |
|---|---|---|
| Role created | Role details + constraints + preferences | Company --has_role--> Role |
| Candidate sourced | Apollo + EnrichLayer profile data | Candidate entity, Candidate --sourced_for--> Role |
| Links discovered | GitHub URL, portfolio, blog, social links | Facts on Candidate entity |
| GitHub analyzed | Tracer results: code quality, projects, skills | Assessment --evaluates--> Candidate |
| Portfolio analyzed | Portfolio analysis: design quality, writing, projects | Facts on Candidate entity |
| Score assigned | Score + reasoning | Assessment entity, Assessment --for_role--> Role |
| Draft created | Email content + personalization notes | Interaction --drafted_for--> Candidate |
| Email sent | Sent timestamp, subject, thread ID | Interaction --sent_to--> Candidate |
| Reply received | Reply content + sentiment | Interaction --reply_from--> Candidate |
| Follow-up sent | Follow-up #, content, timestamp | Interaction --followup_to--> Candidate |
| Status changed | Stage transition + timestamp | Temporal fact validity updated |
| Cross-role dedup | Candidate linked to multiple roles | Candidate --contacted_for--> Role (with dates) |

---

## Implementation Phases (With Parallel Worktrees + Test Checkpoints)

### PHASE 1: Foundation (Days 1-2)

Build the Next.js app skeleton + first two tool integrations. Test sourcing.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 1A | `npx create-next-app openrecruiter-v2 --typescript --app`. Install `ai`, `@ai-sdk/anthropic`, `zod`. Build `/api/chat/route.ts` skeleton + basic `useChat` frontend (plain chat: input box, message list, streaming). | -- | Chat sends message, gets Claude response |
| 1B | Build Apollo tool functions (`apolloSearchPeople`, `apolloBulkEnrich`). Wire into chat route. | After 1A | *"Find ML engineers in SF"* returns candidate list in chat |
| 1C | Build Airtable tool functions (`airtableCreateRecord`, `airtableUpdateStatus`, `airtableFindByEmail`, `airtableGetPipeline`). Set up Airtable base with fields. | Parallel with 1B (worktree) | Candidates appear in Airtable (open in separate tab) |

**TEST CHECKPOINT 1:** Type *"Find 5 ML engineers in SF"* in chat. Candidates appear in Airtable (separate tab). Scores are empty (not enriched yet).

---

### PHASE 2: Enrichment (Days 3-4)

Add EnrichLayer + PDL enrichment. Test full profile data.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 2A | Build EnrichLayer tool functions (`enrichProfile`, `enrichWorkEmail`). Wire into chat route. | -- | Full LinkedIn data returns for a candidate |
| 2B | Build PDL tool function (`pdlEnrichPerson`). Wire into chat route. | Parallel with 2A (worktree) | Returns github_username, profiles[], websites[] |
| 2C | Build GitHub tool functions (`githubSearchByEmail`, `githubFetchProfile`, `githubFetchReadme`). Wire into chat route. | Parallel with 2A (worktree) | Finds GitHub profile from email, returns websiteUrl + bio |
| 2D | Wire the full enrichment chain: Apollo search -> Apollo enrich -> EnrichLayer -> PDL -> GitHub lookup. Agent runs them in sequence. | After 2A+2B+2C | Full pipeline: search returns candidates with emails, full profiles, GitHub URLs |

**TEST CHECKPOINT 2:** Type *"Source and enrich 5 ML engineers"*. Airtable shows full profiles + GitHub URLs + portfolio links.

---

### PHASE 3: Nia Deep Analysis + Scoring (Days 5-6)

Add Nia Tracer + scoring. Test GitHub analysis quality.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 3A | Build Nia tool functions (`niaWebSearch`, `niaTracer`). Wire into chat route. Handle SSE streaming + polling. | -- | Tracer returns analysis of a GitHub repo |
| 3B | Write `.claude/skills/scoring-rubric.md`. Define scoring weights, examples, role-type variations. | Parallel with 3A (worktree) | -- |
| 3C | Wire the full analysis chain: GitHub/portfolio discovery -> Nia Tracer on repos -> Nia Tracer on portfolio -> holistic scoring using rubric. | After 3A+3B | Agent scores candidates with GitHub data factored in |
| 3D | Update Airtable + Graphiti with scores and analysis notes. | After 3C | Airtable shows scores, Graphiti has assessment entities |

**TEST CHECKPOINT 3:** Type *"Source 10 ML engineers, find their GitHub, analyze and score them"*. Airtable shows scores. Ask *"Why did you score Jane 8/10?"* -- agent pulls from Graphiti.

---

### PHASE 4: Knowledge Graph (Days 5-6, parallel with Phase 3)

Set up Graphiti. Add logging at every step.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 4A | Start Graphiti + Neo4j via Docker Compose. Configure entity types (Company, Role, Candidate, Interaction, Assessment). | Parallel with Phase 3 (worktree) | `docker compose up` works, MCP endpoint responds |
| 4B | Build Graphiti tool functions (`graphitiAddEpisode`, `graphitiSearchNodes`, `graphitiSearchFacts`). Wire into chat route. | After 4A | Can add and search episodes |
| 4C | Add `graphitiAddEpisode` calls at every pipeline step (sourcing, enrichment, link discovery, analysis, scoring). | After 4B + Phase 3 done | Every action logged to graph |
| 4D | Test cross-role dedup: source for two different roles, verify agent detects overlap. | After 4C | *"Have we contacted Jane before?"* returns history |

**TEST CHECKPOINT 4:** Run full pipeline. Then ask *"Show me everything we know about Jane Doe"* -- Graphiti returns full temporal history. Ask *"Have we contacted anyone at Datadog?"* -- returns cross-role matches.

---

### PHASE 5: Outreach (Days 7-8)

Add AgentMail drafts + sending + Airtable draft storage.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 5A | Build AgentMail tool functions (`agentmailCreateDraft`, `agentmailSendDraft`, `agentmailSendEmail`, `agentmailReplyInThread`). Create inbox. | -- | Draft created in AgentMail |
| 5B | Write `.claude/skills/outreach-style.md`. Email personalization guide with examples. | Parallel with 5A (worktree) | -- |
| 5C | Wire outreach flow: agent generates email per candidate -> creates AgentMail draft -> stores draft text in Airtable notes -> asks recruiter to approve -> sends on approval. | After 5A+5B | Drafts visible in Airtable, sent on command |
| 5D | Log outreach to Graphiti (draft created, email sent). | After 5C | Outreach history in graph |

**TEST CHECKPOINT 5:** Run full pipeline through scoring. Say *"Prepare outreach for 8+ candidates"*. Verify drafts in Airtable. Say *"Send all"*. Verify emails arrive. Check Graphiti has outreach logged.

---

### PHASE 6: Auto-Reply + Drip (Days 9-10)

Add webhook for replies + scheduled drip follow-ups.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 6A | Build `/api/agentmail-webhook/route.ts`. Handle `message.received` events. Call Claude for contextual reply. Send via AgentMail. Update Airtable to "Replied". Log to Graphiti. | -- | Reply to a sent email, verify auto-reply comes back |
| 6B | Write `.claude/skills/drip-sequence.md`. Follow-up templates for Day 3, Day 7, Day 14. | Parallel with 6A (worktree) | -- |
| 6C | Write `.claude/skills/auto-reply-guide.md`. How to handle interested/not interested/questions. | Parallel with 6A (worktree) | -- |
| 6D | Build `/api/drip/route.ts` + Vercel Cron config. Checks Airtable for candidates in "Contacted" status for >3 days with no reply. Sends follow-up via AgentMail. | After 6A+6B | Cron fires, follow-up sent to non-responders |
| 6E | Register AgentMail webhook (one-time curl). | After 6A deployed | Webhook fires on reply |

**TEST CHECKPOINT 6:** Send outreach to yourself. Reply. Verify auto-reply arrives with screening link. Wait for drip (or manually trigger cron). Verify follow-up sent. Check Airtable shows "Replied" / drip status. Check Graphiti has full interaction history.

---

### PHASE 7: Polish + Skills (Days 11-12)

Write all skill files. Improve prompts. Deploy.

| Task | What | Parallel? | Test |
|---|---|---|---|
| 7A | Write `CLAUDE.md` master instructions. Full pipeline steps, tool order, Graphiti logging rules, approval gates. | -- | Agent follows correct pipeline order |
| 7B | Write `.claude/skills/follow-up-questions.md`. What to ask before sourcing. | Parallel with 7A (worktree) | Agent asks good questions at step 2 |
| 7C | Add Nia Oracle for deep research on finalists (`niaOracle` tool). | Parallel with 7A (worktree) | *"Deep research on Priya"* returns comprehensive report |
| 7D | Add EnrichLayer role lookup for warm intros (`enrichRoleLookup`). | Parallel with 7A (worktree) | Finds hiring manager by role at company |
| 7E | Deploy to Vercel. Configure env vars. Test full pipeline end-to-end on production. | After all above | Production URL works |

**FINAL TEST:** Full end-to-end on production. Source 10 candidates -> enrich -> discover GitHub/portfolio -> Nia Tracer -> score -> draft emails -> approve -> send -> receive reply -> auto-reply -> drip follow-up. Verify Airtable pipeline, Graphiti knowledge graph, and AgentMail threads all consistent.

---

## Phase Summary Table

| Phase | Days | What | Parallel Worktrees | Test Checkpoint |
|---|---|---|---|---|
| **1: Foundation** | 1-2 | Next.js chat app + Apollo + Airtable tools | 1B+1C in parallel | Search returns candidates in Airtable (separate tab) |
| **2: Enrichment** | 3-4 | EnrichLayer + PDL + GitHub lookup | 2A+2B+2C in parallel | Full profiles + GitHub URLs in Airtable |
| **3: Analysis + Scoring** | 5-6 | Nia Tracer + scoring rubric | 3A+3B in parallel | Candidates scored with GitHub analysis |
| **4: Knowledge Graph** | 5-6 | Graphiti + Neo4j + logging | Parallel with Phase 3 | Temporal queries work, dedup works |
| **5: Outreach** | 7-8 | AgentMail drafts + send + email style | 5A+5B in parallel | Drafts in Airtable, emails sent on approval |
| **6: Auto-Reply + Drip** | 9-10 | Webhook + cron + drip templates | 6A+6B+6C in parallel | Auto-reply works, drip fires on schedule |
| **7: Polish** | 11-12 | Skills, CLAUDE.md, Oracle, deploy | 7A+7B+7C+7D in parallel | Full E2E on production |

---

## Monthly Costs

| Item | Cost |
|---|---|
| Anthropic API (Sonnet + Opus for scoring) | $40-180 |
| Apollo.io (Basic) | $49 |
| EnrichLayer (Pay-as-you-go) | $10-50 |
| PDL (Free 100/mo or Pro $98/mo) | $0-98 |
| Nia (Builder) | $15 |
| AgentMail (Developer) | $20 |
| Airtable (Free tier) | $0 |
| Graphiti + Neo4j (self-hosted Docker) | $0 |
| Vercel (free tier) | $0 |
| **Total** | **$135-415/mo** |

---

## Files in This Folder

| File | Contents |
|---|---|
| `ARCHITECTURE.md` | System architecture, tool comparison, memory design |
| `IMPLEMENTATION_PLAN.md` | Original step-by-step build plan (MCP-focused, superseded) |
| `ENRICHMENT_AND_NIA.md` | EnrichLayer + Nia API reference, enrichment pipeline |
| `RUNTIME_DECISION.md` | Cowork vs Desktop vs CLI comparison |
| `FINAL_PLAN.md` | This file -- the final consolidated plan |
