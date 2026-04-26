# OpenRecruiter v2: Claude Code Architecture

## What OpenRecruiter Is

OpenRecruiter is an autonomous AI recruiting agency. You give it a job description URL and it runs the entire recruiting pipeline without human intervention:

1. **Client Brief** -- Fetch JD from URL, extract requirements
2. **Sourcing** -- Apollo.io API finds 20-50 matching candidates
3. **Profiling** -- Nia web search finds GitHub profiles, Nia Tracer deep-analyzes repos, Claude scores each candidate 1-10
4. **CRM** -- Writes scored candidates to Attio/Airtable with pipeline stage tracking
5. **Outreach** -- AgentMail sends personalized cold emails referencing specific candidate work
6. **Engagement** -- Handles replies, auto-responds with screening link
7. **Voice Screening** -- Retell AI conducts conversational phone screens
8. **Warm Intro** -- Generates structured candidate brief, emails hiring manager

---

## Current Stack (OpenClaw on VPS) -- Problems

- OpenClaw eats tokens, bloats memory context
- Everything accumulates in one giant context window
- VPS needs maintenance, costs money, agent gets slower over time
- No structured knowledge graph -- Nia contexts are flat text
- No cross-role deduplication or temporal tracking

---

## Proposed Stack (Claude Code)

### Runtime Layer

| Layer | Tool | What It Does |
|---|---|---|
| **Interactive** | Claude Code CLI | You type the role description, kick off sourcing manually |
| **Always-on replies** | AgentMail auto-replies / webhooks | Handle candidate replies without a VPS |
| **Scheduled jobs** | Claude Code Routines (cron) | Daily pipeline review, follow-up campaigns |
| **Heavy lifting** | Claude Managed Agents (if needed) | 24/7 orchestrator for webhook processing |

### Tool Layer (MCP Servers)

| Tool | Category | MCP? | Role in Pipeline |
|---|---|---|---|
| **Apollo.io** | Sourcing | Yes (native) | Find candidates by title/skills/location, enrich contacts |
| **Attio** | CRM | Yes (native) | Pipeline tracking, notes, tasks -- replaces Airtable |
| **AgentMail** | Email | Yes (skill) | Cold outreach, reply handling, follow-ups |
| **Zep/Graphiti** | Knowledge Graph | Yes (MCP) | Company-wide temporal knowledge graph |
| **Mem0** | Working Memory | Yes (MCP) | Per-agent context compression, 80% token reduction |
| **MCP Memory Server** | Local Graph | Yes (built-in) | Lightweight fallback if Zep is overkill initially |
| **Nia/Nozomio** | Code Analysis | Yes (plugin) | GitHub Tracer for repo analysis only |
| **EnrichLayer** | Enrichment | No (REST) | LinkedIn profile data, work emails |
| **People Data Labs** | Enrichment | No (REST) | Bulk person enrichment |
| **Retell AI** | Voice | No (REST) | Phone screening calls |
| **Twilio** | SMS | Yes (native) | SMS follow-ups |
| **GitHub API** | Profile Lookup | No (Bash) | Find GitHub profiles by email |

### Memory / Brain Layer

```
Zep/Graphiti (Company-Wide Knowledge Graph)
  -- Shared across ALL agents/roles
  -- Temporal facts: "Jane was contacted March 1, declined March 15, now open April 20"
  -- Relationships: Candidate --[applied_to]--> Role --[at]--> Company
  -- Cross-role dedup: "we already contacted Jane for Company A"

Mem0 (Per-Agent Working Memory)
  -- Context compression (80% token reduction)
  -- Session-scoped, auto-summarized
  -- Each role agent has its own Mem0 scope

CLAUDE.md + .claude/rules/ (Agent Instructions)
  -- Recruiting workflow steps
  -- Email templates / tone guide
  -- Scoring rubrics
  -- Replaces SOUL.md, AGENTS.md, TOOLS.md, etc.

Files on Disk (Bulk Content)
  -- Resumes, transcripts, detailed analyses
  -- Referenced by path in knowledge graph observations
```

### Knowledge Graph Structure (Zep/Graphiti)

```
COMPANY LAYER
  (Company: Eragon) --[has_role]--> (Role: Eragon_MLEngineer)
  (Company: Eragon) --[has_role]--> (Role: Eragon_ProductDesigner)
  (Company: Stripe) --[has_role]--> (Role: Stripe_SeniorBackend)

CANDIDATE LAYER
  (Candidate: Jane_Doe)
    fact: "7 years backend, Python/Go" [valid: always]
    fact: "Currently at Datadog" [valid: 2024-01 to present]
    fact: "Declined Eragon ML role" [valid: 2026-03-15 to present]
    fact: "Open to new roles again" [valid: 2026-04-20 to present]

    --[applied_to]--> (Role: Eragon_MLEngineer) [invalid: 2026-03-15]
    --[contacted_by]--> (Agent: Eragon_Recruiter) [2026-03-01]
    --[screened_for]--> (Role: Stripe_SeniorBackend) [2026-04-22]

INTERACTION LAYER
  (Email: Jane_Outreach_Mar1) --[sent_to]--> (Candidate: Jane_Doe)
  (Call: Jane_Screen_Apr22) --[about]--> (Role: Stripe_SeniorBackend)
  (Assessment: Jane_Stripe) --[evaluates]--> (Candidate: Jane_Doe)
```

---

## Workflow: How You'd Use It

### Manual Run (Claude Code CLI)

```
You: "Source candidates for this role: https://eragon.ai/careers/ml-engineer
      5+ years ML, strong PyTorch. Find 20, outreach top 10."

Claude Code:
  1. WebFetch the JD
  2. Save role to Zep/Graphiti knowledge graph
  3. Apollo MCP: search for ML engineers
  4. EnrichLayer: enrich LinkedIn profiles
  5. Nia Tracer: analyze GitHub repos
  6. Claude: score each candidate 1-10
  7. Zep: create candidate entities + relations
  8. Attio MCP: create pipeline records
  9. You approve outreach
  10. AgentMail MCP: send personalized emails
  11. Attio: update status to "Contacted"
```

### Auto-Reply (AgentMail -- No VPS Needed)

AgentMail has built-in auto-reply capabilities and webhook-to-email flows. Options:
- AgentMail webhook --> Claude Code Routine (API trigger)
- AgentMail auto-responder rules (no code needed for simple replies)
- AgentMail webhook --> Claude Managed Agent (for complex reply handling)

### Scheduled (Claude Code Routines)

- Daily: check for stale candidates, send follow-ups
- Weekly: pipeline status report
- On webhook: process Retell screening transcripts

---

## Cost Estimate

| Item | Monthly Cost |
|---|---|
| Claude Max plan | $100-200 |
| Claude tokens (Sonnet for most, Opus for scoring) | $50-150 |
| Apollo.io (Basic) | $49 |
| Attio (Free or Plus) | $0-36 |
| AgentMail (Developer) | $20 |
| Zep Cloud (or self-host free) | $0-25 |
| Mem0 (Starter) | $19 |
| Nia (Builder, GitHub analysis only) | $15 |
| Retell AI (per-minute) | $50-100 |
| **Total** | **$300-600/mo** |

---

## Migration from OpenClaw

| Current (OpenClaw) | New (Claude Code) |
|---|---|
| SOUL.md, IDENTITY.md | CLAUDE.md |
| AGENTS.md | .claude/rules/recruiting-pipeline.md |
| TOOLS.md | MCP server configs in settings.json |
| HEARTBEAT.md | Claude Code Routines (cron) |
| USER.md | CLAUDE.md user preferences section |
| Nia Contexts (flat text memory) | Zep/Graphiti (temporal graph) |
| Express server for webhooks | Managed Agent API triggers |
| VPS (24/7) | Managed Agents + Routines (cloud) |
| OpenClaw skills (clawhub) | MCP servers + .claude/rules/ |
