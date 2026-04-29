# Phase 4C: Outreach Email Drafting + AgentMail Integration

> Date: 2026-04-29

## What This Phase Does

After candidates are scored (Phase 4B), this phase drafts hyper-personalized cold outreach emails, creates them as AgentMail drafts, and lets the recruiter review/send. Updates Airtable at each step.

---

## Pipeline Flow

```
Score (6+) candidates
  --> Ask recruiter follow-up (links? comp range? talking points?)
  --> Draft personalized emails (Sonnet 4.6 + updated style guide)
  --> Create AgentMail drafts + update Airtable ("Draft Ready")
  --> Recruiter reviews (in Airtable or chat)
  --> "Send all" or pick specific candidates
  --> Send drafts via AgentMail + update Airtable ("Contacted")
```

---

## Research Findings

### Cold Email Best Practices (2025-2026 data)

**Optimal specs (from 100M+ email benchmarks):**

| Metric | Optimal | Source |
|--------|---------|--------|
| Word count | 50-100 words, never over 125 | Hunter.io, HubSpot 40M email study |
| Sentences | 6-8 | 16.5M email dataset |
| Subject line | Under 50 chars, lowercase | Prospeo |
| Average reply rate | 3.4% | Instantly 2026 Benchmark (100M+ emails) |
| Top performer reply rate | 10%+ | Same |
| Recruiting reply rate | 5.8-7.2% avg, 8-12% top quartile | Industry vertical data |

**Interest-based CTAs convert 2x better than meeting requests:**
- Gong Labs study of 304,174 emails found interest CTAs ("Worth exploring?" / "Curious?") convert at 30%
- Meeting request CTAs ("Open to a 15-min chat?") perform 44% worse
- Single-CTA emails generate 35-42% higher response than multi-CTA

Sources:
- Gong Labs study: https://growleads.io/blog/interest-based-ctas-vs-meeting-requests-study/
- SmartLead analysis: https://www.smartlead.ai/blog/cold-email-call-to-action
- Autobound 2026 guide: https://www.autobound.ai/blog/cold-email-guide-2026
- Instantly Benchmark: https://instantly.ai/cold-email-benchmark-report-2026
- Gem recruiting emails: https://www.gem.com/blog/the-anatomy-of-a-great-cold-recruiting-email

**Key insights for recruiting engineers:**
- Include comp range upfront -- 95% of recruiters hide it, so including it is a massive differentiator
- Mention specific repos, blog posts, or talks -- not just "impressive background"
- Lowercase subject lines feel more casual/human
- Engineers delete anything over 150 words unread
- Timeline hooks (referencing recent work) get 2.3x reply rate vs problem-based hooks

### AI-Isms to Avoid (Banned List for Prompt)

**Words:** delve, leverage, utilize, harness, streamline, robust, seamless, innovative, cutting-edge, transformative, pivotal, foster, empower, furthermore, moreover, notably

**Phrases:**
- "I hope this email finds you well"
- "I wanted to reach out" / "I'm reaching out"
- "Exciting opportunity" / "exciting role"
- "Fast-paced environment" / "dynamic team"
- "Impressive background" / "impressive experience"
- "Passionate team" / "passionate about"
- "In today's..." anything

**Structural patterns:**
- Em dashes (use commas or periods)
- Starting multiple sentences with "I"
- Sentences over 20 words
- Using recipient's name more than once
- Perfect uniform paragraph structure across all emails
- Synonym cycling ("developers/practitioners/builders" in same email)

### Example Email (52 words)

```
Subject: your gradient accumulation approach

Hey Jane,

Saw your distributed-pytorch-trainer repo. The memory optimization
for large batch sizes is really clever.

We're building the ML infra team at Eragon (YC W24, Series A).
Distributed training systems, basically what you've been doing at
Datadog. $190-230k + early equity.

Interested?
```

---

## Implementation Plan

### 1. Fix scoreCandidates return value

`src/lib/tools/scoring.ts` currently strips `record_id` from results. The orchestrator needs record_ids to update Airtable with draft email content. Add `record_id` to the returned results array.

### 2. Update outreach-style skill

`.claude/skills/outreach-style/SKILL.md` needs:
- Banned word/phrase list (full AI-isms list above)
- Interest-based CTAs ("Interested?" / "Worth a look?" / "Curious?") instead of meeting requests
- Target 50-100 words (down from 150 max)
- Comp range guidance (include when recruiter provides it)
- Structural variation instructions (10 emails should each feel different)
- "Never start more than one sentence with I"
- "No sentence over 20 words"
- Lowercase subject lines
- Few-shot examples of good AND bad emails

### 3. New tool: agentmailCreateDrafts

File: `src/lib/tools/agentmail.ts`

- Input: array of candidates (record_id, email, name, subject, text_body, html_body)
- For each candidate:
  - `client.inboxes.drafts.create(INBOX_ID, { to, subject, text, html, labels, clientId })`
  - Labels: `["draft-ready", "airtable-{recordId}", "role-{roleSlug}"]`
  - client_id: `"draft-{recordId}"` (idempotent)
  - Update Airtable: Draft Email Subject, Draft Email Body, AgentMail Draft ID, Pipeline Stage = "Draft Ready"
- Returns: summary of drafts created

### 4. New tool: agentmailSendDrafts

Same file.

- Input: array of draft_ids + record_ids (or "all" to send all draft-ready)
- For each:
  - `client.inboxes.drafts.send(INBOX_ID, draftId)`
  - Returns message_id + thread_id
  - Update Airtable: AgentMail Thread ID, AgentMail Message ID, Sent At, Pipeline Stage = "Contacted"
- Returns: summary of sent emails

### 5. Wire into route.ts

- Import and register both new tools
- Add system prompt instructions:
  - After scoring, ask recruiter: "Before I draft emails, any links you want included? Comp range to mention? Specific talking points?"
  - Only draft for candidates scoring 6+
  - Use the outreach-style skill for email generation
  - Present drafts in chat for review before creating AgentMail drafts

### 6. Airtable schema additions

Fields already defined but not yet populated:
- Draft Email Subject (singleLineText)
- Draft Email Body (multilineText)
- AgentMail Thread ID (singleLineText)

Fields to add:
- AgentMail Draft ID (singleLineText)
- AgentMail Message ID (singleLineText)
- Sent At (dateTime)

### 7. Doc cleanups

- `docs/AIRTABLE_SCHEMA.md`: "Score" -> "Fit Score", "Score Rationale" -> "Fit Rationale"
- `airtableUpdateCandidate` description: same rename

---

## Dependencies

```bash
npm install agentmail
```

## Environment Variables

```
AGENTMAIL_API_KEY=am_xxx
AGENTMAIL_INBOX_ID=inbox_xxx
```

---

## AgentMail Label Strategy

| Label | Applied When | Purpose |
|-------|-------------|---------|
| `draft-ready` | Draft created | Filter for review |
| `airtable-{recordId}` | Draft created | Link back to Airtable candidate |
| `role-{roleSlug}` | Draft created | Filter by role/company |
| `contacted` | Draft sent | Track sent status |
| `replied` | Candidate replies | Track responses (Phase 5) |

---

## Detecting Manual Sends (Phase 5 — Not Blocking)

If recruiter sends drafts manually from AgentMail console:
- Subscribe to `message.sent` webhook event
- Webhook payload includes labels -> extract `airtable-{recordId}`
- Update Airtable Pipeline Stage to "Contacted"
- This is webhook work (Phase 5), not needed for Phase 4C

---

## Approval Gates

1. **Before drafting:** Ask recruiter follow-up (links, comp, talking points)
2. **Before sending:** Recruiter reviews drafts, says "send all" or picks specific candidates
3. **No auto-send** -- recruiter always controls when emails go out
