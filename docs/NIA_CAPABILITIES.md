# Nia (trynia.ai) — Full Capabilities Reference

> Researched 2026-04-27 from official docs at docs.trynia.ai

## Base URL & Auth
```
Base URL: https://apigcp.trynia.ai/v2
Auth: Authorization: Bearer <NIA_API_KEY>
```

## Capability Table

| Feature | Endpoint | Credits | Use for Recruiting |
|---------|----------|---------|-------------------|
| **Tracer** (GitHub agent) | `POST /github/tracer` | 15 | Engineers: deep code analysis on repos |
| **Oracle** (autonomous research) | `POST /oracle/jobs` | 15 | All roles: web research, find portfolio/blogs/talks, synthesize profile |
| **Web Search** | `POST /search` (mode: web) | 1 | All roles: find GitHub, Behance, blogs, talks. Category filter: github/company/blog/tweet/pdf |
| **Deep Search** | `POST /search` (mode: deep) | 10 | Shortlisted: thorough investigation |
| **Query Search** | `POST /search` (mode: query) | 1 | Search across indexed sources |
| **Universal Search** | `POST /search` (mode: universal) | 1 | Cross-source ranked search |
| **Sandbox Search** | `POST /sandbox/search` | ~1 | Engineers: quick repo assessment |
| **Index (Sources)** | `POST /sources` | 10 | Crawl portfolio sites, blogs, docs |
| **Document Agent** | `POST /document/agent` | ~10 | Resume parsing with JSON schema + citations |
| **Table Extraction** | `POST /extract` | ~5 | Schema-based structured extraction from PDFs |
| **Detect Extraction** | `POST /extract/detect` | ~5 | Visual element detection in PDFs |
| **Advisor** | `POST /advisor` | 1 | Not relevant (dev tool) |
| **Package Search** | `POST /packages/search` | Free | Not relevant (dev tool) |
| **Vault** | CLI only | varies | Future: recruiting knowledge base |
| **Contexts** | `POST /contexts` | 1 | Being replaced by Graphiti |

## Tracer (GitHub Analysis)

Modes: `tracer-fast` (Haiku, seconds) / `tracer-deep` (Opus 1M context, minutes)

```bash
curl -X POST "https://apigcp.trynia.ai/v2/github/tracer" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What technologies and code quality patterns does this developer use?",
    "repositories": ["username/repo"],
    "context": "Evaluating for Senior Engineer role",
    "mode": "tracer-deep"
  }'
# Stream: GET /github/tracer/{job_id}/stream (SSE)
```

## Oracle (Autonomous Research)

Three phases: DISCOVER → INVESTIGATE → SYNTHESIZE. Has tools: nia_web_search, search_codebase, search_documentation, regex_search, read_source_content.

```bash
curl -X POST "https://apigcp.trynia.ai/v2/oracle/jobs" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Build a comprehensive profile of Sarah Chen, Product Designer at Stripe. Find portfolio, case studies, talks, design philosophy.",
    "repositories": []
  }'
# Stream: GET /oracle/jobs/{job_id}/stream (SSE)
```

## Web Search

```bash
curl -X POST "https://apigcp.trynia.ai/v2/search" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "web",
    "query": "Jane Doe designer portfolio",
    "num_results": 5,
    "category": "blog",
    "days_back": 365
  }'
```

Categories: `github`, `company`, `research`, `news`, `tweet`, `pdf`, `blog`

## Source Indexing (Web Crawling)

```bash
curl -X POST "https://apigcp.trynia.ai/v2/sources" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "documentation",
    "url": "https://sarahchen.design",
    "display_name": "Sarah Chen Portfolio",
    "crawl_entire_domain": true,
    "wait_for": "networkidle"
  }'
```

Source types: repository, documentation, research_paper, huggingface_dataset, local_folder, slack, google_drive, connector (47+ integrations)

## Document Agent (Resume Parsing)

```bash
curl -X POST "https://apigcp.trynia.ai/v2/document/agent" \
  -H "Authorization: Bearer $NIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "...",
    "query": "Extract all experience, skills, education from this resume",
    "model": "claude-opus-4-7",
    "json_schema": { ... }
  }'
```

Models: claude-opus-4-7 (1M), claude-sonnet-4, claude-haiku-35

## Pricing

| Plan | Price | Queries | Web Searches | Indexes | Oracle/Tracer |
|------|-------|---------|-------------|---------|--------------|
| Free | $0 | 50/mo | 20/mo | 3 lifetime | Credits only |
| Builder | $15/mo | 1,000 | 200 | 50 | 30 each |
| Team | $50/seat | 5,000 | 1,000 | 500 | 200 each |
| Business | $99/seat | Unlimited | Unlimited | Unlimited | Unlimited |

Credit packs: $0.03/credit (100-pack) → $0.005/credit (30K+ pack)

## Recruiting Pipeline Strategy

| Role | Discovery (cheap) | Deep Analysis (shortlist) |
|------|------------------|--------------------------|
| Engineer | Web Search → find GitHub (1 credit) | Tracer → analyze repos (15 credits) |
| Designer | Web Search → find portfolio (1 credit) | Oracle → research web presence (15 credits) |
| PM/Other | Web Search → find blogs/talks (1 credit) | Oracle → research web presence (15 credits) |
| Any (resume) | N/A | Document Agent → parse PDF (10 credits) |

## Limitations
- **No image/visual analysis** — can't assess design screenshots, only text content
- **No Behance/Dribbble API integration** — finds URLs via search, doesn't pull structured data
- **Oracle max 30min runtime**, 3 concurrent jobs on Builder
- **Web search max 10 results** per query
