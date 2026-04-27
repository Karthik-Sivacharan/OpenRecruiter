# EnrichLayer + Nia: Deep Enrichment & GitHub Analysis

## Why We Need Both (On Top of Apollo)

Apollo gives you: name, title, company, LinkedIn URL, work email (via enrichment credits).
Apollo does NOT give you: full job history, education details, personal emails/phones, GitHub analysis, code quality assessment.

**The enrichment pipeline:**
```
Apollo (search + basic enrich)
  --> EnrichLayer (deep profile + personal emails)
  --> Nia Tracer (GitHub code analysis)
  --> Claude (score everything 1-10)
```

---

## EnrichLayer API Reference

> **TODO:** Review Airtable field mapping to ensure all EnrichLayer fields are captured optimally.

### Authentication
```
Authorization: Bearer <ENRICHLAYER_API_KEY>
Base URL: https://enrichlayer.com/api/v2
All endpoints: GET with query parameters
Rate limit: 300 req/min
```

### API is URL-Based

EnrichLayer takes LinkedIn URLs directly — no ID lookup step needed.

### Key Endpoints for Recruiting

#### Profile API (People)

| Endpoint | Required Params | Optional Params | Credits | Returns |
|---|---|---|---|---|
| `GET /profile` | `profile_url` (LinkedIn URL) | `skills=include`, `personal_email=include`, `github_profile_id=include`, `extra=include`, `use_cache=if-present` | 1 (+extras) | Full profile: experiences, education, skills, personal emails, GitHub ID |
| `GET /profile/resolve` | `first_name`, `last_name` | `company_domain`, `title`, `location`, `enrich_profile=enrich`, `similarity_checks=include` | 2 (+1 if enrich) | LinkedIn URL + similarity scores + optional full profile |
| `GET /profile/email` | `profile_url` | | 3 | Verified work email (95%+ deliverability). May be async |

#### Contact API

| Endpoint | Required Params | Credits | Returns |
|---|---|---|---|
| `GET /contact-api/personal-email` | `profile_url` | 1/email | Personal emails |
| `GET /contact-api/personal-contact` | `profile_url` | 1/number | Personal phone numbers |
| `GET /contact/reverse-email` | `email` | 3 | Person profile from email (reverse lookup) |
| `GET /contact/disposable-email-check` | `email` | 0 | Boolean: is it disposable? |

#### Company & Other

| Endpoint | Credits | Returns |
|---|---|---|
| `GET /company?url=<linkedin_company>` | 1 | Company profile |
| `GET /find/company/role/?role=X&company_name=Y` | 3 | Person holding a specific role |
| `GET /credit-balance` | 0 | Current credit balance |

### Profile Response Fields

`GET /profile?profile_url=...&skills=include&personal_email=include&extra=include` returns:

| Category | Key Fields |
|---|---|
| Identity | `public_identifier`, `first_name`, `last_name`, `full_name`, `gender` |
| Professional | `occupation`, `headline`, `summary`, `industry`, `inferred_salary` |
| Location | `country`, `country_full_name`, `city`, `state`, `location_str` |
| Contact | `personal_emails` (array), `personal_numbers` (array) |
| Experience | `experiences` (array with company, title, description, starts_at, ends_at, location) |
| Education | `education` (array with school, degree_name, field_of_study, starts_at, ends_at) |
| Skills | `skills` (array of strings) |
| Social | `follower_count`, `connections`, `languages` |
| Extra | `extra.github_profile_id`, `extra.twitter_profile_id`, `extra.facebook_profile_id` |
| Accomplishments | `certifications` |
| Meta | `meta.thin_profile`, `meta.last_updated` |

Dates use `{day, month, year}` objects, not ISO strings.

### What EnrichLayer Gives That Apollo Does NOT

1. **Full LinkedIn job history** with descriptions, dates
2. **Full education** with degree, field of study, dates
3. **Personal emails** included in profile response (Apollo only has work emails)
4. **Personal phone numbers**
5. **Skills, certifications, patents, publications, awards**
6. **Reverse email/phone lookup** -- find person from a phone number or personal email
7. **Role lookup** -- find who is CEO/CTO/Head of Engineering at any company (for warm intros)
8. **95%+ deliverability guarantee** on work emails via dedicated endpoint

### Pricing

| Plan | Cost | Credits | Per Credit |
|---|---|---|---|
| Pay-as-you-go | $10 | 100 | $0.10 |
| Pay-as-you-go | $100 | 3,788 | $0.026 |
| Starter (annual) | $588/yr | 35,000 | $0.017 |
| Growth (annual) | $3,588/yr | 350,000 | $0.010 |

Free trial: 500 credits. Credits never expire (unless 18 months inactive).

---

## Our EnrichLayer Tools (3 tools)

### `enrichProfile` — Primary tool (most candidates)
```
Input: linkedin_url (from Apollo)
  --> GET /profile?profile_url=X&skills=include&personal_email=include&extra=include
  --> Returns: experiences, education, skills, personal_emails, github_id
  --> 1 credit
```

### `enrichLookupPerson` — Fallback (no LinkedIn URL)
```
Input: first_name, last_name, company_domain
  --> GET /profile/resolve?first_name=X&last_name=Y&company_domain=Z&enrich_profile=enrich
  --> Returns: matched LinkedIn URL + similarity scores + full profile
  --> 2-3 credits
```

### `enrichWorkEmail` — Last resort (no email at all)
```
Input: linkedin_url
  --> GET /profile/email?profile_url=X
  --> Returns: verified work email (95%+ deliverability), may be async
  --> 3 credits
```

### Email Priority for Outreach
1. **Personal email** (from enrichProfile response) -- best for recruiting, no corporate filters
2. **Apollo work email** (already have it, free) -- good enough if personal unavailable
3. **EnrichLayer verified work email** (3 credits, rare fallback) -- only if nothing else

### Credit Cost Per Candidate
- **Typical case:** 1 credit (enrichProfile with LinkedIn URL — most Apollo candidates have one)
- **No LinkedIn URL:** 2-3 credits (enrichLookupPerson by name+company)
- **No email at all:** +3 credits (enrichWorkEmail fallback)

### Cost for 50 Candidates

```
45x enrichProfile (have LinkedIn URL)  = 45 credits
5x enrichLookupPerson (no LinkedIn)    = 15 credits
~5x enrichWorkEmail (no email at all)  = 15 credits
                                         ----
                                         ~75 credits (~$1.28 at Starter rate)
```

Much cheaper than the old ID-based approach since we skip the lookup step for most candidates.

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

## Full Enrichment Pipeline

### For Every Candidate (50 candidates)

```
1. Apollo Search (FREE)
   --> name, title, company, LinkedIn URL

2. Apollo Enrich (1 Apollo credit/person)
   --> work email (80-90% accuracy), employment history, social URLs

3. EnrichLayer Enrich (3-4 credits/person)
   --> GET /people (lookup) + GET /people/{id} (full profile)
   --> job history, education, skills, certs, personal emails
   --> fallback to /personal-email endpoint if profile didn't include them
   --> fallback to /work-email only if no email exists at all
   --> Push to Airtable after this step

4. Claude Score (tokens only)
   --> fit score 1-10 based on JD + enriched profile
```

### For Top 10-15 Shortlisted Candidates

```
5. Find GitHub (multiple approaches):
   a. GitHub API email lookup (free, ~88% hit rate)
   b. Nia Web Search with CATEGORY=github (1 credit)
   c. EnrichLayer profile may include GitHub in extras

6. Nia Sandbox Search (quick scan, ~1 credit)
   --> fast assessment of top repos

7. Nia Tracer (deep analysis, 15 credits)
   --> only for top 5-10 candidates
   --> mode: tracer-fast for screening, tracer-deep for finalists

8. Re-score with GitHub data
   --> Claude re-scores with GitHub analysis factored in

9. EnrichLayer Role Lookup (3 credits)
   --> find hiring manager for warm intros
```

### For Finalist Candidates (Top 3-5)

```
10. Nia Oracle (deep research, 15 credits)
    --> comprehensive technical profile
    --> only for final shortlist

11. EnrichLayer Personal Contact (1 credit/number)
    --> personal phone for direct outreach

12. Warm intro to hiring manager
    --> EnrichLayer Role Lookup found the right person
    --> AgentMail sends structured candidate brief
```

---

## Cost Per Role (50 Candidates)

| Tool | Usage | Cost |
|---|---|---|
| Apollo Search | 50 candidates | FREE |
| Apollo Enrich | 50 x 1 credit | 50 Apollo credits |
| EnrichLayer Enrich | 50 x ~3.5 credits avg | ~175 credits (~$3.00) |
| Nia Web Search | 15 x 1 credit | 15 credits |
| Nia Sandbox Search | 10 x ~1 credit | 10 credits |
| Nia Tracer | 5 x 15 credits | 75 credits |
| Nia Oracle | 3 x 15 credits | 45 credits |
| EnrichLayer Role Lookup | 2 x 3 credits | 6 credits (~$0.10) |
| Claude tokens | ~100K tokens | ~$1-3 |
| **Total per role** | | **~$5-8 in API costs** |

This is extremely cost-efficient. A human recruiter costs $150-300/hour.
