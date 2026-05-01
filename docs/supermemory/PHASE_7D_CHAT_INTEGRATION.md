# Phase 7D: Supermemory Chat Integration

## What Was Implemented

A "Supermemory" toggle in the chat input area that controls whether the AI agent searches the talent pool during intake. When enabled, the agent automatically searches past candidates before sourcing new ones.

## How the Toggle Works

1. The toggle appears in the PromptInputFooter, next to the existing tools area
2. When OFF (default): muted text, no talent pool instructions in system prompt
3. When ON: highlighted in violet, system prompt includes talent pool search instructions
4. State persists per conversation in the database (`use_talent_pool` column)
5. When loading an existing conversation, the toggle state is restored from the DB

## Data Flow

```
UI Toggle (chat.tsx)
  -> POST /api/conversations/talent-pool { chatId, useTalentPool }
  -> updateChatMeta() saves to conversations.use_talent_pool

Chat message sent (chat.tsx)
  -> POST /api/chat { chatId, messages }
  -> route.ts reads useTalentPool from DB via getChatTalentPoolFlag(chatId)
  -> buildSystemPrompt(useTalentPool) conditionally injects talent pool instructions
  -> searchTalentPool + syncToTalentPool tools are always registered
  -> System prompt controls when the agent uses them
```

## System Prompt Behavior

When talent pool is ENABLED, the system prompt includes:
- Search the talent pool after reading the JD, before asking follow-up questions
- Present matches with a summary table (Name, Title, Company, Previous Role, Fit Score)
- Let recruiter choose to include past candidates or skip
- Offer to sync new candidates at end of pipeline

When talent pool is DISABLED:
- No mention of talent pool in system prompt
- Tools are still registered but the agent has no instructions to use them

## Files Changed

| File | Change |
|------|--------|
| `src/components/chat.tsx` | Added toggle state, TooltipProvider + Toggle UI, persistence via API |
| `src/app/api/chat/route.ts` | Import talent pool tools, read toggle from DB, conditional system prompt |
| `src/lib/db/schema.ts` | Added `useTalentPool` boolean column (default false) |
| `src/lib/db/queries.ts` | Added `useTalentPool` to `updateChatMeta()`, new `getChatTalentPoolFlag()` |
| `src/app/api/conversations/talent-pool/route.ts` | New API endpoint for toggle persistence (POST + GET) |
| `src/app/chat/[id]/page.tsx` | Pass `initialUseTalentPool` from server to Chat component |
| `src/components/ui/toggle.tsx` | Added via shadcn (base-ui toggle primitive) |

## How to Test

1. Start the dev server: `npm run dev`
2. Open a new chat - the toggle should appear in the input footer, defaulting to OFF
3. Click the toggle - it should highlight in violet
4. Send a message with a JD URL
5. The agent should search the talent pool before asking follow-up questions
6. Toggle OFF and send a new message - no talent pool search
7. Navigate away and back - toggle state should persist

## Database Migration

Run via drizzle-kit push to sync the schema:

```bash
npx drizzle-kit push
```
