# Web Scraping / JS Rendering Services Research

**Date:** 2026-04-29
**Goal:** Find a service to fetch full text content from JS-rendered job description URLs (Ashby, Lever, Greenhouse, etc.)

---

## Comparison Table

| Service | JS Rendering | Clean Markdown Output | Free Tier | API Simplicity | Best For |
|---------|-------------|----------------------|-----------|---------------|----------|
| **Firecrawl** | Yes (automatic) | Yes (markdown, HTML, JSON) | 500 credits (one-time) | Single POST call | Production use, best overall |
| **Jina Reader** | Yes (browser-based) | Yes (markdown) | 10M tokens free per key, no signup needed | Single GET call (just prepend URL) | Simplest possible integration |
| **Browserless** | Yes (full Chrome) | Not natively (returns HTML, need to parse) | 1,000 units/mo, 1 min max session | Medium complexity (BrowserQL or Puppeteer) | Complex automation, not simple scraping |
| **Crawl4AI** | Yes (Playwright) | Yes (markdown) | Open source (free, self-hosted) | Docker API or Python lib | Self-hosted, cost-sensitive |
| **ScrapingBee** | Yes | HTML only (no markdown) | Could not confirm (docs behind auth) | Single GET call | Generic scraping |
| **Brave Search API** | No (search only) | No | $5/mo free credits | N/A | Not applicable -- search only, no URL fetch |

---

## Detailed Findings

### 1. Firecrawl

**How it works:** POST to `https://api.firecrawl.dev/v2/scrape` with a URL and desired formats. Firecrawl handles proxies, anti-bot, and JS rendering automatically. Returns clean markdown, HTML, structured JSON, screenshots, metadata, or combinations.

**API call:**
```bash
curl -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown"]}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n\nPage content in clean markdown...",
    "metadata": {
      "title": "Page Title",
      "description": "Meta description",
      "sourceURL": "https://example.com",
      "statusCode": 200
    }
  }
}
```

**JS rendering:** Automatic, no configuration needed.

**Pricing:**
- Free: 500 credits (one-time, no card required)
- Hobby: $16/mo for 3,000 credits (1 credit = 1 scrape)
- Standard: $83/mo for 100,000 credits
- Scrape cost: 1 credit per page (base)

**Rate limits:** 2 concurrent (free), 5 concurrent (Hobby), 50 concurrent (Standard)

**SDK:** `@mendable/firecrawl-js` (Node.js/TypeScript), Python SDK, CLI tool

**Verdict:** Best overall option. One API call, automatic JS rendering, clean markdown output, TypeScript SDK. The free tier (500 credits) is enough for initial development and testing. Hobby plan at $16/mo covers ~3,000 JD fetches which is more than enough.

---

### 2. Jina Reader

**How it works:** Prepend `https://r.jina.ai/` to any URL. That's it. Returns clean markdown via a simple GET request.

**API call:**
```bash
curl "https://r.jina.ai/https://jobs.ashbyhq.com/example/job-id"
```

**JS rendering:** Yes, browser-based rendering.

**Output:** JSON with `url`, `title`, `content` (markdown), `timestamp`.

**Pricing:**
- No signup required for basic use (20 RPM)
- Free API key: 10 million tokens included, 500 RPM
- Paid: token-based pricing (details not fully public)

**Rate limits:** 20 RPM (no key), 500 RPM (free key), 5,000 RPM (premium)

**Verdict:** Simplest possible integration -- literally a GET request with URL prepended. Free tier is generous. The only concern is reliability/uptime for a production service, and less control over output format compared to Firecrawl.

---

### 3. Browserless

**How it works:** Full headless Chrome as a service. Connect via Puppeteer/Playwright, BrowserQL (their query language), or REST APIs. Offers smart scraping, screenshots, PDFs.

**Pricing:**
- Free: 1,000 units/mo, 2 concurrent, 1 min max session
- Prototyping: $25/mo, 20,000 units
- Starter: $140/mo, 180,000 units

**JS rendering:** Yes (full Chrome browser).

**Output:** HTML primarily. No built-in markdown conversion -- you'd need to parse HTML yourself.

**Verdict:** Overkill for our use case. We just need to fetch a page and get text. Browserless is designed for complex browser automation (clicking, filling forms, navigating). More expensive, more complex to integrate, and doesn't return markdown natively. The free tier's 1-minute max session is also limiting.

---

### 4. Crawl4AI

**How it works:** Open-source Python library using Playwright for JS rendering. Outputs clean markdown optimized for LLMs. Can be self-hosted via Docker with a FastAPI server.

**JS rendering:** Yes (Playwright-based).

**Output:** Markdown (raw, "fit", and clean variants), structured JSON.

**Self-hosting:** Docker image available. Dashboard at `localhost:11235/dashboard`. FastAPI server exposes REST endpoints.

**Cloud version:** In closed beta.

**Node.js integration:** Would need to run the Docker container and call its REST API from our Next.js app.

**Verdict:** Great open-source option but adds operational complexity. We'd need to run and maintain a Docker container (either locally or on a VPS). The cloud version is in beta. For a Vercel-deployed app, calling a self-hosted Docker service adds latency and infrastructure management. Better suited if we were self-hosting the whole stack.

---

### 5. ScrapingBee

**How it works:** Proxy-based scraping API. Send a GET request with your URL and API key. Returns rendered HTML.

**JS rendering:** Yes.

**Output:** HTML only (no markdown conversion).

**Pricing:** Could not confirm details -- docs are behind authentication. Generally known to be ~$49/mo for 1,000 credits with JS rendering (5 credits per JS-rendered request).

**Verdict:** More expensive per request than Firecrawl when JS rendering is needed (5 credits vs 1). No markdown output -- would need additional processing. Not as well-suited for our specific use case.

---

### 6. Brave Search API

**What it does:** Search-only. No URL content fetching endpoint.

**Verdict:** Not applicable. Cannot fetch page content from a given URL.

---

## Recommendation

### Primary: Firecrawl

**Why:**
1. **One API call** to get clean markdown from any JS-rendered page
2. **Automatic JS rendering** -- no configuration needed for Ashby/Lever/Greenhouse
3. **TypeScript SDK** (`@mendable/firecrawl-js`) fits our stack perfectly
4. **500 free credits** for development, $16/mo Hobby plan for production
5. **1 credit per scrape** -- fetching JDs is cheap
6. **Rich metadata** extraction (title, description, OG tags) comes free with every scrape
7. **Most reliable** -- purpose-built for this exact use case

### Fallback: Jina Reader

**Why as fallback:**
1. Zero-config GET request -- simplest possible integration
2. Generous free tier (10M tokens)
3. No SDK needed -- just `fetch("https://r.jina.ai/" + url)`
4. Could use as a fallback if Firecrawl is down or rate-limited

### Integration estimate

Firecrawl integration for JD fetching: ~30 lines of code total.

```typescript
// Pseudocode for the tool
const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: jdUrl,
    formats: ["markdown"]
  })
});
const { data } = await response.json();
return data.markdown; // Clean JD text ready for the pipeline
```

### Cost projection

At ~50 JDs per month: 50 credits = well within the 500 free credits. Even at scale, Hobby plan ($16/mo, 3,000 credits) covers 3,000 JD fetches per month.
