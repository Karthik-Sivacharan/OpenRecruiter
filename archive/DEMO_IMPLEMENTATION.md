# OpenRecruiter — Demo Implementation Plan

## The Demo Flow

```
You (Slack): /hire https://eragon.ai/careers/founding-engineer

OpenRecruiter: reacts with eyes emoji, starts streaming in thread

  Step 1: "Reading the job description..."
    → web_fetch the URL
    → Extract role, requirements, location, level
    → Index JD into Nia (nia sources)

  Step 2: "Searching for candidates..."
    → Apollo people search (title, skills, location)
    → Returns 30-50 matching candidates

  Step 3: "Profiling top candidates..."
    → Save each candidate to Nia as context (tags: candidate, status:sourced)
    → Nia semantic search: rank candidates against JD
    → Select top 15

  Step 4: "Adding to pipeline..."
    → Create Airtable records for top 15
    → Status: "Sourced"
    → Posts: "Found 47 candidates. Top 15 added to pipeline. [Airtable link]"

  Step 5: "Preparing outreach..."
    → For each top candidate, generate personalized email using Nia context
    → Posts final message with interactive buttons:
      "Top 15 candidates ready. Approve outreach?
       [Approve All] [Review One by One]"

  Step 6: On "Approve All" click
    → Exec approval modal: "Send email to priya@example.com? [Approve] [Deny]"
    → On approve: AgentMail sends email
    → Updates Airtable status to "Contacted"
    → Posts: "Sent 15 outreach emails. Waiting for replies."

  Step 7: Candidate replies (webhook)
    → AgentMail webhook fires → OpenClaw hook endpoint
    → Agent posts in thread: "Priya replied: 'Sounds interesting!'"
    → Agent drafts response with screening link
    → Posts with buttons: [Send] [Edit]

  Step 8: Candidate screens (voice call)
    → Candidate clicks screening link
    → Retell voice agent pulls context from Nia
    → After call: Retell webhook → transcript saved to Nia
    → Agent posts: "Screened Priya. Strong fit. [Send follow-up] [Skip]"

  Step 9: Warm intro
    → Agent generates candidate brief from Nia
    → Sends to hiring manager via AgentMail
    → Updates Airtable: "Intro'd"
    → Posts: "Warm intro sent to hiring@eragon.ai"
```

---

## Two Audiences

| Audience | What They See | Channel |
|---|---|---|
| **You (recruiter)** | Full pipeline in Slack + Airtable CRM link | Slack thread + Airtable |
| **Candidate** | Personalized email → screening link → follow-up → intro | AgentMail emails + Retell voice |

---

## OpenClaw Config Checklist

| Config | File | Status |
|---|---|---|
| AgentMail skill installed | clawhub install | Done |
| Nia skill installed | clawhub install | Done |
| AgentMail API key | openclaw.json → skills.entries.agentmail.env | TODO |
| Nia API key | openclaw.json → skills.entries.nia.env + ~/.config/nia/api_key | Done |
| Apollo API key | openclaw.json → skills.entries or env | TODO |
| Airtable API key + base ID | openclaw.json → env or TOOLS.md | TODO |
| AGENTS.md | ~/.openclaw/workspace/AGENTS.md | Done |
| SOUL.md | ~/.openclaw/workspace/SOUL.md | Kept as-is |
| USER.md | ~/.openclaw/workspace/USER.md | Done |
| TOOLS.md | ~/.openclaw/workspace/TOOLS.md | Done |
| IDENTITY.md | ~/.openclaw/workspace/IDENTITY.md | Done |
| HEARTBEAT.md | ~/.openclaw/workspace/HEARTBEAT.md | Done |
| SKILL.md | ~/.openclaw/workspace/skills/open-recruiter/SKILL.md | Done (needs slash command update) |
| Slack interactive buttons | openclaw.json → channels.slack.interactiveReplies | TODO |
| Slack exec approvals | openclaw.json → channels.slack.execApprovals | TODO |
| AgentMail webhook → OpenClaw hooks | Register on AgentMail + hook mapping in openclaw.json | TODO |
| Retell webhook → OpenClaw hooks | Configure Retell webhook URL | TODO |
| Gateway restart | openclaw gateway restart | After all config done |

---

## Implementation Phases

### Phase 1: Core Config (30 min)
- [ ] Add AgentMail API key to openclaw.json
- [ ] Add Apollo API key to openclaw.json (or env)
- [ ] Create Airtable base (Candidates + Jobs tables)
- [ ] Add Airtable API key + base ID to TOOLS.md or env
- [ ] Enable Slack interactive buttons in openclaw.json
- [ ] Add Slack exec approvals (copy from existing Telegram config)
- [ ] Restart gateway
- [ ] Test: message the bot in Slack, confirm it responds

### Phase 2: Apollo Sourcing (1 hr)
- [ ] Test Apollo search from OpenClaw (via MCP, skill, or exec)
- [ ] Verify: "find product designers in SF" returns candidates
- [ ] Test: candidate data includes name, email, title, company, LinkedIn

### Phase 3: Nia Profiling (1 hr)
- [ ] Test: index a job description URL into Nia
- [ ] Test: save a candidate as Nia context with tags
- [ ] Test: semantic search — "rank these candidates against the JD"
- [ ] Test: retrieve candidate context by tag/name

### Phase 4: AgentMail Outreach (1 hr)
- [ ] Create inbox (nico@agentmail.to or similar)
- [ ] Test: send an email to yourself
- [ ] Test: reply to the email
- [ ] Register AgentMail webhook → OpenClaw /hooks/ endpoint
- [ ] Test: webhook fires when you reply, agent picks it up

### Phase 5: Airtable CRM (30 min)
- [ ] Test: create a candidate record via API
- [ ] Test: update status field
- [ ] Test: agent can read/write Airtable from OpenClaw
- [ ] Verify: Airtable link is shareable and looks good

### Phase 6: Wire Full Pipeline (1.5 hr)
- [ ] Update SKILL.md with slash command `/hire`
- [ ] Test: `/hire [url]` → agent reads JD → searches Apollo → profiles via Nia → creates Airtable records → presents candidates with buttons
- [ ] Test: approve outreach → emails send via AgentMail
- [ ] Test: reply to email → webhook fires → agent handles reply
- [ ] Test: full thread stays coherent in Slack

### Phase 7: Voice Screening (1.5 hr)
- [ ] Duplicate existing Retell voice agent
- [ ] New system prompt: screening only, no job matching
- [ ] Add pre-call: fetch candidate context from Nia
- [ ] Configure Retell webhook → OpenClaw /hooks/ endpoint
- [ ] Test: do a screening call, verify transcript saves to Nia
- [ ] Test: agent sends follow-up email after call

### Phase 8: Demo Polish (1 hr)
- [ ] Pre-source candidates (cache Apollo results)
- [ ] Pre-create Airtable base with clean data
- [ ] Test end-to-end 3 times
- [ ] Whitelist demo email addresses
- [ ] Record backup video of each step
- [ ] Prepare Airtable view for demo (filtered, sorted, pretty)

---

## Slash Command Setup

Update SKILL.md frontmatter:
```yaml
---
name: open-recruiter
description: Autonomous recruiting pipeline...
user-invocable: true
metadata: {"openclaw":{"emoji":"🎯","requires":{"env":["AGENTMAIL_API_KEY","NIA_API_KEY"]}}}
---
```

The `/hire` command gets defined in the skill body. OpenClaw auto-registers user-invocable skills as slash commands.

---

## openclaw.json Changes Needed

### Add to channels.slack:
```json
"execApprovals": {
  "enabled": true,
  "approvers": ["YOUR_SLACK_USER_ID"],
  "agentFilter": ["main"],
  "target": "dm"
}
```

### Add to skills.entries:
```json
"agentmail": {
  "enabled": true,
  "env": { "AGENTMAIL_API_KEY": "..." }
},
"nia": {
  "enabled": true,
  "env": { "NIA_API_KEY": "..." }
}
```

### Add hook mapping for AgentMail webhook:
```json
{
  "match": { "path": "/hooks/recruiter-email" },
  "action": "agent",
  "name": "recruiter-email",
  "deliver": true,
  "allowUnsafeExternalContent": true
}
```

---

## Webhook URLs

| Service | Webhook URL | Event |
|---|---|---|
| AgentMail | https://YOUR_VPS_IP:18788/hooks/recruiter-email | message.received |
| Retell | https://YOUR_VPS_IP:18788/hooks/recruiter-call | call.completed |

Note: Gateway runs on port 18788 (from your config). These need to be publicly accessible — may need to configure firewall or reverse proxy.

---

## Model Choice

Current: `anthropic/claude-haiku-4.5` — fast but may not produce impressive reasoning streams for demo.

For demo, consider switching to a stronger model that shows reasoning:
- Sonnet 4.6 (good balance of speed + intelligence)
- Opus (most impressive but slower)

Change in openclaw.json → agents.defaults.model.primary

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Apollo rate limits | Pre-source candidates, cache results |
| Nia query limit (Builder: 1000/mo) | Be selective, ask sponsor for credits |
| AgentMail emails hit spam | Send to yourself, whitelist |
| Webhook not reachable | Ensure VPS port 18788 is open, or use ngrok/reverse proxy |
| Model too slow for demo | Pre-warm with a test query, or use faster model |
| Full pipeline too ambitious | Cut scope: Apollo→Nia profiling + AgentMail outreach is must-have. Voice is stretch. |
| Demo breaks live | Recorded backup of each step |

---

## Demo Script (3-4 min live)

### Act 1: "The Brief" (15 sec)
"Eragon needs a founding engineer. Let me show you how OpenRecruiter handles this."
Type: `/hire https://eragon.ai/careers/founding-engineer`

### Act 2: "Sourcing + Profiling" (45 sec)
Watch the agent stream its reasoning, call Apollo, profile via Nia, add to Airtable.
Show Airtable updating in real-time.

### Act 3: "Outreach" (30 sec)
Approve outreach → emails go out via AgentMail.
Show email arriving in presenter's inbox.

### Act 4: "Candidate Responds" (30 sec)
Reply to the email: "Sounds interesting!"
Show webhook firing → agent handling reply → screening link sent.

### Act 5: "Voice Screening" (60 sec)
Quick screening call. Agent already knows the candidate.

### Act 6: "Warm Intro" (30 sec)
Agent sends candidate brief to hiring manager.
Show email arriving. Pipeline complete.

### Mic Drop
"One Slack command. Full recruiting pipeline. No human recruiter needed."
