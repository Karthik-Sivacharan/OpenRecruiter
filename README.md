# OpenRecruiter 🤖

An autonomous AI recruiting agent that sources, scores, and outreaches to candidates — built at the OpenClaw Hackathon.

## What it does

1. **Sources candidates** from Apollo.io (or Airtable fallback)
2. **Finds GitHub profiles** via Nia web search — even if hidden behind personal websites
3. **Researches GitHub** using Nia Tracer to analyze real work and projects
4. **Scores candidates** with Claude using both LinkedIn profile + GitHub context
5. **Writes Nia Score** to Airtable for hiring manager review
6. **Sends personalized outreach** emails via AgentMail
7. **Auto-replies** to candidates with screening links
8. **Conducts AI screening calls** via Retell AI
9. **Sends warm intros** to hiring managers for top candidates

## Tech Stack

- **Claude** (Anthropic) — candidate scoring, email generation, call summarization
- **Nia** (Nozomio) — candidate context storage, GitHub web search, Tracer for deep repo analysis
- **AgentMail** — autonomous email sending and reply handling
- **Apollo.io** — candidate sourcing
- **Airtable** — CRM and pipeline tracking
- **Railway** — deployment

## API Endpoints

POST /run/source   — Source + score candidates, write to Airtable
POST /run/outreach — Send personalized outreach emails

## How scoring works

1. Apollo finds candidates matching the job
2. Nia web search finds their GitHub (even from personal websites)
3. Nia Tracer analyzes their repos (30s timeout, falls back to quick scan)
4. Claude reads LinkedIn profile + GitHub findings + job description
5. Outputs a Nia Score (1-10) written directly to Airtable

## Setup

npm install
cp .env.example .env
npm run dev

## Environment Variables

ANTHROPIC_API_KEY=
NIA_API_KEY=
AGENTMAIL_API_KEY=
APOLLO_API_KEY=
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_CANDIDATES_TABLE=
SCREENING_BASE_URL=
HIRING_MANAGER_EMAIL=

## Built by

Karthik Sivacharan & Aniket Mahesh — OpenClaw Hackathon 2026
