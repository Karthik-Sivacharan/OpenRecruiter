# Jina Reader Research

**Date:** 2026-04-29
**Purpose:** Evaluate Jina Reader for converting job description URLs (including JS-rendered SPAs like Ashby) to clean text/markdown for the OpenRecruiter intake pipeline.

---

## 1. How It Works

Prepend `https://r.jina.ai/` to any URL:

```
https://r.jina.ai/https://jobs.ashbyhq.com/ramp/d204e136-...
```

That's it. The service fetches the page using headless Chrome (Puppeteer), renders JavaScript, extracts the main content, and returns clean markdown.

There's also a search endpoint at `https://s.jina.ai/` for web search with content extraction.

An EU-compliant endpoint is available at `https://eu.r.jina.ai/`.

## 2. JavaScript / SPA Rendering

**Yes, it renders JS-heavy SPAs.** It uses Puppeteer with headless Chrome under the hood.

### Test Results (live tests, 2026-04-29)

| URL | SPA Type | Result | Time | Size |
|-----|----------|--------|------|------|
| `jobs.ashbyhq.com/ramp` (job list) | React SPA | Full job listings with titles, links, salaries, locations | 3.5s | 24KB |
| `jobs.ashbyhq.com/ramp/{job-id}` (single JD) | React SPA | Complete JD with description, requirements, benefits, comp | 3.0s | 4.3KB |
| `ycombinator.com/companies` (company directory) | React SPA | Rendered 40+ companies with filters and categories | 4.4s | 7.8KB |
| `jobs.ashbyhq.com/anthropic` (no timeout) | React SPA | FAILED - only got skeleton, CAPTCHA warning | 1.9s | 470B |
| `jobs.ashbyhq.com/figma` (with timeout) | React SPA | FAILED - "Page not found" (likely Ashby blocking) | 2.9s | 476B |

**Key finding:** Ashby works for some companies (Ramp) but blocks others (Anthropic, Figma). This is likely per-company Ashby configuration, not a Jina limitation. Individual job posting pages work reliably.

### Tips for SPA Rendering
- Use `x-timeout: 10` or higher to give JS time to render
- Use `x-wait-for-selector: <css>` to wait for specific elements before extracting
- Some sites may require an API key for reliable access (higher priority in Jina's queue)

## 3. Output Formats

### Default: Markdown (plain text response)
```
Title: Applied AI Engineer
URL Source: https://jobs.ashbyhq.com/ramp/...

Markdown Content:
## Location
New York, NY (HQ); San Francisco, CA
...
```

### JSON mode (`Accept: application/json`)
```json
{
  "code": 200,
  "status": 20000,
  "data": {
    "title": "Ramp Jobs",
    "url": "https://jobs.ashbyhq.com/ramp",
    "content": "## Engineering\n### Applied AI Engineer...",
    "metadata": { "lang": "en", "viewport": "...", ... },
    "usage": { "tokens": 7124 }
  }
}
```

### Other formats (via `X-Return-Format` header)
- `markdown` (default) - clean LLM-friendly markdown
- `html` - raw HTML
- `text` - plain text extraction
- `screenshot` - returns screenshot URL
- `pageshot` - full-page screenshot

### Streaming mode (`Accept: text/event-stream`)
Returns progressive SSE chunks; each iteration has more content than the previous.

## 4. Pricing

| Tier | Reader RPM | Search RPM | TPM | Cost |
|------|-----------|-----------|-----|------|
| No API key | 20 RPM | Blocked | - | Free |
| Free API key | 500 RPM | 100 RPM | 10M tokens total | Free |
| Paid | 500 RPM | 100 RPM | 2M TPM | Usage-based |
| Premium | 5,000 RPM | 1,000 RPM | 50M TPM | Usage-based |

- Token usage is counted based on **output response length** (not input)
- Free API key gives 10 million tokens total (not per month)
- No per-request cost on free tier, just rate limits

**For OpenRecruiter:** The free tier with an API key (500 RPM, 10M tokens) is more than sufficient. A single JD fetch uses ~4K-7K tokens of output. That's ~1,400-2,500 JD fetches on the free tier.

## 5. Authentication

- **Without API key:** Works, but limited to 20 RPM and higher latency (~7.9s avg)
- **With API key:** `Authorization: Bearer $JINA_API_KEY` header, 500 RPM, faster
- API keys are free at https://jina.ai/?sui=apikey
- Keys never expire, can be revoked
- Same key works across all Jina products (Embeddings, Reranker, etc.)

## 6. Headers Reference

### Request Control
| Header | Purpose | Example |
|--------|---------|---------|
| `Authorization` | API key | `Bearer jina_xxx` |
| `Accept` | Response format | `application/json`, `text/event-stream` |
| `X-Return-Format` | Content format | `markdown`, `html`, `text`, `screenshot` |
| `X-Engine` | Retrieval method | `browser`, `direct`, `cf-browser-rendering` |

### Content Filtering
| Header | Purpose | Example |
|--------|---------|---------|
| `X-Target-Selector` | Extract only these elements | `.job-description` |
| `X-Remove-Selector` | Remove these elements | `nav, footer, .cookie-banner` |
| `X-With-Links-Summary` | Include links summary | `true` or `all` |
| `X-With-Images-Summary` | Include images summary | `true` or `all` |
| `X-With-Generated-Alt` | AI image captions | `true` |

### Rendering Control
| Header | Purpose | Example |
|--------|---------|---------|
| `X-Timeout` | Max page load time (seconds) | `10` |
| `X-Wait-For-Selector` | Wait for element before extracting | `[data-job-id]` |
| `X-Locale` | Browser locale | `en-US` |
| `X-With-Shadow-Dom` | Extract Shadow DOM content | `true` |

### Network Control
| Header | Purpose | Example |
|--------|---------|---------|
| `X-Proxy-Url` | Use proxy server | `http://proxy:8080` |
| `X-Set-Cookie` | Forward cookies (bypasses cache) | `session=abc123` |
| `X-No-Cache` | Bypass cache | `true` |
| `X-Cache-Tolerance` | Cache TTL in seconds | `0` (no cache), `3600` (default) |

### POST Body Options
| Field | Purpose |
|-------|---------|
| `url` | Target URL (required for POST) |
| `injectPageScript` | JavaScript to run before extraction |
| `viewport` | Custom browser viewport size |

## 7. Reliability

### What it handles well
- JavaScript-rendered SPAs (React, Next.js, Vue)
- Redirects (preserves final destination URL)
- PDFs (native support)
- Cookie banners (generally extracts main content around them)
- Large pages (streaming mode available)

### What it does NOT handle
- Login/auth walls (cannot bypass)
- CAPTCHA-protected pages (warns but cannot solve)
- Some anti-bot protections (does not actively bypass)
- Respects robots.txt by default
- Per-site blocking (some Ashby boards block Jina's IP)

### Caching
- Default cache TTL: 3600 seconds (1 hour)
- Bypass with `X-No-Cache: true` or `X-Cache-Tolerance: 0`
- Cookie-forwarded requests are never cached

## 8. Speed

| Scenario | Latency |
|----------|---------|
| No API key (free, no auth) | ~7.9s average |
| With API key, simple page | ~1.5-2s |
| With API key, JS-heavy SPA | ~3-4s |
| With `x-timeout: 10` | Up to 10s (waits for JS) |
| Search endpoint | ~2.5s average |

**For OpenRecruiter:** A single JD fetch takes 2-4 seconds. Acceptable for Phase 1 intake where we only fetch one JD at a time.

## 9. Size Limits

- No explicit size limit documented
- Streaming mode recommended for large pages
- Token counting is based on output length
- Practical limit: the page needs to load within the timeout window

## 10. Architecture (Self-Hosting Option)

The reader is open source (Apache-2.0): https://github.com/jina-ai/reader

Tech stack:
- Node.js v18 + TypeScript
- Puppeteer + headless Chrome
- MongoDB for data storage
- Docker containerization

Self-hosting is possible but unnecessary given the generous free tier.

## 11. Alternatives

Jina's docs don't mention competitors, but known alternatives include:

| Service | Approach | JS Rendering | Free Tier |
|---------|----------|-------------|-----------|
| **Jina Reader** | Hosted Puppeteer | Yes | 500 RPM with key |
| **Firecrawl** | Hosted browser | Yes | 500 credits/month |
| **Browserless** | Headless Chrome API | Yes | Limited |
| **Playwright/Puppeteer** | Self-hosted | Yes | Free (self-managed) |
| **Mozilla Readability** | DOM parsing (no browser) | No | Free (library) |
| **Trafilatura** | Python extraction | No | Free (library) |

## Recommendation for OpenRecruiter

**Use Jina Reader for JD fetching in Phase 1 intake.** Here's why:

1. **Zero infrastructure** - just an HTTP call with URL prepended
2. **Handles Ashby, Greenhouse, Lever SPAs** - JS rendering via headless Chrome
3. **Returns clean markdown** - perfect for LLM consumption
4. **Free tier is generous** - 500 RPM with API key, 10M tokens
5. **Fast enough** - 2-4s per JD fetch, only needed once per intake
6. **JSON mode** - easy to parse `data.content` and `data.title`

### Implementation Pattern

```typescript
// Simple fetch - just prepend the URL
const response = await fetch(`https://r.jina.ai/${jobUrl}`, {
  headers: {
    'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
    'Accept': 'application/json',
    'X-Timeout': '10',
    'X-Remove-Selector': 'nav, footer, .cookie-banner',
  },
});
const { data } = await response.json();
// data.title = "Applied AI Engineer"
// data.content = "## About the Role\n..."
// data.url = final URL after redirects
```

### Env Var Needed
```
JINA_API_KEY=jina_xxx  # Free at https://jina.ai/?sui=apikey
```

### Edge Cases to Handle
- Ashby boards that block Jina (fallback: try without headers, or use BrowserOS MCP)
- CAPTCHA warnings in response (check for "CAPTCHA" in content, alert recruiter)
- Timeout on slow-loading pages (use `X-Timeout: 15` for safety)
- Empty content (check `data.content` length, retry with `X-No-Cache: true`)
