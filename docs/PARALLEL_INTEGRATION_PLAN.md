# Parallel.ai Integration Plan

Branch: `feat/parallel-api-integration`
Status: In Progress

## Prerequisites

- [x] Get API key from https://platform.parallel.ai
- [x] Add `PARALLEL_API_KEY` to `.env.local`
- [x] Add `PARALLEL_API_KEY` to Vercel (production + development)
- [x] `npm install parallel-web`
- [x] Dry-run both APIs - verified working

## Dry-Run Results (2025-05-24)

**Search API: WORKS PERFECTLY**
- Query: `"Evan You" "Vue.js" github.com`
- Found: GitHub profile, GitHub readme story, personal site (evanyou.me) in top 3
- Rich excerpts with highlighted terms - better than Nia for verification

**Extract API: WORKS FOR STANDARD PAGES, NOT SPAs**
- anthropic.com/careers: 9,820 chars, clean markdown
- Ashby/Greenhouse/Lever SPA pages: Returns empty/404 (same as web_fetch)
- Conclusion: Extract replaces web_fetch's role, NOT Jina's JS rendering role

## Swap 1: JD Fetching - Parallel Extract with Jina Fallback

**File:** `src/lib/tools/jd-fetch.ts`

**Current behavior:** Calls Jina Reader (`https://r.jina.ai/{url}`) as a fallback for JS-heavy SPA job boards. Returns `{ title, content, url }`.

**New behavior:** Two-tier approach:
1. **Primary:** Parallel Extract API with `objective` parameter for focused JD extraction
2. **Fallback:** If Extract returns empty/short content (<100 chars), fall through to Jina Reader (kept for JS SPA rendering)

**Why this is the right design:**
- Extract's `objective` param strips nav/footer/cookie noise on standard pages (Jina returns everything)
- Extract handles PDFs natively (Jina doesn't)
- Jina stays for the one thing it does better: rendering JS SPAs (Ashby, Lever, Greenhouse)
- Shows understanding of when to use each Parallel API vs knowing its limitations

**Changes:**
1. Import shared Parallel client from `src/lib/clients/parallel.ts`
2. Modify `execute` body: try Extract first, if content < 100 chars fall through to Jina
3. Keep old Jina code as the fallback path (NOT commented out - it's still used)

**Return type stays identical:**
```typescript
Promise<{ title: string | null; content: string; url: string } | { error: string }>
```

**What does NOT change:**
- Tool name (`fetchJobDescription`)
- Tool description (update to mention Parallel as primary)
- Input schema (`z.object({ url: z.string().url() })`)
- How it's imported/registered in `route.ts`

---

## Swap 2: Nia Web Search -> Parallel Search API

**File:** `src/lib/tools/nia.ts`

**Scope:** Only the internal `searchWeb()` helper function (lines 233-270). The outer `searchAndSaveWebPresence` tool, all Airtable logic, and `verifyResult()` stay untouched.

**Current behavior:** `searchWeb()` calls `POST https://apigcp.trynia.ai/v2/search` with `{ mode: 'web', query, num_results, category }`. Returns `Array<{ url, title, snippet }>`.

**New behavior:** Calls Parallel Search API via SDK. The `objective` parameter improves result relevance for candidate discovery.

**Changes:**
1. Import shared Parallel client
2. Replace `searchWeb()` body (~20 lines):
   - Old: `fetch('https://apigcp.trynia.ai/v2/search', ...)`
   - New: `parallel.search({ objective: "Find online presence...", search_queries: [query], mode: "basic" })`
3. Map response: `results[].excerpts[0]` -> `snippet`
4. Comment out old Nia search code (don't delete)

**Return type stays identical:**
```typescript
Array<{ url: string | null; title: string | null; snippet: string | null }>
```

**What does NOT change:**
- `searchAndSaveWebPresence` tool (name, description, input schema, execute logic)
- `verifyResult()` function (still gets url/title/snippet to verify)
- All Airtable fetch/write logic
- `niaWebSearch` standalone tool (keep as-is or comment out)
- `niaAnalyzeCandidates` (already disabled)
- How tools are imported/registered in `route.ts`
- System prompt references

**Why Search API is better than Nia:**
- `objective` parameter guides relevance ranking (not just keyword matching)
- Richer excerpts give `verifyResult()` more text to match against
- `mode: "advanced"` available for hard-to-find candidates

---

## Shared Setup

**New file:** `src/lib/clients/parallel.ts`
```typescript
import Parallel from 'parallel-web';
export const parallel = new Parallel();
// Reads PARALLEL_API_KEY from env automatically
```

---

## What We Do NOT Touch

- `route.ts` tool registration (tool names unchanged)
- System prompt in `buildSystemPrompt()` (tool behavior unchanged)
- Apollo (search + contact database - Parallel can't replace this)
- EnrichLayer (bigger project, not for this PR)
- AgentMail (email infra)
- Airtable (database layer)
- Scoring (Claude Opus)
- Talent pool (Supermemory)

---

## Testing

1. **Extract test:** Paste a standard careers page URL -> should get clean focused markdown
2. **Extract + Jina fallback test:** Paste an Ashby SPA URL -> Extract returns short, Jina kicks in
3. **Search test:** Run pipeline through Phase 3 Step 4 -> verify GitHub/portfolio URLs found
4. **Build test:** `npm run build` passes with no type errors

---

## Implementation Order

1. Create `src/lib/clients/parallel.ts` (shared client)
2. Edit `src/lib/tools/jd-fetch.ts` (Swap 1 - Extract + Jina fallback)
3. Edit `src/lib/tools/nia.ts` (Swap 2 - Search API)
4. Test both swaps
5. Commit: `feat: integrate Parallel Extract + Search APIs`
