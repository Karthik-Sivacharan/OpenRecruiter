# EnrichLayer + Nia: Deep Enrichment & GitHub Analysis

## Why We Need Both (On Top of Apollo)

Apollo gives you: name, title, company, LinkedIn URL, work email (via enrichment credits).
Apollo does NOT give you: full job history, education details, personal emails/phones, GitHub analysis, code quality assessment.

**The enrichment pipeline:**
```
Apollo (search + basic enrich)
  --> EnrichLayer (deep LinkedIn profile + work email verification)
  --> Nia Tracer (GitHub code analysis)
  --> Claude (score everything 1-10)
```

---

## EnrichLayer API Reference

### Authentication
```
Authorization: Bearer <ENRICHLAYER_API_KEY>
Base URL: https://enrichlayer.com/api/v2
All endpoints: GET with query parameters
Rate limit: 300 req/min
```

### Key Endpoints for Recruiting

| Endpoint | What It Returns | Credits | Use Case |
|---|---|---|---|
| `/profile?profile_url=<linkedin>` | Full profile: job history, education, certs, skills, recommendations | 1 (+extras) | Deep candidate profiling |
| `/profile/email?profile_url=<linkedin>` | Verified work email (95%+ deliverability) | 3 | Better email than Apollo |
| `/contact-api/personal-email?profile_url=<linkedin>` | Personal emails (gmail, etc.) | 1/email | Reach candidates on personal email |
| `/contact-api/personal-contact?profile_url=<linkedin>` | Personal phone numbers | 1/number | Direct outreach |
| `/profile/resolve?company_domain=X&first_name=Y` | LinkedIn URL from name+company | 2 | Find LinkedIn when Apollo doesn't have it |
| `/find/company/role/?role=X&company_name=Y` | Who holds a specific role at a company | 3 | Find hiring managers for warm intros |
| `/search/person?current_role_title=X&skills=Y` | Search people by filters | 3/result | Alternative to Apollo search |
| `/profile/resolve/email?email=X` | Full profile from any email address | 3 | Reverse lookup on reply emails |
| `/company?url=<linkedin_company>` | Company profile, size, HQ, industry | 1 | Enrich company data |

### What EnrichLayer Gives That Apollo Does NOT

1. **Full LinkedIn job history** with descriptions, dates, company logos
2. **Full education** with degree, field of study, dates
3. **Personal emails and phone numbers** (Apollo only has work emails)
4. **95%+ deliverability guarantee** on work emails (Apollo is ~80-90%)
5. **Reverse phone/email lookup** -- find LinkedIn from a phone number or personal email
6. **Role lookup** -- find who is CEO/CTO/Head of Engineering at any company (for warm intros)
7. **Certifications, patents, publications, awards** from LinkedIn
8. **Profile freshness control** -- force a live crawl with `live_fetch=force`

### Calling from Claude Code (No MCP)

```bash
# Person profile (full LinkedIn data)
curl -s "https://enrichlayer.com/api/v2/profile?profile_url=https%3A%2F%2Flinkedin.com%2Fin%2Fjohndoe&skills=include&extra=include" \
  -H "Authorization: Bearer $ENRICHLAYER_API_KEY" | jq .

# Work email (95%+ deliverability)
curl -s "https://enrichlayer.com/api/v2/profile/email?profile_url=https%3A%2F%2Flinkedin.com%2Fin%2Fjohndoe" \
  -H "Authorization: Bearer $ENRICHLAYER_API_KEY" | jq .

# Find hiring manager for warm intro
curl -s "https://enrichlayer.com/api/v2/find/company/role/?role=head%20of%20engineering&company_name=eragon&enrich_profile=enrich" \
  -H "Authorization: Bearer $ENRICHLAYER_API_KEY" | jq .

# Reverse email lookup (candidate replied, who are they?)
curl -s "https://enrichlayer.com/api/v2/profile/resolve/email?email=jane%40gmail.com&enrich_profile=enrich" \
  -H "Authorization: Bearer $ENRICHLAYER_API_KEY" | jq .

# Check credit balance
curl -s "https://enrichlayer.com/api/v2/credit-balance" \
  -H "Authorization: Bearer $ENRICHLAYER_API_KEY" | jq .
```

### Pricing

| Plan | Cost | Credits | Per Credit |
|---|---|---|---|
| Pay-as-you-go | $10 | 100 | $0.10 |
| Pay-as-you-go | $100 | 3,788 | $0.026 |
| Starter (annual) | $588/yr | 35,000 | $0.017 |
| Growth (annual) | $3,588/yr | 350,000 | $0.010 |

Free trial: 500 credits. Credits never expire (unless 18 months inactive).

### Cost for 50 Candidates

```
50x Person Profile (full LinkedIn)     = 50 credits  ($1.30 at Starter rate)
50x Work Email Lookup                  = 150 credits ($2.55)
10x Personal Email (top candidates)    = 10 credits  ($0.17)
5x Role Lookup (hiring managers)       = 15 credits  ($0.26)
                                         ----
                                         225 credits  (~$3.80 at Starter rate)
```

Very affordable. The Starter annual plan ($588/yr = $49/mo) gives 35,000 credits -- enough for ~150 full enrichments per month.

---

## Nia API Reference

### Authentication
```
Authorization: Bearer <NIA_API_KEY>
Base URL: https://apigcp.trynia.ai/v2
API Key: stored at ~/.config/nia/api_key
```

### Key Endpoints for Recruiting

| Endpoint | What It Does | Credits | Use Case |
|---|---|---|---|
| `POST /v2/github/tracer` | Autonomous GitHub code analysis | 15 | Deep analysis of candidate repos |
| `POST /v2/sandbox/search` | Quick repo search (no indexing) | ~1 | Fast screening of candidate GitHub |
| `POST /v2/search` (mode: web) | Web search | 1 | Find candidate GitHub/portfolio links |
| `POST /v2/oracle/jobs` | Autonomous deep research agent | 15 | Comprehensive candidate background research |
| `POST /v2/sources` | Index a URL/repo for search | 10 | Index JD pages, company sites |
| `POST /v2/extract/detect` | Structured PDF extraction | ~5 | Parse resumes |
| `POST /v2/document/agent` | AI agent deployed into PDF | ~10 | Deep resume analysis with citations |
| `POST /v2/search` (mode: universal) | Hybrid search across indexed sources | 1 | Match candidates to indexed JDs |
| `POST /v2/contexts` | Save/retrieve agent memory | 1 | Being replaced by Graphiti |

### Nia Tracer (The Star Feature)

Autonomous GitHub analysis using Claude Opus 1M context. No other tool does this.

**Create job:**
```bash
curl -X POST "https://apigcp.trynia.ai/v2/github/tracer" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What kind of work has this developer done? What are their main skills and project quality?",
    "repositories": ["candidate-username/repo-name"],
    "context": "Evaluating for Senior ML Engineer role. Requirements: PyTorch, distributed systems.",
    "mode": "tracer-fast"
  }'
```

**Stream results:**
```bash
curl "https://apigcp.trynia.ai/v2/github/tracer/{job_id}/stream" \
  -H "Authorization: Bearer $NIA_API_KEY"
```

**Modes:**
- `tracer-fast` -- Claude Haiku, returns in seconds. Good for initial screening.
- `tracer-deep` -- Claude Opus 1M context, takes minutes. Good for final evaluation.

### Nia Sandbox Search (Quick GitHub Screening)

Search a public repo without indexing it first. Good for fast initial assessment.

```bash
curl -X POST "https://apigcp.trynia.ai/v2/sandbox/search" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "https://github.com/candidate/their-project",
    "query": "What technologies and patterns does this project use?"
  }'
```

### Nia Web Search (Find GitHub Profiles)

```bash
curl -X POST "https://apigcp.trynia.ai/v2/search" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "web",
    "query": "Jane Doe Datadog github.com",
    "num_results": 5
  }'
```

Use with `CATEGORY=github` env var to filter to GitHub results only.

### Nia Oracle (Deep Candidate Research)

Autonomous multi-step research agent. Builds a knowledge tree about a candidate.

```bash
curl -X POST "https://apigcp.trynia.ai/v2/oracle/jobs" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Build a comprehensive technical profile of this developer. What are their strengths, weaknesses, notable projects, and technical depth?",
    "repositories": ["candidate/repo1", "candidate/repo2"]
  }'
```

Takes minutes. 15 credits per job. Use only for top 5-10 shortlisted candidates.

### Nia Extract (Resume Parsing)

```bash
curl -X POST "https://apigcp.trynia.ai/v2/extract/detect" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/resume.pdf",
    "page_range": "1-3"
  }'
```

Returns structured data extracted from the PDF. Async -- poll with `GET /v2/extract/{id}`.

### Claude Code Integration

```bash
# Install Nia plugin
/install nia

# Or manually
mkdir -p ~/.config/nia
echo "your-api-key" > ~/.config/nia/api_key
```

**MCP tools exposed:**
| Tool | Use For |
|---|---|
| `mcp__nia__index` | Index repos, docs, JD pages |
| `mcp__nia__search` | Search across indexed sources |
| `mcp__nia__nia_read` | Read files from indexed repos |
| `mcp__nia__nia_grep` | Grep code across indexed repos |
| `mcp__nia__nia_explore` | Browse file trees |
| `mcp__nia__nia_research` | Oracle deep research |
| `mcp__nia__context` | Save/retrieve contexts (being replaced by Graphiti) |

### Builder Plan Budget ($15/mo)

| Resource | Limit | Per Role (50 candidates) | Roles/Month |
|---|---|---|---|
| Queries | 1,000 | ~250-500 | 2-3 roles |
| Web Searches | 200 | ~100-150 | 1-2 roles |
| Tracer Jobs | 30 | ~10-15 (top candidates only) | 2-3 roles |
| Oracle Jobs | 30 | ~5-10 (shortlist only) | 3-5 roles |
| Indexes | 50 | ~5-10 (JD + company + top candidate repos) | 5-10 roles |

**Verdict:** Builder plan is tight but workable if you use Tracer/Oracle selectively on shortlisted candidates only. For higher volume, upgrade to Team ($50/seat) or buy credit packs.

### Where Nia Is Irreplaceable

| Capability | Nia | Alternative | Verdict |
|---|---|---|---|
| **GitHub code analysis** | Tracer (Claude Opus 1M) | None in stack | **Irreplaceable** |
| **Quick repo screening** | Sandbox Search | None | **Irreplaceable** |
| **Package source search** | Package Search | None | **Irreplaceable** (niche) |
| **Web search for GitHub profiles** | Web Search | Apollo has LinkedIn, GitHub API has email lookup | **Useful supplement** |
| **Deep candidate research** | Oracle | Claude + web search tools | **Replaceable** but convenient |
| **Memory/contexts** | Contexts API | Graphiti (better) | **Replacing with Graphiti** |
| **Resume PDF parsing** | Extract / Document Agent | Dedicated parsers (Affinda) | **Replaceable** |
| **Index JD/company pages** | Sources | WebFetch in Claude Code | **Replaceable** for simple cases |

---

## Updated Enrichment Pipeline

### For Every Candidate (50 candidates)

```
1. Apollo Search (FREE)
   --> name, title, company, LinkedIn URL

2. Apollo Enrich (1 credit/person)
   --> work email (80-90% accuracy)

3. EnrichLayer Profile (1 credit)
   --> full job history, education, skills, certs
   --> only if LinkedIn URL available

4. EnrichLayer Work Email (3 credits)
   --> verified work email (95%+ deliverability)
   --> only if Apollo email bounces or is missing

5. Claude Score (tokens only)
   --> fit score 1-10 based on JD + enriched profile
```

### For Top 10-15 Shortlisted Candidates

```
6. Find GitHub (multiple approaches):
   a. GitHub API email lookup (free, ~88% hit rate)
   b. Nia Web Search with CATEGORY=github (1 credit)
   c. EnrichLayer profile often includes GitHub in extras

7. Nia Sandbox Search (quick scan, ~1 credit)
   --> fast assessment of top repos

8. Nia Tracer (deep analysis, 15 credits)
   --> only for top 5-10 candidates
   --> mode: tracer-fast for screening, tracer-deep for finalists

9. Re-score with GitHub data
   --> Claude re-scores with GitHub analysis factored in

10. EnrichLayer Role Lookup (3 credits)
    --> find hiring manager for warm intros
```

### For Finalist Candidates (Top 3-5)

```
11. Nia Oracle (deep research, 15 credits)
    --> comprehensive technical profile
    --> only for final shortlist

12. EnrichLayer Personal Contact (1 credit/number)
    --> personal phone for direct outreach

13. Warm intro to hiring manager
    --> EnrichLayer Role Lookup found the right person
    --> AgentMail sends structured candidate brief
```

---

## Cost Per Role (50 Candidates)

| Tool | Usage | Cost |
|---|---|---|
| Apollo Search | 50 candidates | FREE |
| Apollo Enrich | 50 x 1 credit | 50 Apollo credits |
| EnrichLayer Profile | 50 x 1 credit | 50 credits (~$0.85) |
| EnrichLayer Work Email | 15 x 3 credits (bounced only) | 45 credits (~$0.77) |
| Nia Web Search | 15 x 1 credit | 15 credits |
| Nia Sandbox Search | 10 x ~1 credit | 10 credits |
| Nia Tracer | 5 x 15 credits | 75 credits |
| Nia Oracle | 3 x 15 credits | 45 credits |
| EnrichLayer Role Lookup | 2 x 3 credits | 6 credits (~$0.10) |
| Claude tokens | ~100K tokens | ~$1-3 |
| **Total per role** | | **~$5-8 in API costs** |

This is extremely cost-efficient. A human recruiter costs $150-300/hour.
