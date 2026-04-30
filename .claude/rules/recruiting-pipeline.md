# Recruiting Pipeline Rules

## The Full Flow (5 Phases)

### Phase 1: INTAKE (Requires Recruiter Input)

1. Recruiter gives JD link or text + any initial preferences
2. Agent fetches JD if URL provided:
   - First try: Anthropic `web_fetch` (free, fast, handles normal HTML)
   - If empty/boilerplate: `fetchJobDescription` via Jina Reader (renders JS SPAs like Ashby, Lever)
   - If both fail: ask recruiter to paste the JD text directly
   - Do NOT tell the recruiter about failed fetches — silently try the fallback
3. After reading the JD, STOP and share a brief summary with the recruiter (title, company, key requirements, location, comp)
4. Ask follow-up questions about info NOT in the JD (candidate count, companies to target/avoid, salary, timeline)
5. Even if recruiter provides preferences upfront, still show JD summary and ask remaining follow-ups
6. Wait for recruiter to answer before proceeding

### Phase 2: SEARCH (Autonomous, Free — ONE tool call)

1. Tell recruiter your search strategy
2. `apolloMultiSearch` → ONE call with 2-3 search passes (different title variations). Runs in parallel, deduplicates automatically.
3. Present results with summary table: Name, Title, Company
4. **WAIT for recruiter approval** — this is the ONE enrichment gate

### Phase 3: ENRICH + ANALYZE (Autonomous After Approval — Batch Tools)

Once recruiter approves enrichment, run the full chain. Every tool below is a SINGLE call that handles all candidates internally.

**Step 1 — Apollo Enrich (1 credit/person):**
1. `apolloBulkEnrich` (batches of 10, using apollo_ids) → emails, employment history, company details
2. `airtableCreateCandidates` → CREATE rows with all Apollo data. Stage: "Enriched"
   Always include hiring context: role, hiring_company, hiring_role, hiring_jd_url, hiring_job_description

**Step 2 — EnrichLayer Deep Enrich (ONE tool call, self-serving):**
3. `enrichAndSaveProfiles` → pass just the role name
   Tool self-serves: fetches candidates from Airtable, enriches via EnrichLayer in parallel, formats + saves all data back

**Step 3 — Work email fallback:**
4. `enrichWorkEmail` → only for candidates with NO email at all

**Step 4 — Web Presence Discovery (ONE tool call, self-serving):**
5. `searchAndSaveWebPresence` → pass role name + role_type
   Tool self-serves: fetches candidates missing URLs from Airtable, searches, verifies, saves

**Step 5 — Candidate Scoring (ONE tool call, self-serving):**
6. `scoreCandidates` → pass role name + job_description + role_type
   Tool self-serves: fetches unscored candidates from Airtable, reads profile data, scores via Opus, saves back

**Step 6 — Done:**
7. Present results table sorted by Fit Score: Name | Title | Company | Fit Score | Key takeaway
8. Tell recruiter: "All candidates scored. Want to draft outreach emails?"

### Phase 4: OUTREACH (Requires Approval)

**Drafting (after scoring, ask preferences first):**
1. Ask recruiter: links to include? comp range? talking points?
2. Draft emails internally for candidates with fit_score >= 6
3. Call `agentmailCreateDrafts` directly — do NOT show full emails in chat
4. Show summary table: Name | Subject | Status
5. Tell recruiter: "Drafts created in AgentMail + Airtable. Review there. Say 'send all' or pick specific."

**Sending (requires explicit approval):**
5. `agentmailSendDrafts` → ONE call, sends approved drafts + updates Airtable stage to "Contacted"

**Drip Campaign (confirm before scheduling):**
6. Propose drip details (Day 3/7/14 follow-ups), wait for confirmation

### Phase 5: AUTO-REPLY (Always Running, No Recruiter Needed)

- AgentMail webhook fires on candidate reply → `/api/agentmail-webhook/route.ts`
- Reads candidate's Airtable row for full context
- Generates contextual reply, sends in same thread
- Updates Airtable: stage → "Replied"

---

## Approval Gates

Pause for recruiter approval on:
- **Enrichment** (Phase 2 → 3): "Found X candidates. Enrich them?"
- **Sending outreach** (Phase 4): recruiter chooses send all, pick specific, or manual
- **Drip campaign** (Phase 4): confirm cadence before scheduling

Everything else runs autonomously once approved.

---

## Tool Call Efficiency

**Every batch tool handles all candidates in ONE call.** Never call per-candidate tools in a loop.

| Phase | Tool | Calls |
|-------|------|-------|
| Search | `apolloMultiSearch` | 1 |
| Enrich | `apolloBulkEnrich` | 1 |
| Create rows | `airtableCreateCandidates` | 1 |
| Deep enrich | `enrichAndSaveProfiles` | 1 |
| Web presence | `searchAndSaveWebPresence` | 1 |
| Score | `scoreCandidates` | 1 |
| Draft emails | `agentmailCreateDrafts` | 1 |
| Send emails | `agentmailSendDrafts` | 1 |
| **Total Phase 2-4** | | **~8** |

---

## Airtable Schema (Per Candidate Row)

### Hiring Context (from JD / recruiter intake)
| Field | Type | Source |
|-------|------|--------|
| Role | Text | From intake |
| Hiring Company | Text | From JD |
| Hiring Role | Text | From JD |
| Hiring JD URL | URL | JD link |
| Hiring Job Description | Long text | Full JD text |
| Pipeline Stage | Select | Auto-updated |

### Candidate Profile (from Apollo + EnrichLayer)
| Field | Type | Source |
|-------|------|--------|
| Name | Text | Apollo |
| Email | Email | Apollo |
| Title | Text | Apollo |
| Current Company | Text | Apollo |
| LinkedIn URL | URL | Apollo |
| GitHub URL | URL | EnrichLayer / searchAndSaveWebPresence |
| Personal Website | URL | EnrichLayer / searchAndSaveWebPresence |
| Skills | Text | enrichAndSaveProfiles |
| Education | Long text | enrichAndSaveProfiles |
| Certifications | Long text | enrichAndSaveProfiles |
| EnrichLayer Experiences | Long text | enrichAndSaveProfiles |
| Summary | Long text | enrichAndSaveProfiles |
| Fit Score | Number (1-10) | scoreCandidates (Opus) |
| Fit Rationale | Long text | scoreCandidates (Opus) |
| Draft Email Subject | Text | agentmailCreateDrafts |
| Draft Email Body | Long text | agentmailCreateDrafts |
| AgentMail Draft ID | Text | agentmailCreateDrafts |
| AgentMail Thread ID | Text | agentmailSendDrafts |
| Sent At | Text | agentmailSendDrafts |

## Pipeline Stages

Enriched → Scored → Draft Ready → Contacted → Replied → Screened → Intro'd → Declined

## Model Routing

| Step | Model | Why |
|------|-------|-----|
| Orchestration | Sonnet 4.6 | Chat + tool calling |
| Scoring | Opus 4.6 (internal) | Nuanced fit assessment |
| Auto-reply | Sonnet 4.6 | Webhook handler |
| All other tools | None | Pure API calls |

## Credit Awareness

Do NOT surface credit costs to the recruiter. Run the pipeline autonomously.
