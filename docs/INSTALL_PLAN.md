# OpenRecruiter: Final Install Plan

## How Claude Code Auto-Discovers Everything (No Manual Telling)

Claude Code has 6 auto-discovery mechanisms. Each session, it automatically loads:

| Mechanism | Path | When Loaded | What It Does |
|---|---|---|---|
| **CLAUDE.md** | `./CLAUDE.md` | Every session start | Master instructions. Always in context. This is how Claude knows what the project is, how to behave, what tools to use, what order to follow. |
| **Auto-memory** | `~/.claude/projects/*/memory/MEMORY.md` | Every session start | Index of persistent memories (user prefs, project decisions, feedback). Always in context. |
| **.mcp.json** | `./.mcp.json` | Every session start | MCP servers auto-connect. Tools become available without asking. |
| **Skills** | `.claude/skills/*/SKILL.md` | On keyword match | Each skill has trigger keywords in frontmatter. When you say "design" or "audit", the matching skill loads automatically. NOT always in context -- only when triggered. |
| **Plugins** | Installed via marketplace | Via lifecycle hooks | Plugins inject behavior at Setup, SessionStart, PreToolUse, PostToolUse, Stop. They modify Claude's behavior without being in the prompt. |
| **settings.json** | `.claude/settings.json` | Every session start | Permissions, hooks, env vars. Controls what Claude is allowed to do. |

### The Auto-Load Chain (Every Session)

```
Session starts
  |-> CLAUDE.md loaded (master instructions)
  |-> MEMORY.md loaded (persistent memory index)
  |-> .mcp.json loaded (MCP servers connected)
  |-> settings.json loaded (permissions + hooks)
  |-> Plugins fire SessionStart hooks
  |
User types a message
  |-> Skills match on keywords, load on demand
  |-> Plugin PreToolUse hooks fire before each tool
  |-> Plugin PostToolUse hooks fire after each tool
  |
Session ends
  |-> Plugin Stop hooks fire
```

**Result:** Claude knows what to do every session without you telling it. CLAUDE.md carries the instructions, skills activate contextually, plugins enforce process.

---

## What to Install (Final Table)

### A. Context Files (We Create These)

| # | File | Purpose | Context Cost | Auto-Loaded? |
|---|------|---------|-------------|-------------|
| 1 | `CLAUDE.md` | Master instructions: what OpenRecruiter is, architecture, test commands, MCP servers, pipeline steps, approval gates, coding standards | ~100 lines | Yes, always |
| 2 | `PRODUCT.md` | Users, brand voice, tone, anti-references. Loaded by impeccable when doing design work | ~50 lines | No, on demand |
| 3 | `DESIGN.md` | Visual design system: colors (mapped to shadcn vars), typography, spacing, components, shadows, do's/don'ts, agent prompt guide | ~300 lines | No, on demand |
| 4 | `.claude/rules/recruiting-pipeline.md` | Detailed recruiting workflow: sourcing order, enrichment chain, scoring rubric, outreach style | ~150 lines | Yes, always (rules/ is auto-loaded) |
| 5 | `.claude/rules/coding-standards.md` | TypeScript strict, no any, prefer const, error handling patterns, file size limits | ~50 lines | Yes, always |

**Note on `.claude/rules/`**: Files in this directory are auto-loaded every session, like CLAUDE.md. Use for instructions that must always apply. Use `.claude/skills/` for things that should only load on demand.

### B. Plugins (Install Once, Auto-Activate Forever)

| # | Plugin | Install Command | What It Does | How It Auto-Activates |
|---|--------|----------------|-------------|----------------------|
| 1 | **superpowers** | `/plugin install superpowers@claude-plugins-official` | Dev methodology: brainstorm > plan > TDD > subagent review > verify. 14 skills. | SessionStart hook injects process rules. Skills auto-trigger on matching actions. |
| 2 | **impeccable** | `npx impeccable skills install` | Design quality: reads PRODUCT.md + DESIGN.md, enforces anti-patterns, 23 sub-commands | Skill triggers on keywords: "design", "build", "audit", "polish", "layout", "color" |

**That's it for plugins.** Two plugins. One for dev process, one for design quality. No bloat.

### C. MCP Servers (Auto-Connect Every Session)

Create `.mcp.json` in project root:

| # | Server | What It Does | Already Connected? |
|---|--------|-------------|-------------------|
| 1 | **Apollo.io** | Candidate sourcing + enrichment | Yes (via claude.ai) |
| 2 | **Attio** | CRM pipeline tracking | Yes (via claude.ai) |
| 3 | **Twilio** | SMS follow-ups | Yes (via claude.ai) |
| 4 | **Figma** | Design file access | Yes (via claude.ai) |
| 5 | **BrowserOS** | Browser automation | Yes (via claude.ai) |
| 6 | **Granola** | Meeting notes | Yes (via claude.ai) |
| 7 | **MCP Memory** | Lightweight entity-relation graph for dev knowledge | Add to .mcp.json |
| 8 | **Sequential Thinking** | Complex reasoning chains (scoring, analysis) | Add to .mcp.json |
| 9 | **Context7** | Live documentation lookup (AI SDK docs, Next.js docs) | Add to .mcp.json |
| 10 | **Graphiti** | Recruiting knowledge graph (candidates, companies, temporal facts) | Add to .mcp.json (requires Docker) |
| 11 | **Mem0** | Per-role agent memory, context compression | Add to settings (requires API key) |

**.mcp.json to create:**

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory@2026.1.26"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking@2025.12.18"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@2.1.4"]
    },
    "graphiti-memory": {
      "type": "http",
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

**Mem0** goes in `.claude/settings.local.json` (has API key):

```json
{
  "mcpServers": {
    "mem0": {
      "command": "uvx",
      "args": ["mem0-mcp-server"],
      "env": {
        "MEM0_API_KEY": "your-key-here",
        "MEM0_DEFAULT_USER_ID": "openrecruiter"
      }
    }
  }
}
```

### D. npm Packages (Install During Project Scaffold)

| # | Package | Purpose | Install |
|---|---------|---------|---------|
| 1 | `next` | App framework | `npx create-next-app@latest` |
| 2 | `ai` | Vercel AI SDK core | `npm i ai` |
| 3 | `@ai-sdk/anthropic` | Claude provider | `npm i @ai-sdk/anthropic` |
| 4 | `shadcn/ui` | Component primitives | `npx shadcn@latest init` |
| 5 | `ai-elements` | 48 AI chat components on shadcn | `npx ai-elements@latest add conversation message prompt-input tool confirmation plan suggestion reasoning attachments sources task agent` |
| 6 | `zod` | Schema validation for tools | `npm i zod` |

### E. Skills (On-Demand, Only Load When Triggered)

These go in `.claude/skills/` with SKILL.md frontmatter defining trigger keywords:

| # | Skill | Trigger Keywords | What It Does | Source |
|---|-------|-----------------|-------------|--------|
| 1 | **scoring-rubric** | "score", "rate", "evaluate candidate" | How to score candidates 1-10, weights per role type | We write this |
| 2 | **outreach-style** | "outreach", "email", "draft", "write email" | Hyper-personalized email guide, tone, structure, max 150 words | We write this |
| 3 | **drip-sequence** | "drip", "follow-up", "follow up" | Follow-up cadence: Day 3, Day 7, Day 14, break-up email | We write this |
| 4 | **auto-reply-guide** | "reply", "respond", "candidate replied" | How to handle interested/not interested/questions | We write this |
| 5 | **follow-up-questions** | "intake", "new role", "job description" | What to ask recruiter before sourcing | We write this |

---

## Memory Architecture (Final, Clean Separation)

| System | Domain | What Goes In | Persistence |
|---|---|---|---|
| **CLAUDE.md + rules/** | Dev instructions | How to build, how to recruit, coding standards | Permanent, always loaded |
| **Auto-memory** (`~/.claude/projects/*/memory/`) | Dev knowledge | User preferences, project decisions, architecture choices, feedback | Permanent, always loaded (index only) |
| **MCP Memory Server** | Dev entities | Code patterns, API quirks discovered, tech decisions with reasoning | Permanent, queryable |
| **Graphiti + Neo4j** | Recruiting domain | Candidates, companies, roles, outreach, interactions, assessments, temporal facts | Permanent, queryable |
| **Mem0** | Agent context | Per-role working context, recruiter preferences per search, compressed session summaries | Persistent, per-agent scoped |

---

## Installation Order (Phase 0 Checklist)

```
Step 1: Create context files
  [ ] CLAUDE.md (master instructions)
  [ ] .claude/rules/recruiting-pipeline.md
  [ ] .claude/rules/coding-standards.md
  [ ] PRODUCT.md (brand/user context)
  [ ] DESIGN.md (visual design system)

Step 2: Install plugins
  [ ] /plugin install superpowers@claude-plugins-official
  [ ] npx impeccable skills install

Step 3: Create MCP config
  [ ] .mcp.json (memory, sequential-thinking, context7, graphiti)
  [ ] .claude/settings.local.json (mem0 with API key)

Step 4: Start infrastructure
  [ ] docker compose up (Graphiti + Neo4j)
  [ ] Verify Graphiti MCP endpoint responds

Step 5: Scaffold the app
  [ ] npx create-next-app openrecruiter-v2 --typescript --app
  [ ] npx shadcn@latest init (CSS Variables mode)
  [ ] npm i ai @ai-sdk/anthropic zod
  [ ] npx ai-elements@latest add conversation message prompt-input tool confirmation plan

Step 6: Create recruiting skills
  [ ] .claude/skills/scoring-rubric/SKILL.md
  [ ] .claude/skills/outreach-style/SKILL.md
  [ ] .claude/skills/drip-sequence/SKILL.md
  [ ] .claude/skills/auto-reply-guide/SKILL.md
  [ ] .claude/skills/follow-up-questions/SKILL.md

Step 7: Verify everything works
  [ ] Start new Claude Code session
  [ ] Confirm CLAUDE.md loads (check with "what project is this?")
  [ ] Confirm MCP servers connect (check with "what tools do you have?")
  [ ] Confirm skills trigger (say "score a candidate" -- scoring skill should load)
  [ ] Confirm superpowers activate (say "build a feature" -- should brainstorm first)
```

After Phase 0, every new Claude Code session automatically knows:
- What OpenRecruiter is and how to build it (CLAUDE.md)
- The recruiting pipeline and how to run it (rules/)
- How to design UI that matches our brand (PRODUCT.md + DESIGN.md via impeccable)
- To brainstorm before coding (superpowers)
- What MCP tools are available (auto-connected)
- How to score, email, and follow up (skills, on demand)
