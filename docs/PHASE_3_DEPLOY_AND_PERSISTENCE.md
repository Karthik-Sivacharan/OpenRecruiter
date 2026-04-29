# Phase 3: Deploy + Chat Persistence + Context Management

> Combines Vercel deployment (done), chat persistence, sidebar UI, per-role Airtable tables, and context management into one phase.

## Status

- [x] **Step 1: Vercel Deploy** — live at https://x2-openrecruiter.vercel.app (Hobby plan)
- [ ] Step 2: Neon + Drizzle setup
- [ ] Step 3: Chat save/load/resume
- [ ] Step 4: Sidebar UI
- [ ] Step 5: Context management (pruneMessages + tool-result clearing)
- [ ] Step 6: Per-role Airtable tables

---

## Architecture Decisions

### Database: Neon Postgres (free tier)

**Why Neon:** Vercel's own chatbot template uses it. Free tier gives 0.5GB + 100 compute-hours/mo. Auto-wakes on request (no 7-day pause like Supabase). Native Vercel Marketplace integration auto-injects `DATABASE_URL`.

**Cost estimate:** ~5,000 conversations before hitting 0.5GB. $0/month at our scale.

**ORM:** Drizzle (lightweight, type-safe, Vercel-ecosystem standard).

### Chat Resumption: "Send Only Last Message" Pattern

The client sends only the new user message + chat ID. The server loads full history from Neon, appends the new message, sends to Claude. This keeps requests small — critical because our messages contain large tool results (Apollo enrichment data, EnrichLayer profiles).

**Key AI SDK v6 APIs:**
- `useChat({ id, messages: savedMessages })` — hydrate from DB (v6 uses `messages`, NOT `initialMessages`)
- `toUIMessageStreamResponse({ originalMessages, onFinish })` — save after each turn
- `result.consumeStream()` — ensures `onFinish` fires even if client disconnects
- `convertToModelMessages()` — reconstructs tool_use/tool_result blocks from saved UIMessages
- ~~`pruneMessages()`~~ — REMOVED in Phase 4 (caused duplicate search bug by stripping Apollo results mid-conversation). Now relying solely on Anthropic server-side context management.

### Context Management: Free Layers First, Compaction Later

**Problem:** Long sessions accumulate 100k+ tokens from tool results. Eventually exceeds context window or degrades quality.

**How production apps handle it:**
- Claude Code: tool result capping + auto-compaction at ~167k tokens
- ChatGPT: silent automatic summarization (no user control)
- Cursor: dynamic context discovery (reduced tokens 46.9%)

**Our approach — 3 layers, cheapest first:**

| Layer | Technique | Cost | When |
|-------|-----------|------|------|
| 1 | `pruneMessages()` from AI SDK | Free | Every request — strips old reasoning + tool calls mechanically |
| 2 | Anthropic tool-result clearing | Free | At 50k tokens — replaces old tool result content with `[cleared]`, no LLM call |
| 3 | Anthropic compaction (future) | ~$0.50 per trigger | At 150k tokens — full conversation summarization, requires extra LLM call |

Layers 1-2 are free and handle typical sessions. Layer 3 added later only if needed.

**Why this works for us:** Airtable is the source of truth for candidate data. Once enrichment results are pushed to Airtable, the raw API responses in chat context are redundant. Claude can always call `airtableGetCandidates` to refresh.

**UI always shows full history** from the DB. Only the API call to Claude gets the pruned/cleared version.

---

## Step 1: Vercel Deploy (DONE)

Live at https://x2-openrecruiter.vercel.app

**What was done:**
- Added `export const runtime = 'nodejs'` and `export const maxDuration = 300` to `route.ts`
- Connected GitHub repo for auto-deploy on push
- Set all 10 env vars in Vercel dashboard
- Installed `@vercel/analytics` + `@vercel/speed-insights`
- Disabled Vercel Authentication (public access)

**Note:** On Hobby plan (free). maxDuration effectively caps at 60s. Upgrade to Pro ($20/mo) if single-turn timeouts become an issue. Current pipeline has approval gates between phases, so each turn is short.

---

## Step 2: Neon + Drizzle Setup

**New deps:** `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit` (dev)

**New env var:** `DATABASE_URL` — provisioned from Vercel Marketplace

### Files to create

**`drizzle.config.ts`** (project root)
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

**`src/lib/db/schema.ts`** — single table, JSONB messages
```ts
import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title'),
  roleName: text('role_name'),
  airtableTableId: text('airtable_table_id'),
  messages: jsonb('messages').$type<unknown[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**`src/lib/db/index.ts`** — Neon connection + Drizzle client
```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

**`src/lib/db/queries.ts`** — 5 functions
- `createChat(id, title)` — INSERT new row with empty messages
- `loadChat(id)` — SELECT by id
- `saveChat(id, messages)` — UPDATE messages JSONB + updatedAt, auto-set title from first user message
- `listChats()` — SELECT id, title, role_name, updated_at ORDER BY updated_at DESC
- `updateChatMeta(id, { roleName?, airtableTableId? })` — partial metadata update

### Test checkpoint
```bash
npx drizzle-kit push  # sync schema to Neon
```
Then call createChat/loadChat/saveChat from a temp script. Verify rows in Neon dashboard.

---

## Step 3: Chat Save/Load/Resume

### Files to create

**`src/components/chat.tsx`** — extracted client component

Props: `{ id: string; initialMessages?: UIMessage[] }`

```ts
const transport = new DefaultChatTransport({
  api: '/api/chat',
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: { chatId: id, messages },
  }),
});

useChat({ id, messages: initialMessages, transport, sendAutomaticallyWhen: ... })
```

**`src/app/chat/[id]/page.tsx`** — server component
```tsx
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await loadChat(id);
  if (!conversation) notFound();
  return <Chat id={id} initialMessages={conversation.messages as UIMessage[]} />;
}
```

**`src/app/api/conversations/route.ts`** — POST creates new conversation
```
POST /api/conversations  { title?: string }  ->  { id: string }
```

### Files to modify

**`src/app/api/chat/route.ts`** — persistence + consumeStream
```ts
const { messages, chatId } = await req.json();

const result = streamText({ ... });

result.consumeStream();  // CRITICAL: ensures onFinish fires even if client disconnects

return result.toUIMessageStreamResponse({
  originalMessages: messages,
  onFinish: ({ messages: finalMessages }) => {
    if (chatId) saveChat(chatId, finalMessages);
  },
});
```

**`src/app/page.tsx`** — thin wrapper for new chats
```tsx
"use client";
import { Chat } from '@/components/chat';
import { nanoid } from 'nanoid';

export default function NewChatPage() {
  return <Chat id={nanoid()} />;
}
```

### Test checkpoint
- Send a message at `/` -> check Neon DB has the messages
- Navigate to `/chat/[id]` -> messages reload
- Send another message -> refresh -> persisted
- Tool call parts preserved across reload

---

## Step 4: Sidebar UI

### Files to create

**`src/components/chat-sidebar.tsx`** — client component
- Fetches `GET /api/conversations` on mount + on `usePathname()` change
- Scrollable list: title, role name, relative time
- "New Search" button -> navigates to `/`
- Active conversation highlighted
- Collapsible on mobile
- Dark theme matching existing UI

### Files to modify

**`src/app/api/conversations/route.ts`** — add GET handler
```
GET /api/conversations  ->  { conversations: { id, title, roleName, updatedAt }[] }
```

**`src/app/layout.tsx`** — flex layout with sidebar
```tsx
<body className="min-h-full flex bg-[#08090a]">
  <TooltipProvider>
    <ChatSidebar />
    <main className="flex-1 flex flex-col min-h-dvh">{children}</main>
  </TooltipProvider>
</body>
```

### Test checkpoint
- Sidebar shows past conversations
- Click loads correct chat
- New chat appears after first message
- Mobile: collapses/expands

---

## Step 5: Context Management

Added to `src/app/api/chat/route.ts` — no new files.

### Layer 1: pruneMessages (free, every request)
```ts
import { pruneMessages } from 'ai';

const prunedMessages = pruneMessages({
  messages: validatedMessages,
  reasoning: 'before-last-message',
  toolCalls: 'before-last-2-messages',
  emptyMessages: 'remove',
});
```

### Layer 2: Tool-result clearing (free, Anthropic server-side)

Pass via `@ai-sdk/anthropic` provider config or direct API headers:
```
Beta header: context-management-2025-06-27

context_management.edits: [{
  type: "clear_tool_uses_20250919",
  trigger: { type: "input_tokens", value: 50000 },
  keep: { type: "tool_uses", value: 6 },
}]
```

Old tool results replaced with `[cleared to save context]`. No LLM call, no extra billing. The record that the tool was called stays — Claude just can't see the raw Apollo/EnrichLayer response anymore (already in Airtable).

### Layer 3: Full compaction (FUTURE — not in this phase)

Would add at 150k token trigger. Costs ~$0.50 per trigger (extra LLM call to summarize). Only needed for marathon sessions that blow past clearing.

### Test checkpoint
- Run a full enrichment pipeline (10+ candidates)
- Check API token usage doesn't grow linearly with message count
- Verify Claude still has context to continue the pipeline after clearing

---

## Step 6: Per-Role Airtable Tables

### Files to create

**`src/lib/tools/airtable-meta.ts`** — `airtableCreateTable` tool
- POSTs to Airtable Meta API to create table with all 34+ fields
- Saves returned `tblXXX` id to conversation via `updateChatMeta`

### Files to modify

**`src/lib/tools/airtable.ts`** — add optional `table_id` to all 3 tools
```ts
function airtableUrl(tableId?: string): string {
  const table = tableId || AIRTABLE_TABLE_ID();
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID()}/${table}`;
}
```

**`src/app/api/chat/route.ts`** — register tool + dynamic system prompt
- Load conversation metadata when chatId provided
- Inject airtable_table_id into system prompt if set

### Test checkpoint
- New role search creates a new Airtable table
- Enrichment data lands in the per-role table
- Reopen conversation -> agent uses the same table

---

## Complete File Change Summary

| Step | File | Action |
|------|------|--------|
| 2 | `drizzle.config.ts` | CREATE |
| 2 | `src/lib/db/schema.ts` | CREATE |
| 2 | `src/lib/db/index.ts` | CREATE |
| 2 | `src/lib/db/queries.ts` | CREATE |
| 3 | `src/components/chat.tsx` | CREATE |
| 3 | `src/app/chat/[id]/page.tsx` | CREATE |
| 3 | `src/app/api/conversations/route.ts` | CREATE |
| 3 | `src/app/api/chat/route.ts` | MODIFY |
| 3 | `src/app/page.tsx` | MODIFY |
| 4 | `src/components/chat-sidebar.tsx` | CREATE |
| 4 | `src/app/api/conversations/route.ts` | MODIFY |
| 4 | `src/app/layout.tsx` | MODIFY |
| 5 | `src/app/api/chat/route.ts` | MODIFY |
| 6 | `src/lib/tools/airtable-meta.ts` | CREATE |
| 6 | `src/lib/tools/airtable.ts` | MODIFY |
| 6 | `src/app/api/chat/route.ts` | MODIFY |

## New Dependencies

- `@neondatabase/serverless` — Neon's serverless driver
- `drizzle-orm` — TypeScript ORM
- `drizzle-kit` (dev) — migration tool
