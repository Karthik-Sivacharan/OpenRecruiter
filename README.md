# OpenRecruiter

An autonomous AI recruiting agency. Give it a job description URL and preferences, and it runs the entire pipeline: source candidates, enrich profiles, discover GitHub/portfolio links, deep-analyze, score, draft hyper-personalized cold emails, and manage follow-up campaigns.

Built with Claude as the orchestrator, every tool call is a batch operation that runs in parallel and writes directly to Airtable. The recruiter just chats.

## How It Works

```
JD URL + preferences
        |
   [1] Intake - fetch JD, extract requirements, ask follow-ups
        |
   [2] Search - Apollo multi-pass search, deduplicate (free, no credits)
        |
   [3] Enrich - Apollo enrich > Airtable > EnrichLayer > web search > score
        |       (all batch tools, self-serving from Airtable by role name)
        |
   [4] Outreach - draft emails via AgentMail, recruiter reviews in CRM
        |
   [5] Auto-reply - webhook handles candidate responses automatically
```

The recruiter approves once after search. Everything else runs autonomously.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| AI | Vercel AI SDK v6, Claude Sonnet 4.6 (orchestrator), Claude Opus 4.6 (scoring) |
| UI | shadcn/ui + Vercel AI Elements, Tailwind CSS |
| Database | Neon (Postgres, chat persistence) |
| CRM | Airtable (candidate pipeline, source of truth) |
| Sourcing | Apollo.io |
| Enrichment | EnrichLayer (LinkedIn profiles), Nia (web search) |
| Email | AgentMail (drafts, sending, auto-reply) |
| Deploy | Vercel |

## Pipeline Tools

Every tool is a single call that handles all candidates internally. No record ID passing between steps.

| Tool | What it does | Input |
|------|-------------|-------|
| `apolloMultiSearch` | 2-3 search passes in parallel, deduplicates | Search configs |
| `apolloBulkEnrich` | Emails, employment history, company details | Apollo IDs |
| `airtableCreateCandidates` | Create rows with Apollo + hiring context | Enriched candidates |
| `enrichAndSaveProfiles` | EnrichLayer profiles in parallel, format + save | Role name |
| `searchAndSaveWebPresence` | Web search for missing GitHub/portfolio, verify + save | Role name |
| `scoreCandidates` | Opus scoring in parallel, save scores | Role name + JD |
| `agentmailCreateDrafts` | Create email drafts + update CRM | Draft content |
| `agentmailSendDrafts` | Send approved drafts + update CRM | Draft IDs |

Typical pipeline for 5 candidates: ~10 tool calls total (was ~28 before batching).

## Getting Started

### Prerequisites

- Node.js 20+
- Anthropic API key
- Airtable base with the candidate schema
- Apollo.io API key
- EnrichLayer API key
- AgentMail API key
- Neon database

### Setup

```bash
git clone https://github.com/Karthik-Sivacharan/OpenRecruiter.git
cd OpenRecruiter
npm install
```

Copy `.env.example` to `.env.local` and fill in your keys:

```
# AI
ANTHROPIC_API_KEY=
MODEL_ORCHESTRATOR=claude-sonnet-4-6
MODEL_SCORING=claude-opus-4-6

# Database
DATABASE_URL=

# Airtable
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_TABLE_ID=

# Apollo
APOLLO_API_KEY=

# EnrichLayer
ENRICHLAYER_API_KEY=

# Nia
NIA_API_KEY=

# AgentMail
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=

# Jina (JD fetching fallback)
JINA_API_KEY=
```

### Run

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

## Architecture

```
src/
  app/
    api/chat/route.ts          # Main chat endpoint (streamText + all tools)
    page.tsx                   # Chat UI
    chat/[id]/page.tsx         # Chat persistence
  components/
    chat.tsx                   # Chat container (useChat + stream management)
    chat-messages.tsx          # Message rendering (tools, shimmer, step limit)
    ai-elements/               # Vercel AI Elements (reasoning, tool, shimmer)
  lib/
    tools/
      apollo.ts                # apolloMultiSearch, apolloBulkEnrich
      enrichlayer.ts           # enrichAndSaveProfiles, enrichLookupPerson
      nia.ts                   # searchAndSaveWebPresence, niaAnalyzeCandidates
      scoring.ts               # scoreCandidates (Opus internally)
      airtable.ts              # CRUD operations
      agentmail.ts             # Email drafts + sending
      jd-fetch.ts              # Jina Reader fallback for JS-rendered JD pages
    config/recruiters.ts       # Recruiter profiles (name, intro, CTA, signature)
    db/                        # Neon/Drizzle schema + queries
```

## Approval Gates

The pipeline only pauses for recruiter input at these points:

1. **After search** - "Found X candidates. Enrich them?" (before spending credits)
2. **Before sending** - "Send all, pick specific, or manual?"
3. **Drip campaign** - "Set up Day 3/7/14 follow-ups?"

Everything else (enrichment, scoring, web search, draft creation) runs autonomously once approved.

## Cost Per Session

- Sonnet 4.6 orchestration: ~$0.20
- Opus 4.6 scoring: ~$0.05
- Most tools are pure API calls with zero LLM cost
- **Total: ~$0.25 per full pipeline run**

## License

Proprietary. All rights reserved.
