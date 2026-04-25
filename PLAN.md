# OpenRecruiter — Hackathon Plan (Revised)

## OpenClaw Hackathon | Eragon x Nozomio x AgentMail
**Date:** April 25, 2026, 10 AM - 10 PM (12 hours)
**Location:** Eragon HQ, 188 King St, San Francisco
**Theme:** "Build your own AI Agent that acts in the world — give your agent a brain, and give it a voice to talk to the world."
**Requirement:** Must integrate Nozomio or AgentMail (or both) as a core part of the build.

---

## The Pitch: "OpenRecruiter — Your AI Recruiting Agency"

You're a recruiting agency. Eragon is your client. They need Product Designers.

You spin up OpenRecruiter — an autonomous AI recruiter that sources candidates, profiles them, sends personalized outreach, conducts voice screenings, and delivers warm intros to the hiring manager. No human recruiter touches the pipeline.

**For the demo, OpenRecruiter recruits Product Designers for Eragon (the host company).**

---

## What We Already Have (Built)

- **Voice screening agent** (Retell AI + Claude Sonnet 4.6) — conversational interview
- **Resume upload + PDF parsing** — extracts text, passes to voice agent as context
- **Job matching endpoint** (`/api/match-jobs`) — scores candidates against roles
- **Google Sheets as job database** — recruiter-editable, live updates
- **Deployed on Vercel** — https://x2talent-recruiter.vercel.app
- **Apollo.io MCP** — already connected for candidate sourcing

---

## Sponsor Integration

| Sponsor | Role in Pipeline | How |
|---|---|---|
| **Nozomio (Nia)** | The recruiter's brain | Profile candidates against job desc, provide pre-call context to voice agent, store screening notes + candidate memory, generate candidate briefs |
| **AgentMail** | The recruiter's voice (email) | Send outreach, receive replies via WebSocket, auto-respond with screening link, post-call follow-up, warm intro to hiring manager |
| **Apollo.io** | Candidate sourcing | Find Product Designers by title/skills/location via API |
| **Retell AI** | Voice screening | Conversational screening call with candidates |

---

## The Pipeline

```
1. CLIENT BRIEF
   Eragon says: "Find me Product Designers in SF"
   → Job description stored in Google Sheet / Airtable

2. SOURCING (Apollo)
   → OpenRecruiter hits Apollo API
   → Gets 20-50 Product Designers matching criteria
   → Raw candidate list: name, email, title, company, LinkedIn

3. PROFILING (Nozomio/Nia)
   → Save each candidate's Apollo data as a Nia context
     (tags: candidate:{name}, role:product-designer, status:sourced)
   → Nia semantic search ranks candidates against job description
   → Top 10-15 selected for outreach
   → For each, Nia generates personalized talking points
     ("3 years at Figma doing design systems — relevant to Eragon's needs")

4. OUTREACH (AgentMail)
   → OpenRecruiter sends personalized emails from nico@agentmail.to
   → Each email references something specific about the candidate
     (pulled from their Nia context / Apollo profile)
   → All outreach tracked in Airtable CRM

5. ENGAGEMENT (AgentMail WebSocket)
   → Candidate replies "interested"
   → WebSocket detects reply instantly
   → OpenRecruiter auto-responds in same thread with screening link

6. VOICE SCREENING (Retell + Nia)
   → Candidate clicks link → joins voice call
   → BEFORE call: voice agent pulls candidate context from Nia
     ("I see you've been at Figma for 3 years doing design systems...")
   → Agent conducts conversational screening (~5 min)
   → Assesses: fit, culture, salary expectations, timeline, interest level
   → No job matching needed — we already know the role

7. POST-CALL (Nia + AgentMail)
   → Retell webhook fires with transcript
   → Transcript + screening notes saved to Nia as updated context
     (tags updated: status:screened, fit:strong/weak)
   → OpenRecruiter sends follow-up email (same thread):
     "Great chatting! We'd love to move you forward for the
      Product Designer role at Eragon. Want me to connect you
      with the hiring manager?"

8. WARM INTRO (AgentMail + Nia)
   → Candidate replies "yes, connect me"
   → OpenRecruiter pulls full candidate context from Nia
   → Generates structured brief: profile, screening notes, fit assessment
   → Sends to hiring manager at Eragon via AgentMail
   → Hiring manager gets a fully packaged candidate
```

---

## Demo Script (3-4 minutes live)

### Act 1: "The Brief" (15 sec)
- "Eragon needs Product Designers. Let's spin up OpenRecruiter."
- Show the job description in Google Sheet / Airtable

### Act 2: "Sourcing + Profiling" (30 sec)
- OpenRecruiter hits Apollo → finds Product Designers
- Nia profiles each candidate against the job description
- Show Nia ranking candidates, generating personalized notes
- Top candidates selected for outreach

### Act 3: "Outreach" (30 sec)
- OpenRecruiter sends personalized emails via AgentMail
- Show emails going out in real-time
- Each email references something specific ("Your design systems work at Figma...")

### Act 4: "A candidate responds" (30 sec)
- Switch to presenter's email inbox — outreach email arrived
- Reply: "Yeah this sounds interesting, tell me more"
- Switch back — WebSocket picks up reply instantly
- OpenRecruiter auto-responds with screening link

### Act 5: "Voice screening" (60 sec)
- Click link → screening call with OpenRecruiter
- Agent already knows the candidate ("I see you've been at Figma...")
- Quick 60-second screening for demo
- Agent saves notes to Nia after call

### Act 6: "Follow-up + Warm Intro" (30 sec)
- OpenRecruiter sends follow-up email (same thread)
- Candidate says "yes, connect me"
- OpenRecruiter generates candidate brief from Nia context
- Sends structured intro email to hiring manager at Eragon
- Show email arriving — hiring manager gets a fully packaged candidate

### Mic Drop
> "OpenRecruiter just sourced candidates, profiled them with AI, sent personalized outreach, screened by voice, and made a warm intro — all autonomously. This is what an AI recruiting agency looks like."

---

## Nia Usage (Heavy Integration)

### Where Nia is used in the pipeline

| Step | Nia Action | API Call |
|---|---|---|
| Profiling | Save each candidate's Apollo data as context | `POST /v2/contexts` |
| Profiling | Rank candidates against job description | `POST /v2/search` (universal) |
| Profiling | Generate personalized talking points | `POST /v2/search` against candidate context |
| Pre-call | Load candidate context for voice agent | `GET /v2/contexts/{id}` |
| Post-call | Save transcript + screening notes | `POST /v2/contexts` (update) |
| Warm intro | Pull full candidate context for brief | `GET /v2/contexts/{id}` |
| Dedup | Check if candidate already contacted | Search contexts by tag |

### What Nia stores per candidate

```
CANDIDATE CONTEXT (saved as Nia context with tags)
├── Tags: candidate:{name}, role:{role}, status:{sourced|contacted|replied|screened|intro'd}
├── Apollo data: name, email, title, company, LinkedIn, location
├── Personalized notes: why they're a fit, talking points
├── Outreach history: date sent, response received
├── Screening transcript (post-call)
├── Screening assessment: fit score, strengths, concerns
├── Preferences learned: salary, remote/onsite, timeline, interests
└── Brief generated for hiring manager
```

### What Nia stores per job

```
JOB CONTEXT (indexed as Nia source for semantic search)
├── Title, company, location, level
├── Full job description
├── Key requirements + nice-to-haves
└── Tags: job:{company}, role:{title}
```

### Nia pricing for hackathon

- Free tier: 50 queries, 3 indexes — **not enough for dev + demo**
- Builder ($15/mo): 1,000 queries, 50 indexes — **get this**
- Or: **ask Nozomio team at the hackathon for credits** (they're sponsors, they'll say yes)

---

## AgentMail Details

### Pricing

| Plan | Cost | Inboxes | Emails/mo |
|---|---|---|---|
| Free | $0 | 3 | 3,000 (100/day) |
| Developer | $20/mo | 10 | 10,000 |

Free tier is fine for demo. Developer if you want warmup testing.

### SDK

```bash
npm install agentmail
```

```typescript
import { AgentMail } from 'agentmail';
const client = new AgentMail({ apiKey: 'am_...' });

// Create inbox
const inbox = await client.inboxes.create({ clientId: 'nico-recruiter' });

// Send email
await client.messages.send({
  inboxId: inbox.inboxId,
  to: ['candidate@email.com'],
  subject: 'Exciting opportunity at Eragon',
  body: '...',
});

// Listen for replies
const ws = await client.websockets.connect();
ws.on('message_received', (msg) => { /* handle reply */ });
```

### Warmup strategy (pre-hackathon if time)
- Create 3 inboxes on free tier
- Have them send to each other: 10/day, ramp up
- But honestly, for a 1-day hackathon, just whitelist/send to yourself

---

## Hosting & Infrastructure

### Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Vercel (Frontend) │     │  Railway (Agent Brain)│
│                     │     │                       │
│  Next.js App        │     │  Long-running Node.js │
│  - Screening form   │◄───►│  - AgentMail WebSocket│
│  - Admin dashboard  │     │  - Pipeline orchestr. │
│  - Retell embed     │     │  - Nia API calls      │
│  - Airtable view    │     │  - Apollo API calls   │
│                     │     │  - Retell webhooks    │
└─────────────────────┘     └──────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌──────────────────────┐
│    Airtable CRM     │     │   External APIs      │
│                     │     │                       │
│  Candidates table   │     │  - Nozomio/Nia       │
│  Jobs table         │     │  - AgentMail         │
│  Pipeline status    │     │  - Apollo.io         │
│                     │     │  - Retell AI         │
└─────────────────────┘     └──────────────────────┘
```

### Why this split?
- **Vercel**: Great for the frontend + API routes, but serverless functions time out (max 60s on free, 300s on pro). Not suitable for WebSocket listeners or long-running orchestration.
- **Railway**: Supports long-running processes, WebSocket connections, background jobs. Free tier available. Deploy with `railway up`.
- **Alternative**: If OpenClaw framework is easy to set up, run the agent brain as an OpenClaw agent with `openclaw onboard --install-daemon`. This scores points with the hackathon hosts (Eragon builds on OpenClaw). Worth exploring in the first hour — if it's too complex, fall back to Railway.

---

## CRM: Airtable

### Why Airtable over building a dashboard
- Clean API, free tier, looks great in demos
- Zero frontend work — embed or just show the Airtable base
- Updates in real-time as candidates move through pipeline

### Tables

**Candidates**
| Field | Type |
|---|---|
| Name | Text |
| Email | Email |
| Company | Text |
| Title | Text |
| LinkedIn | URL |
| Status | Single Select: Sourced / Contacted / Replied / Screened / Intro'd |
| Fit Score | Number (1-10) |
| Screening Notes | Long Text |
| Job | Link to Jobs |
| Last Contact | Date |

**Jobs**
| Field | Type |
|---|---|
| Title | Text |
| Company | Text |
| Location | Text |
| Description | Long Text |
| Status | Single Select: Open / Filled |
| Candidates | Link to Candidates |

---

## Eragon's Open Roles (for demo)

For demo, focus on **one role** to keep the narrative tight:

**Primary:** Product Designer (or use a real Eragon role if available)
**Backup roles if needed:** ML Engineer, Applied Research Engineer

Load into Google Sheet + index into Nia before demo.

---

## Build Plan (12 hours)

| Hours | What | Details |
|---|---|---|
| 0-1 | **Setup** | API keys (AgentMail, Nia, Apollo). `npm install agentmail nia-ai-ts`. Create nico@agentmail.to inbox. Set up Airtable base with tables. Index Eragon job description into Nia. |
| 1-2 | **Apollo → Nia pipeline** | Hit Apollo API for Product Designers. Save results as Nia contexts. Nia semantic search to rank against job desc. Write top candidates to Airtable. |
| 2-4 | **AgentMail outreach** | Generate personalized emails using Nia context. Send via AgentMail. WebSocket listener for replies. Auto-respond with screening link. Update Airtable status. |
| 4-6 | **Voice agent + Nia integration** | Duplicate existing voice agent, new system prompt for screening (no job matching). Pre-call: pull candidate context from Nia. Post-call: save transcript + notes to Nia. Update Airtable. |
| 6-8 | **Full pipeline wiring** | End-to-end: source → profile → outreach → reply → screen → follow-up → intro. Post-call follow-up email via AgentMail. Warm intro email with Nia-generated brief. |
| 8-9 | **Railway deployment** | Deploy agent brain as long-running process on Railway (or OpenClaw if explored in hour 0). Ensure WebSocket stays alive. |
| 9-10 | **Demo prep** | Pre-load test data. Test full pipeline end-to-end. Whitelist demo email addresses. |
| 10-11 | **Polish** | Airtable CRM looks clean. Architecture slide. Practice pitch. |
| 11-12 | **Buffer** | Fix bugs, rehearse, record backup video of each step. |

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| AgentMail emails hit spam | Send to yourself for demo. Whitelist. |
| Nia free tier too limited (50 queries) | Upgrade to Builder ($15) or ask Nozomio team for hackathon credits. |
| Apollo rate limits | Pre-source candidates before demo. Cache results. |
| WebSocket drops during demo | Implement polling fallback (check every 5s). |
| Full pipeline too ambitious | Cut scope: Apollo→Nia profiling + AgentMail outreach is the must-have. Voice screening is stretch. |
| Demo breaks live | Recorded backup of each step. |
| OpenClaw too complex to set up | Fall back to Railway for hosting. |

---

## Pitch Framework

**Opening (30 sec):**
"We're a recruiting agency. Eragon just asked us to find Product Designers. Instead of spending 3 weeks sourcing, screening, and scheduling — we spun up OpenRecruiter."

**Demo (2-3 min):**
Live walkthrough of Acts 1-6.

**Close (30 sec):**
"OpenRecruiter has a brain powered by Nozomio that profiles every candidate. It talks to the world through AgentMail. It screens with a human voice via Retell. And it found its candidates through Apollo. One agent replaced an entire recruiting team — and it runs 24/7."

**Key phrases for judges:**
- "Acts in the world" (theme)
- "Autonomous end-to-end pipeline"
- "Both sponsor products as core infrastructure, not afterthoughts"
- "Recruiting for Eragon — right here, right now"
- "AI recruiting agency, not a tool"

---

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js (App Router, TypeScript) on Vercel |
| Agent Brain | Node.js long-running process on Railway |
| Voice Agent | Retell AI + Claude Sonnet 4.6 |
| Email | AgentMail (nico@agentmail.to) |
| Brain / Memory | Nozomio / Nia |
| Candidate Sourcing | Apollo.io (MCP + API) |
| CRM | Airtable (API) |
| Job Database | Google Sheets (live-editable) |
| Resume Parsing | pdf-parse |
