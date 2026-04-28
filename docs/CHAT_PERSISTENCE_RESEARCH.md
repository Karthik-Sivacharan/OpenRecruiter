# Chat Persistence + Deployment Research

> Researched 2026-04-28

## Overview

Need to add:
1. Vercel deployment with public URL
2. Chat persistence (save/load/continue conversations)
3. Per-role Airtable tables
4. Sidebar UI for conversation history

## Database: Neon Postgres

**Why Neon over Supabase:** Supabase free tier hard-pauses after 7 days of inactivity (requires manual reactivation). Neon auto-wakes on request. Neon has native Vercel integration (auto-injects DATABASE_URL).

**Stack:** Neon Postgres + Drizzle ORM + `@neondatabase/serverless` driver

### Schema (single table, simple)

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,           -- nanoid
  title TEXT,                    -- auto from first message
  role_name TEXT,                -- set after intake
  airtable_table_id TEXT,        -- set after table creation
  messages JSONB,                -- full UIMessage[] array
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

## Chat Continuation — How It Works

1. Save all `UIMessage[]` (including tool calls/results) as JSONB in Neon
2. Load them as `initialMessages` in `useChat({ id, messages: initialMessages })`
3. User types → `useChat` sends FULL history (old + new) to `/api/chat`
4. `convertToModelMessages` reconstructs proper tool_use/tool_result blocks
5. Claude gets full context, continues as if session never ended

### Key AI SDK APIs
- `useChat({ id, messages: initialMessages })` — hydrate from DB
- `onFinish` callback in `toUIMessageStreamResponse()` — save after each turn
- `result.consumeStream()` — ensure saves complete even if client disconnects
- `validateUIMessages({ messages, tools })` — validate stored tool calls against current schemas
- `generateMessageId` with `createIdGenerator` — server-side deterministic IDs

## Per-Role Airtable Tables

### Create via API
```
POST https://api.airtable.com/v0/meta/bases/{baseId}/tables
{
  "name": "Role: Senior ML Engineer - SF",
  "fields": [
    { "name": "Name", "type": "singleLineText" },
    { "name": "Email", "type": "email" },
    ...all 34+ fields from AIRTABLE_SCHEMA.md
  ]
}
```

Returns `{ id: "tblXXX", name: "..." }` — store `table_id` on conversation record.

### Tool Changes
Add optional `table_id` parameter to all Airtable tools. If provided, use it instead of `process.env.AIRTABLE_TABLE_ID`. System prompt tells Claude to always pass the table_id.

## URL Structure

```
/                    → sidebar + "New Chat" button
/chat/[id]           → loads saved messages from Neon, renders chat

New Chat:  POST /api/conversations → create Neon row → redirect to /chat/[id]
Save:      onFinish callback saves UIMessage[] to Neon after each assistant turn
Load:      Server component at /chat/[id] loads from Neon → passes to useChat
Continue:  User types → full history sent to Claude → continues with context
```

## Vercel Deployment

- Import GitHub repo at vercel.com/new (auto-detects Next.js)
- Set 10+ env vars in Vercel dashboard
- Add `export const maxDuration = 300;` to chat route (5 min timeout)
- Neon: provision from Vercel Marketplace, auto-injects DATABASE_URL
- No vercel.json needed

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Drizzle schema (conversations table) |
| `src/lib/db/index.ts` | Neon connection + Drizzle client |
| `src/lib/db/queries.ts` | createChat, loadChat, saveChat, listChats |
| `src/app/chat/[id]/page.tsx` | Server component: loads messages, renders Chat |
| `src/app/api/conversations/route.ts` | POST to create new conversation |
| `src/components/chat-sidebar.tsx` | Sidebar listing past conversations |
| `src/components/chat.tsx` | Extracted client Chat component (accepts id + initialMessages) |
| `src/lib/tools/airtable-meta.ts` | airtableCreateTable tool |
| `drizzle.config.ts` | Drizzle config for migrations |

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Remove chat logic, redirect to /chat/new or render sidebar |
| `src/app/api/chat/route.ts` | Add conversationId, onFinish, consumeStream, maxDuration |
| `src/lib/tools/airtable.ts` | Optional table_id param on all tools |
| `src/app/layout.tsx` | Add sidebar layout |

## New Dependencies

- `@neondatabase/serverless`
- `drizzle-orm`
- `drizzle-kit` (dev)

## Implementation Order

1. Set up Neon + Drizzle schema
2. Chat persistence (save/load/continue)
3. Sidebar UI
4. Per-role Airtable tables
5. Deploy to Vercel
