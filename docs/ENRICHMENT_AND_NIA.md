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

> **TODO:** Review official docs at https://enrichlayer.com/docs to verify exact response schemas,
> confirm all field names, and optimize our API call strategy. Same for Airtable field mapping.

### Authentication
```
Authorization: Bearer <ENRICHLAYER_API_KEY>
Base URL: https://enrichlayer.com/api/v2
All endpoints: GET
Rate limit: 300 req/min
```

### API is ID-Based

EnrichLayer uses internal person/company IDs. You must look up the ID first, then fetch data.

### Key Endpoints for Recruiting

#### People API

| Endpoint | Method | Required Params | Credits | Returns |
|---|---|---|---|---|
| `/people` | GET | name + company info | 2 | Person ID match |
| `/people/{id}` | GET | person ID | 1 | Full profile: job history, education, skills, certs, **personal_emails**, personal_numbers |
| `/people/{id}/picture` | GET | person ID | 0 | Profile image |
| `/people/{id}/work-email` | GET | person ID | 3 | Verified work email (95%+ deliverability). Async, supports webhooks |
| `/people/{id}/personal-email` | GET | person ID | 1/email | Personal emails (fallback if profile didn't include them) |
| `/people/{id}/phone-number` | GET | person ID | 1/number | Personal phone numbers (E.164) |

#### Company API

| Endpoint | Method | Required Params | Credits | Returns |
|---|---|---|---|---|
| `/companies` | GET | name or domain + location | 2 | Company ID match |
| `/companies/{id}` | GET | company ID | 1 | Company profile, size, HQ, industry |
| `/companies/{id}/picture` | GET | company ID | 0 | Company logo |
| `/companies/{id}/resolve` | GET | vanity ID | 0 | Numeric company ID |
| `/companies/{id}/employee-count` | GET | company ID | 1 | Total employees |
| `/companies/{id}/employees` | GET | company ID | 3/employee | Employee listing |
| `/companies/{id}/employees/search` | GET | company ID + job title | 10 | Search employees by title |

#### Contact API

| Endpoint | Method | Required Params | Credits | Returns |
|---|---|---|---|---|
| `/contact/reverse-email` | GET | email | 3 | Person profile from email (reverse lookup) |
| `/contact/reverse-phone` | GET | phone (E.164) | 3 | Social profiles from phone |
| `/contact/disposable-email-check` | GET | email | 0 | Boolean: is it a disposable email? |

#### Search API

| Endpoint | Method | Params | Credits | Returns |
|---|---|---|---|---|
| `/search/people` | GET | title, location, company, industry, skills | 3/profile URL | Up to 10M results |
| `/search/companies` | GET | name, industry, location, revenue | 3/company URL | Up to 10M results |

#### Other

| Endpoint | Method | Credits | Returns |
|---|---|---|---|
| `/role-lookup` | GET | 3 | Person who holds a specific role at a company |
| `/jobs/{id}` | GET | 2 | Job profile |
| `/companies/{id}/jobs` | GET | 2 | Company job listings |
| `/schools/{id}` | GET | 1 | School profile |
| `/credit-balance` | GET | 0 | Current credit balance |

### Person Profile Response (194 fields)

`GET /people/{id}` returns:

| Category | Key Fields |
|---|---|
| Identity | `public_identifier`, `first_name`, `last_name`, `full_name`, `gender`, `birth_date` |
| Professional | `occupation`, `headline`, `summary`, `industry`, `inferred_salary` |
| Location | `country`, `country_full_name`, `city`, `state` |
| Contact | **`personal_emails`** (array), **`personal_numbers`** (array) |
| Experience | `experiences` (array of jobs with descriptions, dates) |
| Education | `education` (array with degree, field, dates) |
| Skills | `skills` (array of strings) |
| Social | `follower_count`, `connections`, `interests`, `languages` |
| Accomplishments | `certifications`, `accomplishment_patents`, `accomplishment_publications`, `accomplishment_honors_awards`, `accomplishment_courses`, `accomplishment_projects` |
| Content | `articles`, `activities`, `groups`, `recommendations` |
| Related | `people_also_viewed`, `similarly_named_profiles` |

**Key insight:** The profile endpoint already includes `personal_emails`. The separate `/personal-email` endpoint is only needed as a fallback if the profile returns empty.

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

## Our EnrichLayer Tool: `enrichLayerEnrich`

One tool, smart fallback logic:

```
Input: name, company, linkedin_url (from Apollo)
                    |
Step 1: GET /people (name + company) --> person ID          [2 credits]
                    |
Step 2: GET /people/{id} --> full profile + personal_emails [1 credit]
                    |
         personal_emails in response?
           /              \
         YES               NO
          |                 |
    Use personal       Step 3: GET /people/{id}/personal-email  [1 credit]
    email for               |
    outreach          Got personal email?
                       /              \
                     YES               NO
                      |                 |
                Use personal      Has Apollo work email?
                email for           /           \
                outreach          YES             NO
                                   |               |
                             Use Apollo        Step 4: GET /people/{id}/work-email [3 credits]
                             work email        (last resort verified work email)
```

### Email Priority for Outreach
1. **Personal email** (from profile or fallback endpoint) -- best for recruiting, no corporate filters
2. **Apollo work email** (already have it, free) -- good enough if personal unavailable
3. **EnrichLayer verified work email** (3 credits, rare fallback) -- only if nothing else

### Credit Cost Per Candidate
- **Best case:** 3 credits (lookup + profile, personal email included)
- **Typical case:** 4 credits (lookup + profile + personal email fallback)
- **Worst case:** 7 credits (all of the above + work email fallback)

### Cost for 50 Candidates

```
50x Person Lookup                     = 100 credits
50x Person Profile                    = 50 credits
~20x Personal Email fallback          = 20 credits
~5x Work Email fallback (rare)        = 15 credits
                                        ----
                                        ~185 credits (~$3.15 at Starter rate)
```

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
