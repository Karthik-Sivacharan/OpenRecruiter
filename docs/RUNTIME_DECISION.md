# Runtime Decision: Cowork vs Claude Code Desktop vs CLI

## TL;DR

**Use Claude Code Desktop App** as the primary interface. Not Cowork. Not bare CLI.

The Claude Code Desktop app (redesigned April 14, 2026) gives you the visual experience
of Cowork with the full power of Claude Code (local MCP, native Bash, file system access).

---

## Why NOT Cowork

| Issue | Impact on OpenRecruiter |
|---|---|
| **Local MCP servers broken** | Graphiti (Docker-based knowledge graph) won't connect. This is our entire brain. |
| **curl permission issues** | EnrichLayer and Nia API calls via curl are intermittently blocked in sandbox. |
| **Sandbox isolation** | Can't access Docker, can't run local services, limited filesystem. |
| **No native Bash** | Terminal is visual-only via Computer Use, not a real shell. |

Cowork is designed for knowledge workers doing document/email/spreadsheet tasks --
not for orchestrating a multi-API recruiting pipeline with local infrastructure.

## Why Claude Code Desktop App (Winner)

| Capability | Status |
|---|---|
| **All MCP servers** (local + remote) | Full support. Graphiti, Mem0, Apollo, Attio, AgentMail all work. |
| **Native Bash** | curl for EnrichLayer, Nia works perfectly. |
| **Multi-session sidebar** | Manage Eragon ML role, Stripe Backend role, etc. in parallel sessions. |
| **Built-in file editor + diff viewer** | Review candidate data, outreach emails visually. |
| **Sub-agents + Agent Teams** | Parallel sourcing across roles. |
| **Routines (cloud)** | Scheduled pipeline reviews run on Anthropic cloud. Laptop can be closed. |
| **Full file system access** | Read/write candidate data, transcripts, resumes. |
| **Integrated terminal** | Run Docker, manage Graphiti, check Neo4j. |
| **HTML/PDF preview** | Preview outreach emails before sending. |

## Why NOT bare CLI

The CLI works technically but lacks the visual multi-session management that makes
juggling multiple roles/companies practical. The Desktop app wraps the same engine
with a better UX for this use case.

## The Architecture

```
YOU (interactive)
  |
  v
Claude Code Desktop App (macOS)
  |
  |-- MCP: Apollo.io (remote, cloud)         --> candidate sourcing
  |-- MCP: Attio (remote, cloud)             --> CRM pipeline
  |-- MCP: AgentMail (skill, local)          --> email outreach
  |-- MCP: Graphiti (local, Docker)          --> knowledge graph brain
  |-- MCP: Mem0 (cloud or local)             --> working memory
  |-- MCP: Nia (plugin, remote)              --> GitHub analysis
  |-- Bash: curl EnrichLayer API             --> deep LinkedIn enrichment
  |-- Bash: curl Nia API (Tracer, Oracle)    --> deep GitHub analysis
  |
  |-- Routines (Anthropic cloud):
  |     |-- Hourly: check AgentMail for replies (or use Vercel webhook)
  |     |-- Daily: pipeline review, follow-up emails
  |     |-- Weekly: status report
  |
  |-- Vercel Serverless Function:
        |-- AgentMail webhook --> auto-reply to candidates
        |-- No VPS needed
```

## What About Cowork Later?

Once Anthropic fixes local MCP support in Cowork (issue #23424), you could migrate.
But right now (April 2026), the Desktop app is strictly superior for this use case.

If you want the "assign tasks from phone" feature (Claude Dispatch), that works with
the Desktop app too -- it sends tasks to your desktop Claude for local processing.

## Plan Compatibility

The entire implementation plan in `IMPLEMENTATION_PLAN.md` works unchanged with
Claude Code Desktop. The MCP configs, tool calls, enrichment pipeline, and knowledge
graph architecture are all identical. The only difference is:

- Instead of running `claude` in a terminal, you open the Claude Code Desktop app
- Instead of typing commands in a terminal, you type in the app's chat interface
- You get a visual sidebar to manage multiple sessions (one per role/company)
- Routines are configured from the app UI instead of `/schedule` CLI command

**No code changes needed. No config changes needed. Same plan, better UX.**

## Cost

| Item | Monthly Cost |
|---|---|
| Claude Max plan (required for Desktop) | $100-200 |
| Everything else (Apollo, Attio, AgentMail, etc.) | Same as before |
| **Total** | **$300-600/mo** (unchanged) |
