# Nia AI: Web Page Fetching Capabilities Research

Date: 2026-04-29
Source: https://docs.trynia.ai/llms-full.txt, API reference pages

---

## Executive Summary

**Nia does NOT have a simple "fetch this URL, give me the content" endpoint.** There is no `GET /fetch?url=...` or `POST /scrape` tool. However, there are two indirect approaches that could work, plus Oracle's internal `nia_web_search` tool. None are ideal for our use case of "take a candidate's portfolio URL and return the rendered page content."

---

## 1. `/v2/search` with `mode: "web"` (What We Currently Use)

**Endpoint:** `POST /v2/search`

**Request:**
```json
{
  "mode": "web",
  "query": "John Smith portfolio senior designer",
  "num_results": 5,
  "category": "blog",       // optional: github | company | research | news | tweet | pdf | blog
  "days_back": 30,          // optional: results from last N days
  "find_similar_to": "https://example.com"  // optional: find similar content to this URL
}
```

**What it returns:** URLs, titles, and short snippets/descriptions. It is a **web search engine**, not a page fetcher. The response schema is undocumented (OpenAPI shows `schema: {}`) but based on our Zod schema in `src/lib/tools/nia.ts`, we get:
- `github_repos[]` - array of {url, title, summary/snippet}
- `documentation[]` - array of {url, title, summary/snippet}
- `other_content[]` - array of {url, title, summary/snippet}
- `results[]` - array of {url, title, summary/snippet}

**Verdict:** Search only. Returns links and snippets, NOT full page content. Good for discovering URLs, useless for reading page content.

**Interesting parameter:** `find_similar_to` takes a URL - but this finds similar pages, not the content of the URL itself.

---

## 2. `POST /v2/sources` - Index a Documentation Source (Indirect Approach)

**This is the most promising path.** You can create a "documentation" source from ANY web URL, and Nia will crawl and index it. Then you can read it back with `nia_read`.

**Request:**
```json
{
  "type": "documentation",
  "url": "https://johndoe.com",
  "display_name": "John Doe Portfolio",
  "max_depth": 2,
  "crawl_entire_domain": true,
  "only_main_content": true,
  "wait_for": 5000,
  "check_llms_txt": false,
  "include_screenshot": true,
  "url_patterns": ["https://johndoe.com/projects/*"],
  "exclude_patterns": ["*/login*", "*/admin*"]
}
```

**Key parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | Any web URL |
| `max_depth` | integer | Crawl depth (how many links deep) |
| `crawl_entire_domain` | boolean | Traverse the whole domain |
| `only_main_content` | boolean | Extract primary text only (strip nav/footer) |
| `wait_for` | integer | Page load wait time in ms (suggests JS rendering support!) |
| `include_screenshot` | boolean | Capture visual screenshot |
| `url_patterns` | string[] | Include patterns for crawling |
| `exclude_patterns` | string[] | Exclude patterns |
| `check_llms_txt` | boolean | Honor llms.txt if available |
| `formats` | string[] | Acceptable file types |
| `focus_instructions` | string | Custom processing guidance |

**After indexing, read content back with:**
- `POST /v2/search` (mode: "query") - search indexed content
- `nia_read` - read specific pages/files from the indexed source
- `nia_grep` - regex search across the indexed content
- `nia_explore` - browse structure of indexed content

**Pros:**
- Works with any URL
- `wait_for` parameter suggests it renders JavaScript (SPA support)
- Can crawl entire sites, not just single pages
- Content becomes searchable after indexing
- Can read back structured content

**Cons:**
- Two-step process: index first, then read/search
- Indexing takes time (not instant)
- Costs indexing credits
- Overkill for "just read this one page"
- Unknown if it works well on small personal sites vs. documentation sites

**Verdict:** Could work for portfolio analysis but is designed for documentation sites. The `wait_for` param is encouraging for SPAs. Would need testing.

---

## 3. Oracle Research Agent (`POST /v2/oracle/jobs`)

Oracle has an internal tool called `nia_web_search` for web searches during its research process. Oracle CANNOT be given a specific URL to fetch and return content from. It is an autonomous research agent -- you give it a question and it decides what to search/read.

**Oracle's tools:**
- `nia_web_search` - internet search (NOT page fetching)
- `nia_deep_research_agent` - complex analysis
- `search_codebase` / `search_documentation` - search indexed sources
- `doc_tree` / `doc_ls` / `doc_read` / `doc_grep` - navigate documentation
- `regex_search` / `read_source_content` - code/content reading

**Oracle does NOT have:**
- A `web_fetch` tool that takes a URL and returns content
- Any way to be directed to read a specific URL
- Direct page content extraction

**Verdict:** Oracle searches the web autonomously during research, but you cannot instruct it to "fetch this URL and return its content." We already use Oracle for candidate analysis (`niaAnalyzeCandidates`), where it may internally discover and read candidate pages, but we have no control over what it fetches.

---

## 4. Sandbox Search (`POST /v2/sandbox/search`)

**Only works with public Git repositories** (GitHub, GitLab, Bitbucket). Clones the repo into an ephemeral VM and runs a read-only agent.

**Request fields:**
- `repository` - HTTPS URL or `owner/repo` shorthand
- `query` - natural language question
- `ref` - branch/tag/commit (optional)
- `provider` - github (default), gitlab, bitbucket

**Verdict:** Git repos only. Cannot be used for arbitrary web URLs or portfolio sites.

---

## 5. Document Agent (`POST /v2/document/agent`)

Works ONLY on indexed PDFs/documents. Deploys an autonomous AI agent into a specific document with tools for search, read sections, read pages, navigate trees. Produces inline citations.

**Verdict:** PDFs only. Not for web pages.

---

## 6. Tracer (`POST /v2/github/tracer`)

GitHub-specific agent that searches code using GitHub's API (`github_search`, `github_read`, `github_glob`, `github_list`). Does NOT do HTML scraping.

**Verdict:** GitHub repos only. We could use this for analyzing a candidate's GitHub code, but it's not a web page fetcher.

---

## 7. What Nia Does NOT Have

- No `GET /fetch?url=...` endpoint
- No `POST /scrape` endpoint
- No "reader" mode that takes a URL and returns markdown/text
- No Jina Reader-style URL-to-content API
- No `web_fetch` tool exposed to users (Oracle has `nia_web_search` internally but that's search, not fetch)

---

## Recommendation for OpenRecruiter

For fetching JD URLs and candidate portfolio content, Nia is NOT the right tool. Options:

1. **For JD fetching (Phase 1 intake):** Use Jina Reader (`https://r.jina.ai/{url}`) or a simple fetch + HTML-to-markdown approach. See `data/jina-reader-research.md` if it exists.

2. **For portfolio/website analysis (Phase 3):** Two viable approaches:
   - **Quick:** Use a reader API (Jina, Firecrawl, or even the built-in WebFetch tool) to get page content, then pass to the LLM for analysis.
   - **Deep:** Use Nia's source indexing (`POST /v2/sources` with `type: "documentation"`) to crawl and index the portfolio, then search/read it. Better for multi-page sites but slower and more credits.
   - **Current approach:** Oracle (`niaAnalyzeCandidates`) does autonomous research which may organically discover and analyze portfolio content, but we have no control over what it reads.

3. **For GitHub analysis (Phase 3):** Nia Tracer (`POST /v2/github/tracer`) is purpose-built for this -- searches and reads GitHub code without indexing. We should consider using this instead of/alongside Oracle for GitHub-specific analysis.

---

## API Credit Costs

| Feature | Credit Cost |
|---------|------------|
| Web search (mode: "web") | 1 web search credit |
| Source indexing | 1 indexing credit |
| Search (mode: "query") | 1 query credit |
| Oracle job | 1 oracle credit |
| Sandbox search | 1 query credit |

Free plan limits: 20 web searches/mo, limited indexing/queries. See pricing page for paid tiers.
