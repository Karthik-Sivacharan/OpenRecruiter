# Recruiting Pipeline Rules

## The Full Flow (5 Phases)

### Phase 1: INTAKE (Requires Recruiter Input)

1. Recruiter gives JD link or text + any initial preferences
2. Agent fetches JD if URL provided
3. Agent asks follow-up questions using `.claude/skills/follow-up-questions/` skill
   - Batch 1: Must-have skills, experience level, location, candidate count
   - Batch 2: Company preferences, salary range, outreach threshold, timeline
4. Wait for recruiter to answer before proceeding
5. Save role + all preferences to Graphiti

### Phase 2: AUTONOMOUS PIPELINE (No Pauses — Agent Runs Everything)

The agent runs this entire chain without stopping to ask. Just do it.

**Sourcing:**
1. `apollo_mixed_people_api_search` -> get candidate list
2. `apollo_people_bulk_match` (batches of 10) -> get emails
3. `enrichProfile` via EnrichLayer -> full LinkedIn data
4. `enrichWorkEmail` via EnrichLayer -> verified work email (only if Apollo email missing)

**GitHub/Portfolio Discovery:**
5. `pdlEnrichPerson` via PDL -> check for github_username, profiles[], websites[]
6. `githubSearchByEmail` via GitHub GraphQL -> find GitHub from email
7. If no GitHub: `githubSearchByName` -> name-based fallback
8. If still no GitHub: `niaWebSearch` -> web search for GitHub/portfolio
9. `githubFetchProfile` -> get websiteUrl, bio, README for portfolio links

**Analysis + Scoring:**
10. `niaTracer` on GitHub repos -> deep code analysis
11. `niaTracer` on portfolio/blog sites -> portfolio analysis
12. Score each candidate using `.claude/skills/scoring-rubric/` (internally calls Opus 4.6)

**Draft Outreach:**
13. Generate personalized email per candidate using `.claude/skills/outreach-style/`
14. `agentmailCreateDraft` -> create draft in AgentMail (NOT sent)

**Write Everything to Airtable:**
15. Create/update a row per candidate in Airtable with ALL data:
    - Name, title, company, email, LinkedIn URL
    - GitHub URL, portfolio URL, social links
    - Nia Tracer analysis summary
    - Score (1-10) + scoring rationale
    - Draft outreach email text
    - Pipeline stage: "Draft Ready"

### Phase 3: RECRUITER REVIEW (Pause and Wait)

16. Agent tells recruiter: "Done. [N] candidates sourced, enriched, and scored. Draft emails ready. Go take a look in Airtable."
17. Provide a summary table in chat: name, score, title, company (sorted by score descending)
18. Wait for recruiter to review in Airtable
19. Ask: "Want to send all outreach, or pick specific candidates?"

### Phase 4: SEND + DRIP SETUP (Requires Approval)

**Sending (recruiter controls this):**
20. Recruiter says "send all" -> send all drafts via AgentMail
21. OR recruiter picks specific candidates -> send only those
22. OR recruiter can manually send via AgentMail themselves
23. Update Airtable stage to "Contacted" for each sent email
24. Log each sent email to Graphiti

**Drip Campaign Setup (confirm before scheduling):**
25. Agent proposes drip campaign details:
    - "I'll set up follow-ups for [N] candidates: Day 3 gentle bump, Day 7 value-add, Day 14 break-up email. Sound good?"
    - Include any customization the recruiter mentioned in intake
26. Wait for recruiter confirmation
27. On approval: schedule drip via Vercel Cron per `.claude/skills/drip-sequence/`
28. Log drip setup to Graphiti

### Phase 5: AUTO-REPLY (Always Running, No Recruiter Needed)

**How auto-reply works:**
- AgentMail webhook fires on candidate reply -> hits `/api/agentmail-webhook/route.ts`
- Webhook handler reads the candidate's Airtable row for full context:
  - Their profile, score, scoring rationale, draft email sent, role details
- Generates contextual reply using `.claude/skills/auto-reply-guide/` (Sonnet 4.6)
- Sends reply in same AgentMail thread
- Updates Airtable row: stage -> "Replied", adds reply content to notes
- Logs interaction to Graphiti

**Airtable is the source of truth for auto-replies.** Each candidate row has everything the auto-reply handler needs. No separate database.

---

## Approval Gates

Only pause for recruiter approval on:
- **Sending outreach emails** (Phase 4 — recruiter chooses send all, pick specific, or manual)
- **Drip campaign scheduling** (Phase 4 — confirm cadence before scheduling)

Everything else (sourcing, enrichment, analysis, scoring, drafting): just run it.

---

## Graphiti Logging

Log to Graphiti at EVERY step:
- Role created -> `add_episode` with role details + constraints
- Candidate sourced -> `add_episode` with Apollo + EnrichLayer profile
- Links discovered -> `add_episode` with GitHub URL, portfolio, social links
- Analysis complete -> `add_episode` with Tracer results
- Score assigned -> `add_episode` with score + reasoning
- Email drafted -> `add_episode` with draft content
- Email sent -> `add_episode` with timestamp, thread ID
- Reply received -> `add_episode` with content + sentiment
- Follow-up sent -> `add_episode` with follow-up number + content

## Airtable Schema (Per Candidate Row)

| Field | Type | Source |
|-------|------|--------|
| Name | Text | Apollo |
| Email | Email | Apollo / EnrichLayer |
| Title | Text | Apollo / EnrichLayer |
| Company | Text | Apollo / EnrichLayer |
| LinkedIn URL | URL | Apollo |
| GitHub URL | URL | PDL / GitHub search |
| Portfolio URL | URL | PDL / Nia search |
| Nia Analysis | Long text | Nia Tracer |
| Score | Number (1-10) | Opus 4.6 scoring |
| Score Rationale | Long text | Opus 4.6 scoring |
| Draft Email Subject | Text | Sonnet 4.6 |
| Draft Email Body | Long text | Sonnet 4.6 |
| AgentMail Thread ID | Text | AgentMail (after send) |
| Pipeline Stage | Select | Auto-updated |
| Role | Text | From intake |
| Reply Content | Long text | AgentMail webhook |
| Notes | Long text | Running log |

## Attio Pipeline Stages

Draft Ready -> Contacted -> Replied -> Screened -> Intro'd -> Declined

## Model Routing Strategy

The chat agent (orchestrator) always runs on **Sonnet 4.6**. Individual tool implementations use different models internally for cost optimization.

| Pipeline Step | Orchestrator | Internal Model | Why |
|---|---|---|---|
| Sourcing (Apollo search, enrich) | Sonnet 4.6 | None (pure API calls) | No LLM needed, just REST calls |
| Enrichment (EnrichLayer, PDL) | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| GitHub/Portfolio Discovery | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| Nia Tracer Analysis | Sonnet 4.6 | None (Nia does the analysis) | Nia's own AI handles it |
| **Candidate Scoring** | Sonnet 4.6 | **Opus 4.6** | Best reasoning for nuanced fit assessment |
| Email Drafting | Sonnet 4.6 | Sonnet 4.6 | Needs good writing quality |
| CRM Updates (Airtable) | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| Auto-Reply Generation | -- | Sonnet 4.6 | Runs via webhook, reads Airtable for context |
| Drip Follow-ups | -- | Sonnet 4.6 | Runs via Vercel Cron |

### Model IDs
- **Sonnet 4.6**: `claude-sonnet-4-6-20250514` (orchestrator + writing)
- **Opus 4.6**: `claude-opus-4-6-20250626` (scoring only)
- **Haiku 4.5**: `claude-haiku-4-5-20251001` (reserved for future batch operations)

### Cost Estimate Per Session (~$0.25)
- Sonnet 4.6 orchestration: ~$0.20 (50k input, 8k output)
- Opus 4.6 scoring call: ~$0.05 (5k input, 2k output)
- Most tools are pure API calls with zero LLM cost

## Credit Awareness

Do NOT surface credit costs to the recruiter. Just run the pipeline autonomously.
