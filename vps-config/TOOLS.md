# TOOLS.md - Recruiting Tools

## Apollo (Candidate Sourcing)
- **What:** Find candidates by title, skills, location, seniority, company
- **How:** Apollo MCP server (already configured)
- **Key actions:** people search, company search, contact enrichment
- **Rate limits:** Be mindful — cache results, don't re-query unnecessarily

## Nia / Nozomio (Recruiter Brain)
- **What:** Semantic search, candidate profiling, persistent memory
- **How:** Nia skill (clawhub install arlanrakh/nia)
- **API key:** stored at ~/.config/nia/api_key
- **Key actions:**
  - `search` — semantic search across indexed content
  - `contexts` — save/retrieve/update candidate profiles and job contexts
  - `sources` — index job descriptions for matching
- **Use for:** ranking candidates against jobs, storing screening notes, generating briefs
- **Limits:** Watch query usage (Builder plan: 1,000/month)

## AgentMail (Email)
- **What:** Send/receive emails, manage inboxes, threads, webhooks
- **How:** AgentMail skill (clawhub install agentmail)
- **Inbox:** nico@agentmail.to (or recruiter@agentmail.to)
- **Key actions:**
  - Send outreach emails
  - Reply in threads (keep conversation continuity)
  - Webhooks for inbound replies (POST to /hooks/ endpoint)
- **Limits:** Free tier: 3 inboxes, 100 emails/day, 3,000/month

## Airtable (CRM)
- **What:** Pipeline tracking — candidates, jobs, statuses
- **How:** REST API via web_fetch
- **Base URL:** https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}
- **Auth:** Bearer token in header
- **Tables:** Candidates, Jobs
- **Always update Airtable when candidate status changes**

## Retell AI (Voice Screening)
- **What:** Conversational voice agent for candidate screening
- **How:** Retell API + webhook to OpenClaw /hooks/ endpoint
- **Screening link:** candidates click to start a voice call
- **Post-call:** Retell webhook sends transcript to OpenClaw
- **Voice agent pulls candidate context from Nia before the call
