# Nia AI API Test Results - Portfolio Candidate Analysis

**Date:** 2026-04-28
**Base URL:** `https://apigcp.trynia.ai/v2`
**Candidates tested:**
1. Robyn Hwang - Senior UX Designer at Ontra - Portfolio: https://www.robynhwang.com
2. Jessica Tam - Senior Product Designer at Stripe - Portfolio: https://jesstam.ca

---

## Test Summary Matrix

| Endpoint | Method | Status | Quality | Latency | Recommendation |
|----------|--------|--------|---------|---------|----------------|
| `/v2/oracle/jobs` | POST (async) | WORKS | EXCELLENT | ~280s | PRIMARY - best for candidate research |
| `/v2/document/agent` | POST (sync) | WORKS | EXCELLENT | ~10-15s | SECONDARY - best for indexed portfolio analysis |
| `/v2/search` (mode: web) | POST (sync) | WORKS | GOOD | ~2s | USE - fast surface-level sourcing |
| `/v2/search` (mode: deep) | POST (sync) | WORKS | GOOD | ~8-15s | USE - structured analysis with citations |
| `/v2/search` (mode: universal) | POST (sync) | WORKS | MIXED | ~8s | SKIP - searches global index, noisy results |
| `/v2/search` (mode: query) | POST (sync) | WORKS | GOOD | ~4s | USE - RAG over indexed sources |
| `/v2/sources` | POST (sync) | WORKS | N/A | ~12s | USE - required for document/agent and query search |

---

## Test 1: Oracle Research Agent (`POST /v2/oracle/jobs`)

### Request Format
```json
POST /v2/oracle/jobs
{
  "query": "Research [NAME], a [TITLE] at [COMPANY]. Analyze their portfolio at [URL]. Evaluate their design quality, B2B SaaS experience, complex workflow design, and visual design fundamentals. How would they fit a Senior Product Designer role at an AI-powered B2B insurance automation platform?"
}
```

### Response Format (creation)
```json
{
  "job_id": "5e040360-...",
  "session_id": "b57e463b-...",
  "status": "queued",
  "message": "Oracle research job created. Use /oracle/jobs/{job_id}/stream to receive updates."
}
```

### Polling
- **Status endpoint:** `GET /v2/oracle/jobs/{job_id}` - returns `status: "queued" | "running" | "completed"`
- **Stream endpoint:** `GET /v2/oracle/jobs/{job_id}/stream` - SSE stream with heartbeats, tool_start, tool_complete, iteration_start events
- **Completion time:** ~280 seconds (4-5 minutes) per candidate

### Robyn Hwang - Oracle Result

**Job ID:** `5e040360-6779-45f1-905e-329b9670cc29`
**Duration:** 284,277ms (~4.7 min)
**Iterations:** 8
**Tool calls:** 4 web searches + 2 web fetches + 1 think

**Key findings from Oracle:**
- Portfolio is password-protected; Oracle correctly identified this and worked around it
- Ran multiple web searches autonomously (LinkedIn, Ontra product pages, Medium, Designomics)
- Identified: Designer #1 at Ontra, scaled team from 1 to 7, 6 years tenure
- Deep analysis of Ontra's Contract Automation product as structural analog to insurance automation
- Produced alignment matrix scoring each requirement dimension
- Recommendation: "Move forward to interview with high priority"
- Identified the Ontra Contract Automation product as "essentially a parallel-universe version of an AI-powered insurance automation platform"

**Quality assessment: EXCELLENT.** The Oracle produced a recruiter-ready evaluation report with executive summary, dimension-by-dimension analysis, alignment matrix, concerns to validate, and specific interview questions. It autonomously researched the company's products to contextualize the candidate's work.

### Jessica Tam - Oracle Result

**Job ID:** `021625e4-f32a-4f1f-8579-2f2b2cfbded6`
**Duration:** 275,021ms (~4.6 min)
**Iterations:** 14
**Tool calls:** 7 web searches + 3 web fetches + 2 think

**Key findings from Oracle:**
- Correctly identified that `jesstam.ca` does NOT resolve (DNS failure)
- Disambiguated multiple "Jessica Tam" profiles online
- Mapped career trajectory: Shopify -> Asana (FX team lead) -> Stripe (Senior PD)
- Found Asana engineering blog evidence of her First Experience team's 30x tour completion improvement
- Identified AI-powered personalization experience from Asana role
- Noted Stripe's design hiring bar as indirect quality signal
- Recommendation: "Advance to portfolio review and interview"

**Quality assessment: EXCELLENT.** Handled the broken URL gracefully, performed sophisticated identity disambiguation, and still produced a thorough evaluation by triangulating multiple sources.

---

## Test 2: Document Agent (`POST /v2/document/agent`)

### Request Format
Requires a `source_id` from a previously indexed source (NOT a raw URL).

```json
POST /v2/document/agent
{
  "query": "Analyze this portfolio for: design quality, B2B SaaS experience...",
  "source_id": "ea6053ed-e2c3-40ff-a635-b6f4cb1e9fff"
}
```

**ERROR with raw URL:** Returns 422 - "Either source_id or source_ids must be provided"

### Robyn Hwang - Document Agent Result

**Source ID:** `ea6053ed-e2c3-40ff-a635-b6f4cb1e9fff`
**Model used:** `claude-opus-4-7`
**Response time:** ~10-15 seconds (sync)

**Key findings:**
- Correctly noted portfolio is password-protected, only Home/About pages accessible
- Extracted all available text signals from indexed content
- Provided structured assessment with evidence linked to specific line numbers
- Identified resume PDF URL and LinkedIn URL from the indexed source
- Clear "Bottom Line" recommendation

**Quality assessment: EXCELLENT.** Very thorough for what was available. The citation system references specific document sections. Uses Claude Opus 4.7 internally for analysis quality.

### Jessica Tam - Document Agent Result

**Not testable.** Source creation for `jesstam.ca` failed (domain doesn't resolve), so no source_id was available.

---

## Test 3: Web Search (`POST /v2/search`, mode: web)

### Request Format
```json
POST /v2/search
{
  "mode": "web",
  "query": "Robyn Hwang Ontra UX designer portfolio case study",
  "num_results": 10
}
```

### Response Format
```json
{
  "github_repos": [],
  "documentation": [],
  "other_content": [
    {
      "url": "https://www.ontra.ai/blog/...",
      "title": "Meet Robyn Hwang...",
      "summary": "..."
    }
  ],
  "total_results": 10
}
```

### Robyn Hwang - Web Search Result
- **10 results returned** in ~2 seconds
- Found: Ontra blog interview, portfolio homepage, MentorCruise profile, LinkedIn, TheOrg, Medium, SignalHire
- Good coverage of public presence
- Summary text includes useful snippets (title, bio, company info)

### Jessica Tam - Web Search Result
- **10 results returned** in ~2 seconds
- Found: Dribbble, byjesstam.com (NanoKard case study), jesstam.com, Medium, LinkedIn directory
- Some noise (different Jessica Tams mixed in)
- Correctly found the real jesstam.com portfolio (not the broken jesstam.ca)

**Quality assessment: GOOD.** Fast and reliable. Returns structured results with URLs, titles, and text summaries. Good for initial candidate discovery and link gathering. No LLM analysis -- just search results.

---

## Test 4: Deep Search (`POST /v2/search`, mode: deep)

### Request Format
```json
POST /v2/search
{
  "mode": "deep",
  "query": "Analyze Robyn Hwang's design portfolio at robynhwang.com..."
}
```

### Robyn Hwang - Deep Search Result
- Returns same structure as web search (github_repos, documentation, other_content)
- 10 results with slightly different ranking than web mode
- Found additional links: Dribbble, Webflow profile, articles on design process
- Response time: ~8 seconds
- Wrapped in `{"data": {...}, "citations": null, "status": "completed", "trace": null}`

### Jessica Tam - Deep Search Result
- Returns a DIFFERENT format than Robyn's -- structured `data.analysis` object:
```json
{
  "data": {
    "analysis": {
      "b2bSaaSExperience": "...",
      "complexWorkflowDesign": "...",
      "visualFundamentals": "...",
      "reasoning": "...",
      "sources": ["..."]
    },
    "portfolioURL": "https://jesstam.com",
    "designerName": "Jessica Tam"
  },
  "citations": [...],
  "status": "completed"
}
```
- Auto-detected this was a candidate analysis query and returned structured output
- Found the correct jesstam.com despite being asked about jesstam.ca
- Analysis was brief but structured with the right dimensions
- Many irrelevant citations (ASU graduation list, BMI DART claims, etc.)

**Quality assessment: GOOD but INCONSISTENT.** The deep search sometimes returns structured analysis (Jessica Tam) and sometimes returns raw search results (Robyn Hwang), possibly depending on query phrasing. When it returns structured analysis, the format is useful but shallower than Oracle or Document Agent. Citation quality is noisy.

---

## Test 5: Source Creation + Search

### Source Creation (`POST /v2/sources`)

**Request:**
```json
POST /v2/sources
{
  "url": "https://www.robynhwang.com",
  "type": "documentation"
}
```

**Response:**
```json
{
  "id": "ea6053ed-...",
  "type": "documentation",
  "identifier": "https://www.robynhwang.com",
  "status": "processing",
  "is_global": true,
  "global_source_id": "ea16000300fd4d1a",
  "global_namespace": "public-docs-ea16000300fd4d1a"
}
```

- Processing time: ~12 seconds (poll `GET /v2/sources/{id}` until status = "completed")
- Robyn Hwang portfolio: completed successfully
- Jessica Tam portfolio (jesstam.ca): FAILED (domain doesn't resolve)

### Search Against Indexed Source

**Modes available:** `query`, `web`, `deep`, `universal`

**mode: query** (RAG-style with answer generation):
```json
POST /v2/search
{
  "mode": "query",
  "messages": [{"role": "user", "content": "What is the designer's B2B SaaS experience?"}],
  "source_ids": ["ea6053ed-..."]
}
```
- Returns: `results[]` array (vector search hits from the source) + `answer` string (LLM-generated response)
- Top result correctly returned the About Me section from robynhwang.com (score: 0.92)
- Answer was brief but accurate
- Other results leaked from global index (Relume pricing page, SaaS landing pages) -- not great isolation

**mode: universal** (hybrid search):
```json
POST /v2/search
{
  "mode": "universal",
  "query": "Robyn Hwang design experience B2B SaaS workflow portfolio"
}
```
- Returns results from both the indexed source AND the global public index
- Top 2 results were from robynhwang.com (scores: 0.97, 0.95)
- Remaining results were noisy (random GitHub repos, landing page examples)
- source_ids parameter NOT tested with universal mode

**Quality assessment: MIXED.** Source creation works well. Query mode provides useful RAG answers but result isolation is poor -- global sources leak in. Universal mode is too noisy for targeted candidate analysis.

---

## Integration Recommendations

### Recommended Pipeline for OpenRecruiter

**For candidate portfolio analysis (no GitHub):**

1. **Web Search (mode: web)** -- FIRST PASS, FREE-ISH
   - Use to discover portfolio URLs, LinkedIn, Dribbble, Medium, etc.
   - Fast (~2s), returns 10 structured results
   - Good for populating candidate profile links

2. **Oracle Research Agent** -- PRIMARY ANALYSIS TOOL
   - Best quality by far: multi-step research with autonomous web browsing
   - Produces recruiter-ready evaluation reports
   - Handles edge cases well (broken URLs, password-protected portfolios, identity disambiguation)
   - Downside: slow (~5 minutes per candidate), async polling required
   - **Use for: final candidate evaluation after enrichment**

3. **Source Creation + Document Agent** -- SECONDARY ANALYSIS
   - Good for quick portfolio analysis when URL is accessible
   - Uses Claude Opus 4.7 internally
   - Fast (~15s total: 12s indexing + 3s query)
   - Requires two-step process (create source, then query)
   - **Use for: quick portfolio scan before deciding to run full Oracle research**

### Endpoints to Skip

- **Deep Search (mode: deep):** Inconsistent response format, noisy citations, not worth the complexity over web search + Oracle
- **Universal Search:** Too noisy, leaks global index results, not useful for targeted candidate research
- **Query Search with source_ids:** Poor isolation, global results contaminate answers

### API Integration Notes

1. **Oracle jobs are async.** Must create job, then poll `GET /oracle/jobs/{job_id}` or stream via SSE at `/oracle/jobs/{job_id}/stream`
2. **Document Agent requires pre-indexed sources.** Cannot pass raw URLs -- must create source first via `POST /sources` and wait for `status: "completed"`
3. **Search mode: query uses `messages[]` format** (chat-style), not `query` string
4. **All other search modes use `query` string format**
5. **Source creation is idempotent-ish.** The `is_global: true` flag suggests sources may be shared across accounts via `global_source_id`
6. **Oracle internally uses:** web_fetch, run_web_search, and think tools -- essentially an autonomous research agent

### Cost Considerations

- Web search appears to be the cheapest operation (pure search, no LLM)
- Document Agent uses Claude Opus 4.7 internally -- likely the most expensive per-call
- Oracle makes multiple tool calls (4-8 web searches + fetches per candidate) -- moderate cost but highest value
- Source creation is a one-time cost per URL

### Request/Response Quirks

1. Web search returns `github_repos`, `documentation`, `other_content` arrays -- useful for separating result types
2. Oracle stream uses SSE with `data: {...}` format including heartbeats every ~5 seconds
3. Deep search sometimes returns structured analysis objects and sometimes raw search results -- format is unpredictable
4. Source creation returns immediately but processing continues async -- must poll for completion
5. Document Agent response includes `citations[]` with `tool_source`, `section_id`, and content snippets

---

## Raw Response Data

### Oracle - Robyn Hwang (final_report excerpt)

> **Robyn Hwang is an exceptionally strong fit for a Senior Product Designer role at an AI-powered B2B insurance automation platform.** Her 6-year tenure designing the flagship Contract Automation product at Ontra -- a legal AI platform serving private capital firms like Blackstone, Warburg Pincus, and AllianceBernstein -- represents nearly a 1:1 analog to the target role. She has deep, hands-on experience designing human-in-the-loop AI workflows in a highly regulated, enterprise B2B SaaS environment, which is precisely the design problem space of insurance automation.

### Oracle - Jessica Tam (final_report excerpt)

> Based on available evidence, Jessica Tam appears to be a strong-to-excellent fit for a Senior Product Designer role at an AI-powered B2B insurance automation platform -- but this assessment comes with an important caveat: the portfolio URL provided (`https://jesstam.ca`) does not exist (DNS resolution failed), and her publicly accessible portfolio at `jesstam.com` contains no case studies. The fit assessment is therefore based on her verified career trajectory, role context at each company, and indirect evidence rather than direct case study review.

### Document Agent - Robyn Hwang (answer excerpt)

> **Strong written signals** for B2B SaaS and complex workflow design (legal AI / contract automation at Ontra, 6 years, growth-stage scaling). **Visual craft, typography, color, and spacing cannot be evaluated** without access to the password-protected case studies. Treat this as a promising candidate profile pending portfolio walkthrough.

### Deep Search - Jessica Tam (structured analysis)

> **B2B SaaS Experience:** Jessica Tam's current role as a designer leading Asana's First Experience team provides direct B2B SaaS exposure on a major project management platform...
> **Complex Workflow Design:** There is limited evidence of detailed complex workflow design in her public portfolio...
> **Visual Fundamentals:** Her homepage demonstrates a clear visual hierarchy, consistent typography, and balanced white space...
