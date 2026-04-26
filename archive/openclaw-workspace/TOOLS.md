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
- **How:** Maton gateway (skill: airtable) — proxies OAuth to Airtable
- **Maton API key:** stored at ~/.config/maton/api_key + ~/.openclaw/workspace/config/airtable.env
- **Airtable PAT (schema writes):** stored at ~/.config/airtable/pat — use direct api.airtable.com for field creation
- **Base:** "Eragon OpenRecruiter" (appPtB1mQBV5XgM1u)
- **Tables:**
  - Candidates: tblmS7gKaIjVirkI6
- **Base URL:** https://gateway.maton.ai/airtable/v0/{BASE_ID}/{TABLE_NAME}
- **Auth:** `Authorization: Bearer $MATON_API_KEY`
- **Pipeline Stage options:** Sourced, Contacted, Responded, Interviewing, Screened, Offer, Hired, Rejected
- **Tags options:** Python, Data, Engineering, Automation, Backend, Frontend, Design, etc.
- **Always update Airtable when candidate status changes**

## People Data Labs (PDL)
- **What:** Person enrichment — skills, social profiles, GPA, full experience/education, websites
- **How:** REST API via curl/web_fetch — X-Api-Key header
- **API key:** stored at ~/.config/peopledatalabs/api_key
- **Base URL:** `https://api.peopledatalabs.com/v5/`
- **Key endpoint:** `GET /person/enrich?profile=<linkedin_url>&email=<email>`
- **Auth header:** `X-Api-Key: <api_key>`
- **Best for:** skills list, GPA, Facebook/additional profiles, structured experience

## GitHub API (Profile Lookup)
- **What:** Reverse-lookup GitHub profiles by email or name; get portfolio/website URLs
- **How:** GraphQL API via urllib — Bearer token auth
- **Token:** stored at ~/.config/github/token
- **Endpoint:** `https://api.github.com/graphql`
- **Query:** `search(query: "<email> in:email", type: USER, first: 1)`
- **Fallback:** name-based search if email returns nothing
- **Returns:** login, url, websiteUrl, bio
- **Hit rate:** ~88% on AI/ML candidates (22/25 in dry run)

## EnrichLayer (Profile Enrichment)
- **What:** Enrich LinkedIn profiles, look up work emails, contact numbers, company data
- **How:** REST API via web_fetch — Bearer token auth
- **API key:** stored at ~/.config/enrichlayer/api_key
- **Base URL:** `https://enrichlayer.com/api/v2/`
- **Key endpoints:**
  - `/profile?profile_url=<linkedin_url>` — full profile enrichment
  - `/work-email?profile_url=<linkedin_url>` — verified work email
  - `/personal-contact-number?profile_url=<linkedin_url>` — phone numbers
- **Auth header:** `Authorization: Bearer <api_key>`

## Retell AI (Voice Screening)
- **What:** Conversational voice agent for candidate screening
- **How:** Retell API + webhook to OpenClaw /hooks/ endpoint
- **Screening link:** candidates click to start a voice call
- **Post-call:** Retell webhook sends transcript to OpenClaw
- **Voice agent pulls candidate context from Nia before the call

