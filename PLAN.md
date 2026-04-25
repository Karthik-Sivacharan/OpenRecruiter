# OpenRecruiter — Hackathon Plan

## OpenClaw Hackathon | Eragon x Nozomio x AgentMail
**Date:** April 25, 2026, 10 AM - 10 PM (12 hours)
**Location:** Eragon HQ, 188 King St, San Francisco
**Theme:** "Build your own AI Agent that acts in the world — give your agent a brain, and give it a voice to talk to the world."
**Requirement:** Must integrate Nozomio or AgentMail (or both) as a core part of the build.

---

## The Pitch: "Nico — The AI Recruiter That Never Sleeps"

An autonomous AI recruiter that sources candidates, sends outreach emails, conducts voice screenings, matches candidates to roles, and makes warm intros to hiring managers — all without human intervention.

**For the demo, Nico recruits for Eragon (the host company) using their real open roles.**

---

## What We Already Have (Built)

- **Voice screening agent** (Retell AI + Claude Sonnet 4.6) — conversational interview, not robotic
- **Resume upload + PDF parsing** — extracts text, passes to voice agent as context
- **Job matching endpoint** (`/api/match-jobs`) — scores candidates against roles
- **Google Sheets as job database** — recruiter-editable, live updates
- **Deployed on Vercel** — https://x2talent-recruiter.vercel.app
- **Apollo.io MCP** — already connected for candidate sourcing

---

## Sponsor Integration

| Sponsor | Role in Pipeline | How |
|---|---|---|
| **AgentMail** | Communication layer | Outreach emails, receive replies via WebSocket, auto-respond with screening link, post-call follow-up, hiring manager intro |
| **Nozomio / Nia** | Recruiter brain | Index job descriptions for semantic matching, persistent candidate memory across interactions, cross-role candidate suggestions |
| **Apollo.io** | Candidate sourcing | Find matching candidates by title/skills/location/seniority via MCP |
| **Retell AI** | Voice screening | Conversational interview with candidates |

---

## Architecture

```
SOURCING
  Eragon job added to Google Sheet
    → Nia indexes the job description
    → Nico calls Apollo to find matching candidates
    → Nico sends personalized outreach via AgentMail
      (from nico@agentmail.to)

ENGAGEMENT
  Candidate replies "interested"
    → AgentMail WebSocket detects reply
    → Nico auto-responds with screening link (same thread)

SCREENING
  Candidate clicks link → fills form (name, email, resume PDF)
    → Resume parsed and passed to Retell voice agent
    → Nico conducts conversational interview (~5 min)
    → Mid-call: Nia semantic search finds matching roles
    → Nico suggests 2-3 roles naturally in conversation

POST-SCREENING
  Call ends → Retell webhook fires
    → Transcript + preferences saved to Nia (persistent memory)
    → Nico sends follow-up email via AgentMail (same thread):
      "You'd be a strong fit for these roles. Want me to connect you?"

WARM INTRO
  Candidate replies "yes, connect me"
    → Nico sends candidate brief to hiring manager email
    → Brief includes: summary, strengths, transcript highlights, fit reasons
    → Hiring manager gets a fully packaged candidate
```

---

## Demo Script (3-4 minutes live)

### Act 1: "Nico sources candidates" (30 sec)
- Show Nico reading Eragon's ML Engineer job description
- Nico calls Apollo → finds 5-10 matching ML engineers (including the presenter)
- Nico sends personalized outreach to all via AgentMail
- Show emails going out in real-time

### Act 2: "A candidate responds" (30 sec)
- Switch to presenter's email inbox — outreach email arrived
- Reply: "Yeah this sounds interesting, tell me more"
- Switch back — WebSocket picks up reply instantly
- Nico auto-responds in same thread with screening link

### Act 3: "Voice screening" (60-90 sec)
- Click link → quick screening call with Nico
- Nico asks about background, preferences
- Keep it to 60 seconds for demo

### Act 4: "Nico matches and follows up" (30 sec)
- Call ends → Nico saves everything to Nia
- Nia matches candidate to Eragon's ML Engineer + Applied Research Engineer roles
- Nico sends follow-up email (same thread): "Based on our chat, you'd be a great fit for these two roles. Want me to connect you with the team?"

### Act 5: "The warm intro" (30 sec)
- Reply: "Yes, connect me"
- Nico sends structured candidate brief to hiring manager
- Show email arriving — hiring manager gets a fully packaged candidate

### Mic Drop
> "Nico just sourced a candidate, reached out, screened them by voice, matched them to the right roles, and made a warm intro — all autonomously. No human recruiter touched this pipeline."

---

## Nia as the Recruiter Brain

### What Nia stores (context per candidate)

```
CANDIDATE CONTEXT
├── Profile: name, email, skills, experience, salary, work preference
├── Resume summary
├── Outreach history:
│   ├── Date, channel, message, response
│   └── Thread ID for email continuity
├── Screening transcript + key quotes
├── Job matches suggested + candidate reactions
│   └── "Loved the Cortex role, not interested in Arcway"
├── Preferences learned:
│   └── Remote, $180-200k, no crypto, cares about design culture
├── Status: sourced → contacted → replied → screened → matched → intro'd
└── Notes: "Strong systems thinker. Follow up in May."
```

### What Nia stores (context per job)

```
JOB CONTEXT
├── Role details
├── Candidates reached out
├── Candidates screened
├── Common rejection reasons
└── What kind of candidate actually fits (learned over time)
```

### Nia API usage

| When | What | Endpoint |
|---|---|---|
| Before outreach | Check if candidate exists in memory | `POST /v2/search` |
| Before call | Load candidate context if returning | `GET /v2/contexts/{id}` |
| During call | Semantic job matching | `POST /v2/search` |
| After call | Save/update candidate context | `POST /v2/contexts` |

---

## AgentMail Details

- **Free tier:** 3 inboxes, 3,000 emails/month
- **Inbox:** `nico@agentmail.to` (or subdomain for custom)
- **Capabilities:** Send, receive (WebSocket), reply, thread, schedule, drafts, labels
- **Note:** New inboxes not warmed up — for demo, send to yourself/teammates
- **SDK:** `npm install agentmail`

---

## Eragon's Open Roles (for demo)

| Role | Location | Level |
|---|---|---|
| Member of Technical Staff | San Francisco | Full-time |
| Machine Learning Engineer | San Francisco | Full-time |
| Applied Research Engineer | San Francisco | Full-time |
| Applied AI Intern | San Francisco | Intern |

All engineering/ML focused. Load into Google Sheet for the demo.

---

## Build Plan (12 hours)

| Hours | What | Sponsor |
|---|---|---|
| 0-1 | Setup: AgentMail + Nia API keys, `npm install agentmail`, create Nico inbox, index Eragon jobs into Nia, add Eragon roles to Google Sheet | — |
| 1-4 | AgentMail integration: send outreach, WebSocket for replies, auto-respond with screening link, post-call follow-up, hiring manager intro | AgentMail |
| 4-7 | Nia integration: semantic job search (replace Sheets lookup), save candidate context after calls, retrieve context for returning candidates, pre-outreach dedup check | Nozomio |
| 7-8 | Apollo → AgentMail pipeline: source candidates via Apollo MCP, generate personalized emails, send via AgentMail | Apollo |
| 8-9 | Wire full pipeline: outreach → reply → screening → matching → follow-up → intro | All |
| 9-10 | Simple admin dashboard showing pipeline state | — |
| 10-11 | Demo prep: test end-to-end, pre-load test data, build architecture slide | — |
| 11-12 | Buffer: fix bugs, rehearse pitch | — |

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| AgentMail emails hit spam | Send to yourself for demo. Whitelist if needed. |
| Nia free tier too limited (50 queries) | Pre-index jobs night before. Be selective with queries. Upgrade to Builder ($15) if needed. |
| Full pipeline too ambitious | Cut scope: AgentMail (outreach + follow-up) is the must-have. Nia is stretch. |
| Apollo rate limits | Pre-source candidates before demo. Cache results. |
| Demo breaks live | Have a recorded backup of each step. |

---

## Pitch Framework (if presenting slides)

**Opening (30 sec):**
"Recruiting is broken. Companies spend 23 days to fill a role. What if an AI recruiter could source, screen, and follow up — autonomously, 24/7?"

**Demo (2-3 min):**
Live walkthrough of Acts 1-5.

**Close (30 sec):**
"Nico has a brain powered by Nozomio, finds talent through Apollo, talks to the world through AgentMail, and screens with a human voice via Retell. It's not a chatbot — it's an autonomous recruiter. This is what agents acting in the world looks like."

**Key phrases for judges:**
- "Acts in the world" (theme)
- "Closed-loop autonomous pipeline"
- "Both sponsor products as core infrastructure, not afterthoughts"
- "Recruiting for Eragon — right here, right now"

---

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) |
| Voice Agent | Retell AI + Claude Sonnet 4.6 |
| Email | AgentMail (nico@agentmail.to) |
| Brain / Memory | Nozomio / Nia |
| Candidate Sourcing | Apollo.io (MCP) |
| Job Database | Google Sheets (live-editable) |
| Resume Parsing | pdf-parse |
| Deployment | Vercel |
