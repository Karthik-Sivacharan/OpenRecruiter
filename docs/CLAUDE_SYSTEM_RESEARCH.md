# OpenRecruiter: Claude System Setup Research

Consolidated research from 6 repos. This is the decision document for what to install, adopt, and build.

---

## THE BIG PICTURE

We need 5 layers for a robust Claude Code setup:

| Layer | What | Source Repos |
|-------|------|-------------|
| **1. Process & Discipline** | Brainstorm > Plan > TDD > Review > Verify | superpowers |
| **2. Project Context** | CLAUDE.md, PRODUCT.md, DESIGN.md, AGENTS.md | everything-claude-code, impeccable, awesome-design-md |
| **3. UI & Design System** | Chat components + visual design tokens | ai-elements, awesome-design-md, impeccable |
| **4. Skills & Superpowers** | Reusable slash commands + agent patterns | awesome-claude-skills, everything-claude-code, superpowers |
| **5. MCP & Integrations** | Apollo, Attio, AgentMail, Graphiti, etc. | Already planned in FINAL_PLAN.md |

---

## LAYER 1: PROCESS & DISCIPLINE (superpowers)

### What to Install

```bash
/plugin install superpowers@claude-plugins-official
```

This gives us a full development methodology that auto-activates:

| Skill | What It Enforces | When It Fires |
|-------|-----------------|---------------|
| **brainstorming** | Design-first. Explore context, ask questions, write spec before code | Any new feature request |
| **writing-plans** | Granular plans with file paths, code blocks, test commands | After spec is approved |
| **executing-plans** | Checkpoint reviews, TodoWrite tracking, blocker escalation | During implementation |
| **subagent-driven-development** | Fresh subagent per task + 2-stage review (spec + quality) | Multi-file features |
| **dispatching-parallel-agents** | Launch multiple agents for independent problems | Independent subsystems |
| **test-driven-development** | RED-GREEN-REFACTOR. No prod code without failing test first | All code changes |
| **systematic-debugging** | 4-phase root cause analysis. No guessing | When tests fail |
| **verification-before-completion** | Fresh evidence required. No "should work" | Before any completion claim |
| **finishing-a-development-branch** | Test verify > 4 options (merge/PR/keep/discard) > cleanup | End of feature work |

**Full lifecycle:** brainstorm > write-plan > git-worktree > subagent-execute > code-review > verify > finish-branch

### Why This Matters

Without this, Claude just starts coding. With superpowers, it designs first, plans second, codes third, reviews fourth. Every API integration (Apollo, Attio, AgentMail, etc.) gets proper upfront design instead of trial-and-error.

---

## LAYER 2: PROJECT CONTEXT FILES

### Files to Create

| File | Purpose | Source Pattern |
|------|---------|---------------|
| **`CLAUDE.md`** | Master instructions: project overview, test commands, architecture map, tool order, MCP servers, approval gates | everything-claude-code |
| **`PRODUCT.md`** | Users, brand voice, tone, anti-references, register (product). Forces AI to work from OUR context not generic training data | impeccable |
| **`DESIGN.md`** | Full visual design system: colors, typography, spacing, components, shadows, motion, do's/don'ts, agent prompt guide | awesome-design-md + impeccable |
| **`AGENTS.md`** | Coding style, security guidelines, agent orchestration rules, testing requirements | everything-claude-code |
| **`WORKING-CONTEXT.md`** | Living doc: current state, active work, constraints, blockers. Updated each session | everything-claude-code |

### CLAUDE.md Structure (from everything-claude-code)

```
# OpenRecruiter
## Project Overview (2 sentences)
## Running Tests (exact commands)
## Architecture (directory map)
## MCP Servers Available (table)
## Key Commands (slash commands table)
## Pipeline Steps (recruiting workflow)
## Approval Gates (what requires human confirmation)
## Memory Rules (Graphiti vs Mem0 vs session)
## Development Notes (package manager, conventions)
```

### PRODUCT.md Structure (from impeccable)

```
# OpenRecruiter Product Context
## Users (recruiter persona, candidate persona)
## Brand Voice (warm, direct, no corporate fluff)
## Register: product (design serves the product, not IS the product)
## Anti-References (what we do NOT look like: generic SaaS, LinkedIn recruiter spam)
## Strategic Principles (autonomous but human-approved, transparent pipeline)
```

### DESIGN.md Structure (from awesome-design-md, 9 sections)

```
1. Visual Theme & Atmosphere
2. Color Palette & Roles (mapped to shadcn CSS variables)
3. Typography Rules (hierarchy table)
4. Component Stylings (buttons, cards, inputs, badges)
5. Layout Principles (spacing scale, grid, whitespace)
6. Depth & Elevation (shadow levels with CSS values)
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide (copy-paste prompts for Claude)
10. Motion & Transitions (custom addition - message animations, typing indicators)
```

**Design Inspirations (ranked by relevance):**

| Product | What to Borrow | Why |
|---------|---------------|-----|
| **Intercom** | Chat surfaces, warm cream backgrounds, scale-based hover | Chat-first messaging platform, closest to our UX |
| **Claude** | AI chat aesthetic, dark/light sections, ring shadow system | AI chat interface, same domain |
| **Linear** | Dark mode components, status badges, translucent cards | Best status indicator patterns for pipeline stages |
| **Notion** | Warm neutrals, whisper-weight borders, pill badges | Skill tags for candidates |
| **Superhuman** | Luxury productivity aesthetic, tight typography | Premium email tool, same energy |

**Key Design Rules:**
- Warm neutrals everywhere (never pure black/white, always tinted)
- Map tokens directly to shadcn CSS variables (--background, --primary, etc.)
- 8px base spacing unit
- Negative letter-spacing on display headings (tighten as size increases)
- No AI-slop: no side-stripe borders, no gradient text, no glassmorphism, no bounce easing, no nested cards

---

## LAYER 3: UI COMPONENTS (ai-elements + shadcn)

### What to Install

```bash
# Prerequisites
npx shadcn@latest init        # shadcn/ui with CSS Variables mode
npx ai-elements@latest         # Install ALL 48 components

# Or install selectively (recommended to start):
npx ai-elements@latest add conversation
npx ai-elements@latest add message
npx ai-elements@latest add prompt-input
npx ai-elements@latest add tool
npx ai-elements@latest add confirmation
npx ai-elements@latest add plan
npx ai-elements@latest add task
npx ai-elements@latest add suggestion
npx ai-elements@latest add reasoning
npx ai-elements@latest add attachments
npx ai-elements@latest add sources
npx ai-elements@latest add agent
```

### Component Map for OpenRecruiter

| Component | Our Use Case | Priority |
|-----------|-------------|----------|
| **conversation** | Main chat container with auto-scroll, download-as-markdown | P0 |
| **message** | User/assistant message bubbles with branching | P0 |
| **prompt-input** | Chat input with file attachments (resumes, JDs) | P0 |
| **tool** | Display recruiting actions (searching Apollo, enriching, sending emails) | P0 |
| **confirmation** | Approve sensitive actions (send outreach, spend credits) | P0 |
| **plan** | Show agent's recruiting plan as a visible checklist | P0 |
| **task** | Expandable task items within the plan | P1 |
| **suggestion** | Quick-reply buttons ("Approve outreach", "Show pipeline", "Score candidates") | P1 |
| **reasoning** | Show agent's thinking (candidate scoring rationale) | P1 |
| **attachments** | Handle resumes, JDs, candidate profiles as files | P1 |
| **sources** | Cite candidate profiles, LinkedIn pages, GitHub repos | P1 |
| **agent** | Agent identity card ("OpenRecruiter - Autonomous Recruiting Agent") | P2 |
| **code-block** | Display API responses, candidate data | P2 |
| **model-selector** | Switch between Sonnet (fast) and Opus (deep scoring) | P2 |

### Key Technical Details

- Built on **shadcn/ui** -- uses its primitives (Button, Tooltip, Collapsible, etc.)
- Direct dependency on **AI SDK v6** (`ai@6.0.105`)
- Components consume `UIMessage` types from `useChat`
- Streaming support throughout via `streamdown` library
- Markdown rendering with CJK, code, math, Mermaid plugins
- **You own the source** -- components are installed into your codebase, fully customizable
- Dark mode built-in (Shiki themes adapt, persona adapts)

---

## LAYER 4: SKILLS & SUPERPOWERS

### Tier 1 -- Install Immediately (Core Dev Process)

| Skill | Source | What It Does |
|-------|--------|-------------|
| **superpowers** (full plugin) | obra/superpowers | Entire dev methodology: brainstorm > plan > TDD > review > verify |
| **impeccable** | pbakaus/impeccable | Design quality enforcement, 23 sub-commands, anti-pattern detection |
| **prompt-engineering** | awesome-claude-skills | Anthropic best practices for building agent prompts |
| **software-architecture** | awesome-claude-skills | Clean Architecture, SOLID principles |

### Tier 2 -- Install for Feature Development

| Skill | Source | What It Does |
|-------|--------|-------------|
| **MCP Builder** | awesome-claude-skills | Build custom MCP servers for our recruiting tools |
| **Playwright Browser Automation** | awesome-claude-skills | Test the Next.js chat app |
| **deep-research** | awesome-claude-skills | Autonomous multi-step research (candidate/company research) |
| **Lead Research Assistant** | awesome-claude-skills | Lead qualification and outreach strategies |
| **Skill Seekers** | awesome-claude-skills | Convert any docs site into a Claude skill (Vercel AI SDK docs, Graphiti docs) |

### Tier 3 -- Install When Needed

| Skill | Source | What It Does |
|-------|--------|-------------|
| **Composio Connect** | awesome-claude-skills | Gateway to 1000+ SaaS app actions if we need beyond our MCP servers |
| **tapestry** | awesome-claude-skills | Knowledge network creation from documents |
| **pdf** | awesome-claude-skills | Resume parsing |
| **firecrawl-automation** | awesome-claude-skills | Scrape job descriptions from career pages |

### Skills We Already Have (built into our Claude Code)

These are the skills already available in our current session (from the system prompt):

| Skill | Relevance |
|-------|-----------|
| `/tools:tdd-red`, `/tools:tdd-green`, `/tools:tdd-refactor` | TDD workflow (superpowers may be better) |
| `/workflows:feature-development` | Feature dev with specialized agents |
| `/workflows:full-review` | Multi-agent code review |
| `/workflows:security-hardening` | Security-first architecture |
| `/tools:smart-debug` | Debug with specialized agents |
| `/tools:api-scaffold` | API endpoint scaffolding |
| `/tools:security-scan` | Vulnerability assessment |
| `/tools:deps-audit` | Dependency audit |
| `/frontend-design:frontend-design` | Distinctive frontend interfaces |
| `/figma:figma-implement-design` | Figma to code |

### What NOT to Install (Context Window Protection)

| Skip | Why |
|------|-----|
| 800+ Composio bulk skills | Auto-generated, bloats context. Use Connect gateway instead |
| ATS-specific skills (Lever, Ashby, etc.) | We're building our own pipeline, not integrating with existing ATS |
| Social media automation skills | Not part of MVP |
| Analytics skills (PostHog, Amplitude) | Add later when we have users |
| Voice/media skills | Defer Retell integration per plan |

---

## LAYER 5: MCP SERVERS & CONFIG

### .mcp.json (Project-Level, from everything-claude-code patterns)

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

Plus the already-connected MCP servers: Apollo.io, Attio, Twilio, Figma, Granola, BrowserOS.

### Hooks (from everything-claude-code)

| Hook | Trigger | Purpose |
|------|---------|---------|
| Pre-Write quality gate | `PreToolUse` on `Write` | Lint + typecheck before file writes |
| Pre-Bash safety | `PreToolUse` on `Bash` | Block dangerous commands |
| Post-session save | `Stop` | Auto-save context to WORKING-CONTEXT.md |

### Memory Architecture (3-Tier)

| Tier | Mechanism | Persistence | Use Case |
|------|-----------|-------------|----------|
| **Short-term** | TodoWrite / in-session tasks | Session only | Current task tracking |
| **Medium-term** | `~/.claude/projects/*/memory/*.md` | Cross-session | Project decisions, user prefs |
| **Long-term** | Graphiti knowledge graph | Permanent | Candidates, companies, interactions, temporal facts |

---

## RECOMMENDED INSTALLATION ORDER

### Phase 0: Foundation Setup (Before Any Coding)

1. **Install superpowers plugin** -- gives us the development methodology
2. **Create CLAUDE.md** -- master project instructions
3. **Create PRODUCT.md** -- brand/user context for AI
4. **Create DESIGN.md** -- visual design system mapped to shadcn vars
5. **Create AGENTS.md** -- coding standards + agent orchestration rules
6. **Set up .mcp.json** -- memory, sequential-thinking, context7
7. **Install impeccable** -- design quality enforcement
8. **Configure hooks** -- pre-write quality gate, pre-bash safety

### Phase 1: Scaffold (from FINAL_PLAN.md Phase 1)

9. `npx create-next-app` with TypeScript + App Router
10. `npx shadcn@latest init` (CSS Variables mode, warm neutral theme)
11. `npx ai-elements@latest add conversation message prompt-input tool confirmation plan`
12. Install AI SDK: `ai`, `@ai-sdk/anthropic`
13. Build `/api/chat/route.ts` skeleton + wire up chat UI

### Phase 2+: Follow FINAL_PLAN.md phases with superpowers process

Each feature goes through: brainstorm > plan > worktree > TDD > subagent-execute > review > verify > merge

---

## CONTEXT WINDOW BUDGET

The key tension: we want all these superpowers but can't bloat the context window.

| What | Context Cost | Strategy |
|------|-------------|----------|
| CLAUDE.md | ~100 lines | Always loaded. Keep concise |
| PRODUCT.md | ~50 lines | Loaded by impeccable on demand |
| DESIGN.md | ~300 lines | Loaded by impeccable/frontend-design on demand |
| Superpowers skills | ~200 lines each | Auto-loaded contextually (only active skill loads) |
| Impeccable references | ~100 lines each | Loaded per sub-command on demand |
| ai-elements source | 0 (in codebase) | Read from files only when editing UI |
| MCP tool schemas | ~50 lines each | Loaded per server on first tool call |
| Graphiti/Mem0 results | Variable | Keep queries focused, compress with Mem0 |

**Total always-loaded context: ~150 lines** (CLAUDE.md + MEMORY.md). Everything else loads on demand. This is the right balance.

---

## DECISION SUMMARY

| Decision | Choice | Why |
|----------|--------|-----|
| Dev methodology | superpowers | Most complete: brainstorm > plan > TDD > review > verify |
| Design enforcement | impeccable + DESIGN.md | Anti-pattern detection + structured design tokens |
| Chat UI components | ai-elements (shadcn-based) | 48 components, native AI SDK integration, we own the source |
| Visual design language | Warm neutrals, Intercom/Claude-inspired | Chat-first, approachable, professional |
| Context files | CLAUDE.md + PRODUCT.md + DESIGN.md + AGENTS.md | Structured context loading, not context bloat |
| Memory architecture | 3-tier (session + project files + Graphiti) | Right tool for right timescale |
| Skills strategy | Superpowers core + selective awesome-claude-skills | Process discipline + domain skills, skip bulk |
| Context protection | On-demand loading only | ~150 lines always-loaded, rest contextual |
