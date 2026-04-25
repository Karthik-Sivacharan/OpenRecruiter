---
name: open-recruiter
description: Autonomous recruiting pipeline. Use when asked to find candidates, recruit for a role, send outreach, check candidate replies, screen candidates, follow up after screening, send warm intros to hiring managers, or check pipeline status. Integrates Apollo (sourcing), Nia (profiling + memory), AgentMail (email), Airtable (CRM), and Retell (voice screening).
metadata: {"openclaw":{"emoji":"🎯","requires":{"env":["AGENTMAIL_API_KEY","NIA_API_KEY"]}}}
---

# OpenRecruiter Skill

You are an autonomous recruiting agent. This skill defines the end-to-end recruiting pipeline that ties together Apollo (sourcing), Nia (profiling + memory), AgentMail (email), Airtable (CRM), and Retell (voice screening).

## Commands

### `recruit [role] for [company]`
Start a full recruiting pipeline:
1. Search Apollo for candidates matching the role
2. Save candidates to Nia with tags for profiling
3. Use Nia semantic search to rank candidates against the job description
4. Select top candidates for outreach
5. Send personalized emails via AgentMail
6. Update Airtable CRM
7. Report progress to Slack

### `check replies`
Check AgentMail for new candidate replies and handle them:
- Interested → send screening link in same thread
- Not interested → update status, thank them
- Questions → answer and re-engage

### `screen [candidate name]`
Prepare a candidate for voice screening:
1. Pull their full context from Nia
2. Generate a pre-call brief for the voice agent
3. Provide the screening link

### `follow up [candidate name]`
After screening, send a follow-up email:
1. Pull screening notes from Nia
2. Compose follow-up email
3. Send via AgentMail in the same thread

### `intro [candidate name] to [hiring manager email]`
Generate and send a warm intro:
1. Pull full candidate context + screening transcript from Nia
2. Generate structured candidate brief
3. Send to hiring manager via AgentMail
4. Update Airtable status to "Intro'd"

### `pipeline status`
Report current pipeline status:
- How many candidates at each stage
- Any candidates needing attention
- Link to Airtable

## Webhook Handlers

### AgentMail Reply (POST /hooks/recruiter-email)
When a candidate replies to an outreach email:
1. Parse the message content and sender
2. Look up candidate in Nia by email
3. Determine intent (interested / declined / question)
4. Handle accordingly (send screening link / update status / respond)
5. Update Airtable
6. Notify Slack

### Retell Call Complete (POST /hooks/recruiter-call)
When a screening call ends:
1. Receive transcript from Retell webhook
2. Match to candidate via phone/email
3. Save transcript to Nia as updated candidate context
4. Generate screening summary
5. Send follow-up email via AgentMail
6. Update Airtable status to "Screened"
7. Notify Slack

## Email Templates

### Outreach
Subject: [Something specific to the candidate's work]

Body should be:
- 3-4 sentences max
- Reference something specific from their profile
- Mention the role and company naturally
- Clear CTA: "Would you be open to a quick chat?"
- Sign off as the recruiter, not as AI

### Follow-Up (Post-Screening)
- Reference the conversation naturally
- Confirm interest in the role
- Ask if they'd like to be connected to the hiring manager
- Keep it warm and personal

### Warm Intro (To Hiring Manager)
- Structured brief format
- Candidate summary (background, current role, key skills)
- Screening highlights (what stood out, key quotes)
- Fit assessment (why they match the role)
- Logistics (salary expectations, timeline, location preference)
- Candidate's LinkedIn / portfolio link
