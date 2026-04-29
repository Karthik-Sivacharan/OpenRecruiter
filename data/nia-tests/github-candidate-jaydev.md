# Nia AI API Test Results -- Jaydev Kumar (neocatalyst)

**Date:** 2026-04-28
**Candidate:** Jaydev Kumar (Senior Staff Product Designer at Ironclad)
**GitHub:** https://github.com/neocatalyst
**Portfolio:** https://d1eb94pr0akohe.cloudfront.net/
**Hiring for:** Senior Product Designer at Fulcrum (AI-powered insurance automation)

---

## Test Summary

| # | Endpoint | Method | Status | Quality | Notes |
|---|----------|--------|--------|---------|-------|
| 1 | `/v2/github/tree/{owner}/{repo}` | GET | WORKS | Good | Returns file tree with sizes. Fast, reliable. |
| 2 | `/v2/github/tracer` | POST (async) | WORKS | Excellent | Deep agent analysis. 144s, 17 tool calls, 9169-char answer. |
| 3 | `/v2/sandbox/search` | POST | 404 | N/A | Endpoint does not exist. Also tried `/sandbox/jobs`, `/sandbox`, `/github/sandbox`. |
| 3b | `/v2/github/search` | POST | 401 (GitHub auth) | Broken | Endpoint exists, accepts `repository` (singular) param, but Nia's GitHub auth fails server-side. |
| 4 | `/v2/oracle/jobs` | POST (async) | WORKS | Excellent | Web research agent. 234s, 8 iterations, 9354-char report with citations. |
| 5 | `/v2/document/agent` | POST | 422 | Needs source_id | Requires `source_id` or `source_ids`, but `/document/sources` returns 404 (no way to create sources). |
| 5b | `/v2/web/agent` | POST | 404 | N/A | Does not exist. |
| 5c | `/v2/web/search` | POST | 404 | N/A | Does not exist. |
| 5d | `/v2/web/tracer` | POST | 404 | N/A | Does not exist. |

---

## Test 1: GitHub Tree (GET /v2/github/tree/{owner}/{repo})

**Status: WORKS -- integrate this.**

Fast, reliable endpoint that returns the full file tree of any public GitHub repo. Returns structured JSON with entries (path, type, size), a text tree, total file/dir counts, and truncation flag.

### Repos tested:
- `neocatalyst/organize` -- 2 files (README.md, organize.py)
- `neocatalyst/cerebro` -- 19 files, 3 dirs (Django EEG project)
- `neocatalyst/appmaker` -- 679+ files (large Mozilla fork)
- `neocatalyst/jdev005.github.com` -- 679 files (personal portfolio site)

### Sample response (organize):
```json
{
  "entries": [
    {"path": "README.md", "type": "file", "size": 286},
    {"path": "organize.py", "type": "file", "size": 1373}
  ],
  "tree_text": "README.md\norganize.py",
  "total_files": 2,
  "total_dirs": 0,
  "truncated": false
}
```

### Use case for OpenRecruiter:
Use before tracer to assess repo size/relevance. Skip repos that are too small or obviously irrelevant (e.g., fork with no original files). Helps decide which repos to spend tracer credits on.

---

## Test 2: GitHub Tracer (POST /v2/github/tracer -- async)

**Status: WORKS -- primary integration target for GitHub analysis.**

### Request:
```json
{
  "query": "Analyze neocatalyst GitHub repos for design system work, UI/UX contributions, code quality, and B2B SaaS experience",
  "repositories": ["neocatalyst/cerebro", "neocatalyst/appmaker", "neocatalyst/appmaker-components"]
}
```

### Response (job creation):
```json
{
  "job_id": "98f63e12-5ef2-483c-b8fa-2e1e26dad920",
  "session_id": "cb1a1b3e-cd96-495d-87b3-c21967ff27f5",
  "status": "queued",
  "mode": "tracer-deep",
  "model": "claude-opus-4-7",
  "message": "Tracer search job created. Use /github/tracer/{job_id}/stream to receive updates."
}
```

### Polling (GET /v2/github/tracer/{job_id}):
Returns full job status with `status`, `answer`, `tool_calls`, `iterations`, `duration_ms`.

### Streaming (GET /v2/github/tracer/{job_id}/stream):
SSE stream with `connected`, `heartbeat` events. Works but answer arrives at completion.

### Completed response metadata:
- **Status:** completed
- **Duration:** 144,346 ms (~2.4 minutes)
- **Iterations:** 5
- **Tool calls:** 17
- **Answer length:** 9,169 characters
- **Model used:** claude-opus-4-7

### Analysis quality assessment:
EXCELLENT. The tracer:
- Correctly identified appmaker and appmaker-components as Mozilla forks (not original work)
- Cited specific files and line numbers (e.g., `views.py:4-5`, `package.json:5-12`)
- Assessed code quality with concrete examples (wildcard imports, GET mutations, no auth)
- Evaluated each repo against the requested criteria (design systems, UI/UX, code quality, B2B SaaS)
- Provided a bottom-line verdict table
- Recommended looking elsewhere for evidence of current work

### Key findings from tracer:
1. **Design system work:** appmaker-components IS a design system, but it's Mozilla's -- mirrored, not authored
2. **Code quality:** cerebro/views.py has serious issues (wildcard imports, no auth, no tests)
3. **B2B SaaS:** None evident in any repo
4. **Tech recency:** All repos reflect 2013-2015 stack (Django, Express 3.3, AngularJS 1.x, Grunt, Bower)

### Use case for OpenRecruiter:
Primary tool for deep GitHub analysis. Can analyze multiple repos at once. Takes ~2-3 minutes. Use for candidates where GitHub is a meaningful signal. The analysis is thorough enough to feed directly into scoring.

---

## Test 3: Sandbox Search / GitHub Search

**Status: DOES NOT WORK.**

### Endpoints tried:
- `POST /v2/sandbox/search` -- 404
- `POST /v2/sandbox/jobs` -- 404
- `POST /v2/sandbox` -- 404
- `POST /v2/github/sandbox` -- 404
- `POST /v2/github/search` -- exists but returns GitHub 401 auth error

### /v2/github/search details:
The endpoint exists and requires `repository` (singular, not `repositories`). But it fails with:
```json
{
  "error": "GitHub API error 401: {\"message\": \"Requires authentication\"}",
  "total_count": 0,
  "items": []
}
```
This is a server-side issue on Nia's end -- their GitHub token is not configured/expired for this endpoint.

### Recommendation:
Skip sandbox/search entirely. The GitHub Tracer (Test 2) provides better results anyway since it's an agentic deep analysis rather than a keyword search.

---

## Test 4: Oracle Research Agent (POST /v2/oracle/jobs -- async)

**Status: WORKS -- best endpoint for holistic candidate research.**

### Request:
```json
{
  "query": "Research Jaydev Kumar, a Senior Staff Product Designer at Ironclad. Analyze their GitHub profile (neocatalyst), portfolio at d1eb94pr0akohe.cloudfront.net, and any public work. Evaluate their fit for a Senior Product Designer role at an AI-powered B2B insurance platform."
}
```

### Response (job creation):
```json
{
  "job_id": "ee68d9b5-8eb1-4fa8-8fe3-c0086d9f7ecd",
  "status": "queued",
  "message": "Oracle research job created. Use /oracle/jobs/{job_id}/stream to receive updates."
}
```

### Polling (GET /v2/oracle/jobs/{job_id}):
Returns full job with `status`, `final_report`, `citations`, `tool_calls`, `iterations`, `duration_ms`.

### Streaming (GET /v2/oracle/jobs/{job_id}/stream):
SSE stream works. Events: `connected`, `heartbeat`, then results at completion.

### Completed response metadata:
- **Status:** completed
- **Duration:** 234,277 ms (~3.9 minutes)
- **Iterations:** 8
- **Citations:** 7 sources (web searches, page fetches, think steps)
- **Final report length:** 9,354 characters

### Tool calls made by Oracle:
1. `run_web_search`: "Jaydev Kumar Senior Staff Product Designer Ironclad" (found LinkedIn)
2. `web_fetch`: d1eb94pr0akohe.cloudfront.net (portfolio)
3. `web_fetch`: github.com/neocatalyst (GitHub profile)
4. `run_web_search`: "Jaydev Kumar Ironclad design AI contracts..." (found Ironclad AI products)
5. `web_fetch`: jaydev.org (empty -- HTTP 200, no content)
6. `run_web_search`: "Jaydev Kumar Forbes Technology Council article design AI"
7. `think`: Comprehensive reflection synthesizing all findings

### Analysis quality assessment:
OUTSTANDING. The Oracle produced a recruiter-ready evaluation including:
- Full career timeline (Google > DoorDash > Ironclad, with promotions)
- Specific product impact ($1B+ Google Ads revenue attribution)
- Direct AI/B2B SaaS fit assessment (Ironclad Jurist, AI Assist)
- Education verification (CMU HCI MS)
- Patent count (10+) and research publication
- Recognition (Forbes Tech Council, hackathon wins)
- Portfolio staleness identified (CloudFront site stuck at ~2019)
- Fit scorecard with 9 dimensions rated
- Concrete interview recommendations (6 actionable steps)
- Level mismatch warning (Sr. Staff applying to Senior = overqualified)
- Final recommendation: "Advance with high priority, but at the right level"

### Key Oracle findings not in GitHub Tracer:
- Career trajectory with exact dates and promotions
- Ironclad AI product context (Jurist legal AI, $200M+ ARR)
- 8 Bank of America patents from CMU capstone
- Portfolio site content analysis (stale since ~2019)
- jaydev.org returns empty
- Forbes Tech Council membership 2018-2022
- Google Ads impact ($1B+ revenue)
- DoorDash merchant tools experience
- Competitor GitHub account (JDEV005) -- minimal

### Use case for OpenRecruiter:
Use Oracle for holistic candidate evaluation when you have a name + any public profiles. It does web research autonomously -- fetches LinkedIn, portfolio, GitHub, searches for publications/press. Takes ~4 minutes. The output is directly usable for scoring input. Best combined with GitHub Tracer when GitHub repos are substantial.

---

## Test 5: Document Agent (POST /v2/document/agent)

**Status: DOES NOT WORK (missing prerequisite endpoint).**

### What happened:
The endpoint exists but requires `source_id` or `source_ids`:
```json
{
  "detail": [{
    "type": "value_error",
    "msg": "Value error, Either source_id or source_ids must be provided"
  }]
}
```

When trying to pass URLs as source_ids:
```json
{"detail": "Data source https://d1eb94pr0akohe.cloudfront.net/ not found"}
```

The prerequisite endpoint to create sources (`/v2/document/sources`) returns 404. Without it, document/agent is unusable.

### Recommendation:
Skip document/agent. The Oracle (Test 4) already fetches and analyzes web pages as part of its research, including the portfolio site. For pure URL analysis, Oracle is the better path.

---

## Recommendations for OpenRecruiter Integration

### Must integrate (Phase 1):
1. **`/v2/github/tree/{owner}/{repo}`** -- Use as a quick pre-filter before tracer. Check repo size, file types, and relevance. Zero cost, instant results.
2. **`/v2/github/tracer`** (async) -- Primary GitHub analysis tool. Feed 1-3 repos per candidate. Poll until complete (~2-3 min). Output feeds directly into scoring.
3. **`/v2/oracle/jobs`** (async) -- Holistic candidate research. Give it name + role + any URLs. Poll until complete (~4 min). Output is recruiter-grade evaluation.

### Skip for now:
- `/v2/sandbox/search` -- Does not exist
- `/v2/github/search` -- Server-side auth broken
- `/v2/document/agent` -- Missing source creation endpoint
- `/v2/web/*` endpoints -- Do not exist

### Implementation notes:
- Both tracer and oracle are async. Create job, then poll every 5-10s or use SSE streaming.
- Tracer accepts multiple repositories in one job (array of "owner/repo" strings).
- Oracle accepts a free-text query -- embed candidate context and role requirements for best results.
- Both return structured JSON with status, answer/final_report, tool_calls, duration_ms.
- Typical latency: tree=instant, tracer=2-3 min, oracle=3-5 min.
- Oracle uses `final_report` field; Tracer uses `answer` field.
- Oracle includes `citations` array with source details and summaries.

### Suggested pipeline flow:
1. Get candidate GitHub username (from PDL or Apollo social URLs)
2. `/v2/github/tree` on each repo -- filter to repos with >5 files and relevant languages
3. `/v2/github/tracer` on top 1-3 repos -- deep code analysis
4. `/v2/oracle/jobs` with full candidate context -- holistic web research
5. Combine tracer + oracle outputs as input to Opus scoring

### Cost awareness:
The Nia API uses Opus 4.7 for tracer (expensive model). Oracle uses web search + fetch (unknown pricing). Both should be considered paid operations. Run tree first to avoid wasting tracer credits on trivial repos.

---

## Raw Response Files

- `tracer-full-response.json` -- Full GitHub Tracer response (job_id: 98f63e12...)
- `oracle-full-response.json` -- Full Oracle Research response (job_id: ee68d9b5...)

---

## Candidate Assessment Summary (from Nia analysis)

**GitHub (Tracer):** Weak signal. Repos are from 2013-2015 era. Two are Mozilla forks, one is a Django EEG prototype. No evidence of modern design work, B2B SaaS, or current skills. Code quality in original work (cerebro) is poor.

**Holistic (Oracle):** Strong candidate overall. CMU HCI MS, 10+ patents, career at Google/DoorDash/Ironclad. Currently designing AI features at Ironclad (Jurist, AI Assist). Zero-to-one specialist. Likely overqualified for "Senior" level (currently Sr. Staff). Portfolio site is stale (2019). No insurance domain experience but adjacent regulated industry experience (legal, banking).

**Key insight:** For this candidate, GitHub is NOT a meaningful signal -- his value is in his enterprise design career, AI product experience, and patents. The Oracle research agent was far more valuable than GitHub Tracer for this particular evaluation. For engineering candidates, the ratio would likely flip.
