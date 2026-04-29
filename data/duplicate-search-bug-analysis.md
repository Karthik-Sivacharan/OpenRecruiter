# Duplicate Search Bug Analysis

## Root Cause

**`pruneMessages` with `toolCalls: 'before-last-2-messages'` strips Apollo search results from context before the enrichment request reaches the model.**

Here is the timeline:

1. User pastes JD URL (message 1)
2. Orchestrator runs multiple tool-call steps: `web_fetch` / `fetchJobDescription`, then `apolloSearchPeople` (2-3 passes), then responds with "Found X candidates, enrich?" — this is one long assistant turn with many steps.
3. User says "Yes go for it" (message 2)
4. **The POST handler is called again** with the full `messages` array from the client.

At step 4, `pruneMessages` runs with `toolCalls: 'before-last-2-messages'`. The "last 2 messages" are:
- The user's "Yes go for it" (last message)
- The assistant's final text response "Found X candidates..." (second-to-last message)

**All tool calls from BEFORE those last 2 messages are stripped.** This means the `apolloSearchPeople` results, `web_fetch` results, and `fetchJobDescription` results are all removed from the conversation. The model receives:
- The system prompt (full pipeline instructions)
- The user's original JD URL (message 1, but with tool results stripped)
- The assistant's summary text "Found X candidates..." (but the tool call/result pairs that produced it are gone)
- The user's "Yes go for it"

The model sees its own summary text but has **no actual candidate data** (no apollo_ids, no names, no search results). It knows it should enrich candidates but has no IDs to work with. So it follows the system prompt from the top: fetch the JD, search again, then enrich.

## Which Mechanism is Responsible

**`pruneMessages` is the primary cause** (line 172-177 of `route.ts`):

```typescript
const prunedMessages = pruneMessages({
  messages: modelMessages,
  reasoning: 'before-last-message',
  toolCalls: 'before-last-2-messages',  // <-- THIS
  emptyMessages: 'remove',
});
```

The `toolCalls: 'before-last-2-messages'` setting is too aggressive. The Apollo search happens in a multi-step assistant turn that becomes "old" as soon as the user responds. The tool results with candidate data (apollo_ids, names, emails) are the exact data needed for the next phase, but they get pruned.

### Secondary contributor: `contextManagement` (lines 191-200)

Even if pruning were fixed, the `contextManagement` config has a related risk:

```typescript
excludeTools: ['web_fetch', 'fetchJobDescription', 'setChatTitle', 'scoreCandidates'],
```

`apolloSearchPeople` is NOT in `excludeTools`. This means when context exceeds 80k tokens, Apollo search results will be cleared by Anthropic's server-side context management too. However, this is a secondary issue — the pruning bug fires first, at every request regardless of token count.

### Not the cause: message handling / DB

The client sends the **full `messages` array** on every request (line 48-52 of `chat.tsx`):
```typescript
prepareSendMessagesRequest: ({ id, messages }) => ({
  body: { chatId: id, messages },
}),
```

The server receives all messages including tool calls. The DB is only used for persistence (save on finish, load on page refresh). Messages flow client -> server with full history intact. The pruning happens server-side right before sending to the model.

## Specific Fix Recommendations

### Fix 1: Change `toolCalls` pruning to preserve more context (primary fix)

**File:** `src/app/api/chat/route.ts`, line 175

Change from:
```typescript
toolCalls: 'before-last-2-messages',
```

To one of:
- `'before-last-5-messages'` — preserves tool calls from recent turns including the search phase
- `'optimized'` — if the AI SDK supports a smarts-based approach
- Remove the `toolCalls` option entirely and rely solely on `contextManagement` for context reduction

The best option is likely `'before-last-5-messages'` since the search phase can produce 3-4 assistant steps (web_fetch + 2-3 apolloSearchPeople calls + summary), so keeping 5 messages back ensures search results survive the user's approval message.

### Fix 2: Add `apolloSearchPeople` to `excludeTools` in contextManagement (secondary fix)

**File:** `src/app/api/chat/route.ts`, line 198

```typescript
excludeTools: ['web_fetch', 'fetchJobDescription', 'setChatTitle', 'scoreCandidates', 'apolloSearchPeople'],
```

This prevents the server-side context management from clearing Apollo search results even when context gets large. The search results contain the apollo_ids needed for enrichment.

### Fix 3: Update system prompt to instruct the model to never re-search after approval (defense-in-depth)

**File:** `src/app/api/chat/route.ts`, in `SYSTEM_PROMPT` around line 49-51

Add explicit instruction:
```
CRITICAL: When the recruiter approves enrichment, use the candidates you already found and presented.
NEVER re-fetch the JD or re-search after the recruiter says "yes". Go straight to apolloBulkEnrich
with the apollo_ids from your previous search results. If you cannot find the apollo_ids in your
context, ask the recruiter to confirm rather than re-searching.
```

This is a belt-and-suspenders fix. Even if pruning strips the data, the model will at least know not to re-search and can ask for the IDs instead.

### Fix 4 (alternative): Summarize search results in assistant text before asking for approval

Instead of relying on tool results surviving in context, the system prompt could instruct the model to include apollo_ids in its summary text to the user:

```
When presenting search results, ALWAYS include a hidden data block with candidate apollo_ids
in your response text, so they survive context pruning. Format:
<!-- candidates: [{"apollo_id": "...", "name": "..."}, ...] -->
```

This ensures the IDs are in the assistant's text content (which is never pruned), not just in tool results.

## Other Potential Issues Found

1. **`emptyMessages: 'remove'`** — After tool calls are stripped, some assistant messages may become empty (they only contained tool calls, no text). These get removed entirely, which could cause the model to lose track of conversation flow.

2. **`stepCountIs(15)` may be too low** — The full enrich pipeline (apolloBulkEnrich + airtableCreateCandidates + enrichProfile per candidate + airtableUpdateCandidate per candidate + enrichWorkEmail + niaWebSearch + scoreCandidates) can easily exceed 15 tool calls for 5+ candidates. This could cause the pipeline to stop mid-enrichment, requiring the user to say "continue", which triggers another pruneMessages cycle and potentially more data loss.

3. **`saveChat` saves `finalMessages` from `onFinish`** — These are the post-stream messages, not the pruned ones. So the DB has the full history. But when the page reloads and messages come from the DB, they go through `pruneMessages` again on the next request. This is fine but worth noting.

4. **No `apolloBulkEnrich` in `excludeTools`** — After enrichment, the enrichment results (emails, employment history) could also be cleared by context management before they're used in downstream steps (airtableCreateCandidates). Adding it to `excludeTools` would be prudent.
