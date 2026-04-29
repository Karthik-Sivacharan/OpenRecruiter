# Recruiting Pipeline Rules

## The Full Flow (5 Phases)

### Phase 1: INTAKE (Requires Recruiter Input)

1. Recruiter gives JD link or text + any initial preferences
2. Agent fetches JD if URL provided:
   - First try: Anthropic `web_fetch` (free, fast, handles normal HTML)
   - If empty/boilerplate: `fetchJobDescription` via Jina Reader (renders JS SPAs like Ashby, Lever)
   - If both fail: ask recruiter to paste the JD text directly
   - Do NOT tell the recruiter about failed fetches — silently try the fallback
3. Agent asks follow-up questions using `.claude/skills/follow-up-questions/` skill
   - Batch 1: Must-have skills, experience level, location, candidate count
   - Batch 2: Company preferences, salary range, outreach threshold, timeline
4. Wait for recruiter to answer before proceeding
5. Save role + all preferences to Graphiti

### Phase 2: SEARCH (Autonomous, Free)

1. `apolloSearchPeople` -> run 2-3 passes with title variations (FREE, no credits)
2. Deduplicate results by name + company
3. Present results: "Found X candidates. Top Y by relevance. Want me to enrich them?"
4. **WAIT for recruiter approval** — this is the ONE enrichment gate

### Phase 3: ENRICH + ANALYZE (Autonomous After Approval — No More Pauses)

Once recruiter approves enrichment, run the full chain without stopping. Push to Airtable after EACH step so no data is ever lost.

**Step 1 — Apollo Enrich (1 credit/person):**
5. `apolloBulkEnrich` (batches of 10, using apollo_ids) -> emails, employment history, company details, social URLs
6. **Push to Airtable** → CREATE rows with all Apollo data. Stage: "Enriched"

**Step 2 — Deep Enrichment (future):**
7. `enrichProfile` via EnrichLayer -> skills, education, full job descriptions
8. `enrichWorkEmail` via EnrichLayer -> verified work email (only if Apollo email missing/unverified)
9. **Update Airtable rows** with EnrichLayer data

**Step 3 — GitHub/Portfolio Discovery (future):**
10. `pdlEnrichPerson` via PDL -> github_url, websites[], profiles[]
11. GitHub lookup chain: `githubSearchByEmail` -> `githubSearchByName` -> `niaWebSearch`
12. `githubFetchProfile` -> websiteUrl, bio, README
13. **Update Airtable rows** with GitHub/portfolio URLs

**Step 4 — Deep Analysis via Nia Oracle (requires approval):**
14. After enrichment + web discovery, **ASK the recruiter**: "Enrichment complete for X candidates. Want me to run deep analysis? Or skip straight to outreach?"
15. **WAIT for recruiter response.** They can say: analyze all, analyze specific ones, or skip.
16. If approved: `niaAnalyzeCandidates` (batch) -> fires Oracle research jobs in parallel (~5 min total)
    - Oracle autonomously researches each candidate's portfolio, LinkedIn, GitHub, publications, press
    - Returns a full evaluation: career trajectory, fit assessment, strengths, concerns, interview recommendations
17. **Update Airtable rows** with "Nia Analysis" (full report), "Nia Summary" (2-3 sentence summary). Stage: "Analyzed"
18. Show recruiter a summary table: Name, Current Company, Nia Summary
    - If recruiter skipped analysis, candidates go directly from "Enriched" to next step

**Step 5 — Candidate Scoring (autonomous):**
19. For EACH candidate, `scoreCandidate` → internally calls Opus 4.6 with candidate data + JD
    - Opus evaluates: skill overlap, experience depth, company trajectory, portfolio/GitHub signals, location fit
    - Returns: fit_score (1-10) + fit_rationale (3-5 sentence assessment)
20. **Update Airtable rows** with "Fit Score", "Fit Rationale". Stage: "Scored"
21. Present summary table to recruiter: Name, Title, Company, Fit Score (sorted highest first)

**Step 6 — Outreach (future):**
22. Generate personalized email draft using `.claude/skills/outreach-style/`
23. `agentmailCreateDraft` -> create draft in AgentMail (NOT sent)
24. **Update Airtable rows** with draft email. Stage: "Draft Ready"

### Phase 4: RECRUITER REVIEW (Pause and Wait)

25. Agent tells recruiter: "Done. [N] candidates scored. Go take a look in Airtable."
26. Provide a summary table in chat: name, fit score, title, company (sorted by fit score descending)
27. Wait for recruiter to review in Airtable
28. Ask: "Want to draft outreach emails, or pick specific candidates?"

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

Pause for recruiter approval on:
- **Enrichment** (Phase 2 → 3 — after search, before spending credits): "Found X candidates. Enrich top Y?"
- **Deep Analysis** (Phase 3 Step 4 — after enrichment, before Nia Oracle): "Want me to run deep analysis? Or skip to outreach?" Recruiter can analyze all, pick specific, or skip entirely.
- **Sending outreach emails** (Phase 5 — recruiter chooses send all, pick specific, or manual)
- **Drip campaign scheduling** (Phase 5 — confirm cadence before scheduling)

Enrichment steps (Apollo, EnrichLayer, web search) run autonomously once enrichment is approved. Deep analysis requires its own gate because it takes ~5 minutes and the recruiter may want to skip it.

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

### Hiring Context (from JD / recruiter intake)
| Field | Type | Source |
|-------|------|--------|
| Role | Text | From intake (search role name) |
| Hiring Company | Text | Company name from JD |
| Hiring Role | Text | Exact role title from JD |
| Hiring JD URL | URL | JD link (if recruiter shared one) |
| Hiring Job Description | Long text | Full JD text (fetched, pasted, or from PDF) |
| Pipeline Stage | Select | Auto-updated |

### Candidate Profile (from Apollo + EnrichLayer)
| Field | Type | Source |
|-------|------|--------|
| Name | Text | Apollo |
| Email | Email | Apollo / EnrichLayer |
| Title | Text | Apollo (candidate's current job title) |
| Current Company | Text | Apollo (candidate's current employer) |
| Current Company Domain | Text | Apollo |
| Current Company Industry | Text | Apollo |
| Current Company Size | Number | Apollo |
| Current Company Funding | Text | Apollo |
| Current Company Stage | Text | Apollo |
| Current Company Tech Stack | Text | Apollo |
| Current Company Description | Long text | Apollo |
| LinkedIn URL | URL | Apollo |
| GitHub URL | URL | PDL / GitHub search |
| Personal Website | URL | PDL / Nia search |
| Nia Summary | Long text | Orchestrator (2-3 sentence summary from Nia Oracle report) |
| Nia Analysis | Long text | Nia Oracle (full research report) |
| Fit Score | Number (1-10) | Opus 4.6 scoring via scoreCandidate tool |
| Fit Rationale | Long text | Opus 4.6 scoring via scoreCandidate tool |
| Draft Email Subject | Text | Sonnet 4.6 |
| Draft Email Body | Long text | Sonnet 4.6 |
| AgentMail Thread ID | Text | AgentMail (after send) |
| Reply Content | Long text | AgentMail webhook |
| Notes | Long text | Running log |

## Attio Pipeline Stages

Enriched -> Analyzed (optional) -> Scored -> Draft Ready (future) -> Contacted -> Replied -> Screened -> Intro'd -> Declined

## Model Routing Strategy

The chat agent (orchestrator) always runs on **Sonnet 4.6**. Individual tool implementations use different models internally for cost optimization.

| Pipeline Step | Orchestrator | Internal Model | Why |
|---|---|---|---|
| Sourcing (Apollo search, enrich) | Sonnet 4.6 | None (pure API calls) | No LLM needed, just REST calls |
| Enrichment (EnrichLayer, PDL) | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| GitHub/Portfolio Discovery | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| Nia Oracle Analysis | Sonnet 4.6 | None (Nia uses Opus 4.7 internally) | Nia's own AI handles research + evaluation |
| **Candidate Scoring** | Sonnet 4.6 | **Opus 4.6** | scoreCandidate tool calls Opus internally for nuanced fit assessment |
| Email Drafting | Sonnet 4.6 | Sonnet 4.6 | Needs good writing quality |
| CRM Updates (Airtable) | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| Auto-Reply Generation | -- | Sonnet 4.6 | Runs via webhook, reads Airtable for context |
| Drip Follow-ups | -- | Sonnet 4.6 | Runs via Vercel Cron |

### Model IDs
- **Sonnet 4.6**: `claude-sonnet-4-6` (orchestrator + writing)
- **Opus 4.6**: `claude-opus-4-6` (scoring only)
- **Haiku 4.5**: `claude-haiku-4-5-20251001` (batch operations — still requires date suffix)

### Cost Estimate Per Session (~$0.25)
- Sonnet 4.6 orchestration: ~$0.20 (50k input, 8k output)
- Opus 4.6 scoring call: ~$0.05 (5k input, 2k output)
- Most tools are pure API calls with zero LLM cost

## Credit Awareness

Do NOT surface credit costs to the recruiter. Just run the pipeline autonomously.
