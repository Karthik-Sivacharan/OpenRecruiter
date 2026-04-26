# OpenRecruiter v2: Implementation Plan

## Goal

Build OpenRecruiter inside the **Claude Code Desktop App** so you can:
1. **Manually run** sourcing + outreach by giving a role description in the app
2. **Auto-reply** to candidate emails without a VPS (serverless webhook)
3. **Store everything** in a knowledge graph + working memory (no context bloat)

No VPS. No OpenClaw. No always-on server for the core pipeline.

**Why Claude Code Desktop (not Cowork, not bare CLI):**
- Cowork can't run local MCP servers (Graphiti breaks) and has curl permission bugs (EnrichLayer/Nia break)
- Desktop app has full MCP support (local + remote), native Bash, multi-session sidebar, and Routines
- Same engine as CLI but with visual UX for managing multiple roles/companies
- See `RUNTIME_DECISION.md` for the full comparison

---

## Phase 1: MCP Server Setup (Day 1)

### 1a. Apollo.io MCP (Already Connected)

Already available in this Claude Code session. Key tools:
- `apollo_mixed_people_api_search` -- search candidates (FREE, no credits)
- `apollo_people_match` / `apollo_people_bulk_match` -- enrich to get emails (1 credit/person)
- `apollo_contacts_create` -- save to Apollo CRM

**Workflow:**
```
Search (free) --> Enrich in batches of 10 (credits) --> Save contacts
```

**Gotcha:** Search does NOT return emails. You must enrich separately.

### 1b. Attio CRM MCP (Already Connected)

Already available. Replaces Airtable. Key tools:
- `upsert-record` -- create/update candidates (dedupes on email)
- `add-record-to-list` -- add to recruiting pipeline
- `update-list-entry-by-record-id` -- change pipeline stage
- `create-note` -- attach notes to candidates
- `create-task` -- create follow-up tasks

**Setup required (in Attio UI, not code):**
1. Create a List called "Recruiting Pipeline" on the `people` object
2. Add list attributes: `stage` (status: Sourced/Contacted/Replied/Screened/Intro'd), `role` (text), `source` (select), `rating` (number), `sourced_date` (date)

**Data mapping: Apollo --> Attio:**
| Apollo Field | Attio Field | Format |
|---|---|---|
| first_name + last_name | name | "Smith, Jane" (last first!) |
| email | email_addresses | ["jane@acme.com"] |
| title | job_title | text |
| organization_name | description | include in text |

### 1c. AgentMail MCP Skill

Install the AgentMail skill:
```bash
npx skills add agentmail-to/agentmail-skills --skill agentmail --agent claude-code
```

Set env: `AGENTMAIL_API_KEY=am_your_key`

Key capabilities: create inboxes, send emails, reply in threads, manage drafts.

### 1d. Graphiti Knowledge Graph MCP (New)

The recruiting brain. Temporal knowledge graph for company-wide memory.

**Setup:**
```bash
# Start Neo4j + Graphiti via Docker
git clone https://github.com/getzep/graphiti.git
cd graphiti/mcp_server

# Create .env
echo "OPENAI_API_KEY=sk-your-key" > .env

# Start with Neo4j backend
docker compose -f docker/docker-compose-neo4j.yml up -d

# Add to Claude Code
claude mcp add --transport http graphiti-memory http://localhost:8000/mcp/
```

**Custom entity types** -- create `config.yaml` in `mcp_server/`:
```yaml
graphiti:
  entity_types:
    - name: "Company"
      description: "A client company hiring through OpenRecruiter"
    - name: "Role"
      description: "A job position being recruited for"
    - name: "Candidate"
      description: "A person being evaluated for a role"
    - name: "Interaction"
      description: "An email, call, or meeting with a candidate"
    - name: "Assessment"
      description: "A scoring or evaluation of a candidate for a role"
```

**MCP tools available:**
| Tool | Use For |
|---|---|
| `add_episode` | Ingest candidate data, screening notes, interactions |
| `search_nodes` | Find candidates, companies, roles by semantic query |
| `search_facts` | Find relationships ("who was contacted for what role?") |
| `get_episodes` | Retrieve recent activity for a group |
| `delete_entity_edge` | Remove outdated relationships |

**Why Graphiti over MCP Memory Server:**
- Temporal facts: "Jane was interested March 1, declined March 15, now open April 20"
- Cross-role dedup: "we already contacted Jane for Company A"
- Multi-agent shared graph
- Semantic + full-text + graph traversal search

### 1e. Mem0 Working Memory MCP (New)

Per-session context compression. Prevents token bloat.

**Setup (cloud -- simplest):**
```bash
pip install mem0-mcp-server

claude mcp add --scope user --transport stdio mem0 \
  --env MEM0_API_KEY=m0-your-key \
  --env MEM0_DEFAULT_USER_ID=openrecruiter \
  -- uvx mem0-mcp-server
```

**Or self-hosted (no cloud dependency):**
```bash
# Requires Qdrant on localhost:6333, Ollama on localhost:11434
claude mcp add --scope user --transport stdio mem0 \
  --env MEM0_PROVIDER=ollama \
  --env MEM0_LLM_MODEL=qwen3:14b \
  --env MEM0_USER_ID=openrecruiter \
  -- uvx --from git+https://github.com/elvismdev/mem0-mcp-selfhosted.git mem0-mcp-selfhosted
```

**MCP tools:**
| Tool | Use For |
|---|---|
| `add_memory` | Save facts extracted from conversations |
| `search_memories` | Find relevant context for current task |
| `get_memories` | List all memories in a scope |
| `update_memory` | Update changed facts |
| `delete_memory` | Remove outdated info |

**Multi-agent scoping:**
- `user_id=eragon-ml` for Eragon ML Engineer role
- `user_id=stripe-backend` for Stripe Backend role
- `agent_id=openrecruiter` for shared agent-level facts
- `org_id=agency` for agency-wide knowledge

### 1f. Nia Plugin (Keep for GitHub Analysis Only)

```bash
# Install Nia plugin in Claude Code
/install nia
```

Only use for: Nia Tracer (GitHub repo analysis) and web search to find GitHub profiles. Do NOT use Nia Contexts for memory (replaced by Graphiti).

---

## Phase 2: CLAUDE.md + Rules (Day 1)

Create the agent instructions that replace OpenClaw's SOUL.md/AGENTS.md/TOOLS.md.

**File: `CLAUDE.md`** (project root)
```markdown
# OpenRecruiter

You are OpenRecruiter, an autonomous AI recruiting agent. You source
candidates, score them, send personalized outreach, and manage the
full recruiting pipeline.

## MCP Servers Available
- Apollo.io: candidate sourcing + enrichment
- Attio: CRM pipeline tracking
- AgentMail: email outreach + reply handling
- Graphiti: knowledge graph (companies, roles, candidates, interactions)
- Mem0: working memory (context compression)
- Nia: GitHub profile analysis via Tracer

## How to Source Candidates
1. User provides: job description URL or text, specific requirements, number of candidates
2. WebFetch the JD if URL provided
3. Add role to Graphiti: add_episode with role details
4. Apollo search: apollo_mixed_people_api_search (free, no credits)
5. Ask user to confirm before enriching (costs credits)
6. Apollo enrich: apollo_people_bulk_match (batches of 10)
7. For each candidate with email:
   a. Add to Graphiti: add_episode with candidate profile
   b. Upsert to Attio: upsert-record on people object
   c. Add to Attio pipeline: add-record-to-list with stage "Sourced"
8. Optionally: find GitHub via Nia web search, analyze with Nia Tracer
9. Score candidates using Claude (fit score 1-10)
10. Save scores to Graphiti and Attio

## How to Send Outreach
1. User approves which candidates to contact
2. For each approved candidate:
   a. Search Graphiti for candidate context
   b. Generate personalized email referencing their specific work
   c. Send via AgentMail
   d. Update Attio stage to "Contacted"
   e. Add interaction to Graphiti

## Memory Rules
- At session start: search_memories for relevant context
- After sourcing: add_memory with role details and candidate summary
- After outreach: add_memory with who was contacted
- Use Graphiti for permanent facts, Mem0 for session context
```

**File: `.claude/rules/scoring-rubric.md`**
```markdown
# Candidate Scoring Rubric (1-10)

9-10: Perfect match. All requirements met. Strong signal from GitHub/portfolio.
7-8: Strong match. Most requirements met. Some evidence of relevant work.
5-6: Moderate match. Some requirements met. Worth outreach but not top priority.
3-4: Weak match. Few requirements met. Skip unless pipeline is thin.
1-2: Not a match. Wrong domain, wrong level, or missing critical skills.

Always factor in: years of experience, company quality, skill overlap with JD,
GitHub/portfolio quality (if available), location match.
```

---

## Phase 3: Auto-Reply Without VPS (Day 2)

### Architecture: Vercel Serverless Function + AgentMail Webhook

```
Candidate replies to outreach email
  --> AgentMail webhook POST to https://your-app.vercel.app/api/agentmail-webhook
  --> Vercel serverless function (~2 seconds):
      1. Verify event type is message.received (not message.sent -- prevents loops!)
      2. Extract sender email, thread_id, message content
      3. Call Claude API to generate contextual reply
      4. Call AgentMail API to reply in same thread with screening link
      5. Update Attio status to "Replied" (via Attio API)
  --> Return 200 OK
  --> Done. No server. No WebSocket. No VPS.
```

**What to build:**
- One Vercel API route: `/api/agentmail-webhook`
- One-time webhook registration (curl or script)

**What to remove from current code:**
- `startReplyListener()` -- the WebSocket/polling logic
- Railway dependency -- no longer needed
- Express server -- only needed if you keep Retell webhooks

**Cost: $0** (Vercel free tier handles webhook requests)

### AgentMail Webhook Registration (One-Time)

```bash
curl -X POST https://api.agentmail.to/v0/webhooks \
  -H "Authorization: Bearer $AGENTMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/agentmail-webhook",
    "event_types": ["message.received"],
    "client_id": "openrecruiter-webhook"
  }'
```

---

## Phase 4: Knowledge Graph Population (Day 2)

### How Data Flows Into the Graph

Every action adds an episode to Graphiti:

```
1. New role created:
   add_episode("Eragon is hiring a Senior ML Engineer. Requirements: 5+ years ML,
   PyTorch, distributed systems. Location: SF. Salary: $200-280k.")

2. Candidate sourced:
   add_episode("Jane Doe is a Senior ML Engineer at Datadog. 7 years experience.
   Skills: Python, PyTorch, TensorFlow, distributed training. Location: SF.
   Email: jane@datadog.com. LinkedIn: linkedin.com/in/janedoe")

3. Outreach sent:
   add_episode("Sent outreach email to Jane Doe for Eragon ML Engineer role on
   2026-04-25. Subject: 'Your ML work at Datadog caught our eye'. Thread ID: abc123")

4. Reply received:
   add_episode("Jane Doe replied to Eragon ML outreach on 2026-04-26: 'Sounds
   interesting, tell me more about the team.' Sentiment: interested.")

5. Screening complete:
   add_episode("Screened Jane Doe for Eragon ML Engineer on 2026-04-28. Score: 8/10.
   Strengths: distributed training experience, strong PyTorch. Concerns: no Go.
   Salary expectation: $250k. Timeline: 2 weeks notice.")
```

Graphiti automatically:
- Extracts entities (Jane Doe, Eragon, Datadog, ML Engineer)
- Creates relationships (Jane --applied_to--> Eragon ML, Jane --works_at--> Datadog)
- Tracks temporal validity (interest valid from April 26, etc.)
- Resolves conflicts (if Jane later declines, supersedes the "interested" fact)

### Querying the Graph

```
search_nodes("candidates for Eragon ML Engineer role")
--> Returns: Jane Doe, Bob Smith, etc. with summaries

search_facts("who has been contacted for Eragon")
--> Returns: temporal facts about outreach with dates

search_nodes("Jane Doe")
--> Returns: all known facts about Jane across all roles/companies
```

---

## Phase 5: The Manual Workflow (How You Actually Use It)

### Sourcing Session

```
You: Source candidates for this role: [paste JD or URL]
     Looking for 5+ years ML experience, strong PyTorch.
     Find 20 candidates, outreach top 10.

Claude Code:
  1. WebFetch JD (if URL)
  2. add_episode to Graphiti (role context)
  3. add_memory to Mem0 (session context)
  4. apollo_mixed_people_api_search (free)
  5. Present candidates: "Found 23 matches. Here are top 20..."
  6. You: "Enrich all 20"
  7. apollo_people_bulk_match x2 (20 credits)
  8. For each: upsert to Attio + add_episode to Graphiti
  9. Optionally: Nia Tracer for GitHub analysis on top candidates
  10. Claude scores each 1-10
  11. "Top 10 ready for outreach. Approve?"

You: "Approve outreach for the top 8"

Claude Code:
  1. For each of 8 candidates:
     a. search_nodes in Graphiti for context
     b. Generate personalized email
     c. Send via AgentMail MCP
     d. Update Attio stage to "Contacted"
     e. add_episode to Graphiti (outreach sent)
  2. "8 emails sent. Replies will be auto-handled by webhook."
```

### Reply Handling (Automatic, No VPS)

```
Candidate replies "Sounds interesting!"
  --> AgentMail webhook fires
  --> Vercel function:
      1. Calls Claude API with candidate context
      2. Generates warm reply with screening link
      3. Sends via AgentMail API (reply in thread)
      4. Updates Attio to "Replied"
```

### Follow-Up Session (Next Day)

```
You: "Check pipeline status for Eragon ML role"

Claude Code:
  1. search_memories (Mem0) for recent context
  2. search_nodes (Graphiti) for "Eragon ML Engineer candidates"
  3. list-records-in-list (Attio) for pipeline status
  4. "8 contacted, 3 replied, 2 screening scheduled, 3 no response.
     Suggest: follow up with the 3 non-responders?"
```

---

## Complete MCP Server Configuration

### `.claude/settings.local.json` (or via `claude mcp add`)

```json
{
  "mcpServers": {
    "graphiti-memory": {
      "type": "http",
      "url": "http://localhost:8000/mcp/"
    },
    "mem0": {
      "command": "uvx",
      "args": ["mem0-mcp-server"],
      "env": {
        "MEM0_API_KEY": "m0-your-key",
        "MEM0_DEFAULT_USER_ID": "openrecruiter"
      }
    }
  }
}
```

Apollo, Attio, and Twilio MCP servers are already connected via claude.ai.
AgentMail is added via the skills install command.
Nia is added via `/install nia`.

---

## What We're NOT Building (Simplifications)

| Feature | Current (OpenClaw) | v2 Decision |
|---|---|---|
| Voice screening (Retell) | REST API + webhook | **Defer** -- add later via Managed Agent API trigger |
| 24/7 orchestrator | VPS daemon | **Defer** -- use manual Claude Code sessions + webhook for replies |
| Slack integration | OpenClaw channels | **Defer** -- Claude Code CLI is the interface |
| Express server | index.ts | **Remove** -- replaced by MCP tools + Vercel webhook |
| WebSocket listener | agentmail-client.ts | **Remove** -- replaced by AgentMail webhook |
| Nia Contexts (memory) | nia-client.ts | **Remove** -- replaced by Graphiti |
| Custom Node.js pipeline | pipeline.ts | **Remove** -- Claude Code orchestrates directly |

---

## Cost Estimate (Monthly)

| Item | Cost |
|---|---|
| Claude Max plan | $100-200 |
| Apollo.io (Basic, ~500 enrichments/mo) | $49 |
| Attio (Free tier, 3 seats) | $0 |
| AgentMail (Developer) | $20 |
| Graphiti (self-hosted, Docker) | $0 |
| Mem0 (Starter) | $19 |
| Nia (Builder, GitHub only) | $15 |
| Vercel (free tier for webhook) | $0 |
| Neo4j (local Docker) | $0 |
| **Total** | **$200-300/mo** |

vs. current: VPS ($20-50) + OpenClaw token waste ($200-500) + management time = probably more.

---

## Next Steps (In Order)

1. Set up Attio pipeline list in Attio UI (stage, role, source attributes)
2. Install AgentMail skill in Claude Code
3. Start Graphiti + Neo4j via Docker, connect MCP
4. Set up Mem0 MCP (cloud is fastest)
5. Write CLAUDE.md with recruiting instructions
6. Test: manually source 5 candidates for a test role (Apollo --> Attio)
7. Test: send outreach via AgentMail MCP
8. Build Vercel webhook for auto-replies
9. Test: full pipeline end-to-end
10. Add Nia Tracer for GitHub analysis on top candidates
