# Supermemory Candidate Data Schema

> Date: 2026-04-30
> Updated: 2026-04-30 (shared container architecture)

## Container Strategy

All candidates go into ONE shared container. Per-candidate grouping via customId.

```
containerTag: "talent-pool"                     # shared for all candidates
customId: "candidate-{linkedin-slug}"           # groups memories per candidate
```

Example: containerTag = "talent-pool", customId = "candidate-sarah-chen-a1b2c3"

## What We Send Per Candidate

### Content (searchable text, costs tokens)

Full version (~800-1500 tokens per candidate):

```
Name: Sarah Chen
Title: Staff ML Engineer
Company: Stripe
Location: San Francisco, CA
Headline: ML Engineer building recommendation systems at scale
Skills: Python, PyTorch, TensorFlow, distributed systems, recommendation systems, MLOps
Education: MIT, Computer Science, BS and MS
Employment History: Google Brain (2018-2022) - Senior ML Engineer; Stripe (2022-present) - Staff ML Engineer
EnrichLayer Experiences: Led ML pipeline migration to Kubernetes, built recommendation engine serving 10M+ users
Certifications: AWS ML Specialty
Languages: English, Mandarin
Summary: Deep expertise in recommendation systems and ML infrastructure. Published 3 papers on large-scale recommendation systems.
Current Company Industry: Financial Technology
Current Company Size: 8000

--- Recruiting Context ---
Role: ML Engineer at Ramp
Hiring Company: Ramp
Fit Score: 8/10
Fit Rationale: Strong ML infrastructure background, experience with financial data at Stripe. Gap: no direct payments fraud experience.
Pipeline Stage: Draft Ready
Recruiter Notes: Had a call - very strong communicator. Wants to stay remote. Exploring AI startups specifically. Said Q2 2026 timing works better.
Intake Notes: 8 years experience, prefers remote/hybrid, authorized to work in US, interested in senior IC roles at AI startups, referred by John Smith. Salary expectation: $220-250K base.
```

### Metadata (structured, filterable, propagates to every extracted memory)

```json
{
  "type": "candidate_profile",
  "airtable_record_id": "rec5OztHXgm6JN96s",
  "linkedin_url": "https://linkedin.com/in/sarah-chen-a1b2c3",
  "role": "ml-engineer-ramp",
  "hiring_company": "Ramp",
  "fit_score": "8",
  "stage": "draft-ready"
}
```

Verified: metadata propagates to every extracted memory. When searching, each result carries airtable_record_id and linkedin_url for candidate identification and Airtable lookup.

### entityContext (guides Supermemory's fact extraction)

```
This is a recruiting candidate profile. Extract: skills and technologies, job history with companies and dates, education, fit assessment for the role, recruiter observations about preferences and availability, outreach status and candidate responses.
```

Max 1500 characters. Set once per container tag.

### What We Skip (not sent to Supermemory)

| Field | Reason |
|-------|--------|
| Email | PII, not useful for matching |
| Phone | PII |
| Photo / Photo URL | Not useful for matching |
| GitHub URL | In metadata if needed, not searchable text |
| Personal Website | In metadata if needed |
| Draft Email Subject/Body | Outreach content, not candidate data |
| AgentMail Draft ID / Thread ID / Message ID | Internal IDs |
| Sent At | Internal timestamp |
| Nia Analysis | Too long (5K+ chars), would blow token budget |
| Current Company Description | Marginal value, high token cost |
| Hiring Job Description | Same JD repeated for every candidate in a role |
| Phone | PII, not useful for matching |
| Personal Website Password | Sensitive credential, not useful for matching |
| Resume (attachment) | Attachment type, can't send as text. Content overlaps with enriched data. Skip for now. |

## Token Budget

| Candidate size | Tokens | 400 candidates/mo | Free tier (1M) |
|---------------|--------|-------------------|-----------------|
| Lean (name, title, skills, score) | 300-500 | 200K | 20% |
| Full (above + history, notes, experiences) | 800-1500 | 600K | 60% |
| Kitchen sink (+ Nia, company desc) | 2000-5000 | 2M | Over limit |

We use the **full version** to maximize search quality while staying within free tier.

## When We Send

**Primary trigger:** End of pipeline, after drafts are written and stages updated. Agent asks:

> "All done! Want me to save these candidates to your talent pool? This helps me find them again when future roles come in."

If yes: sync immediately via syncToTalentPool tool.
If no/later: daily batch update catches it anyway.

**Secondary trigger:** Daily batch sync from Airtable. Picks up records where Last Modified Time > Supermemory Synced At.

## Sync Tracking (Airtable Fields)

| Field | Type | Purpose |
|-------|------|---------|
| Supermemory Synced At | singleLineText | ISO timestamp, set by syncToTalentPool after successful add |
| Last Modified Time | lastModifiedTime | Auto-updated by Airtable on any field change |

## LinkedIn Slug Extraction

```
URL: https://www.linkedin.com/in/sarah-chen-a1b2c3
Slug: sarah-chen-a1b2c3
customId: candidate-sarah-chen-a1b2c3
```

- Regex: `/linkedin\.com\/in\/([^\/?#]+)/`
- Dots replaced with hyphens (containerTag charset: alphanumeric + hyphens + underscores + colons)
- Max 100 characters
- Used as the dedup key across roles (same candidate sourced for 2 roles = same customId)
