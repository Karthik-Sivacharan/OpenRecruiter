# Phase 5A: Auto-Reply Webhook

> Date: 2026-04-29

## Overview

When a candidate replies to outreach, a Vercel serverless function processes the reply and either auto-replies (using only JD + Airtable data) or flags for the recruiter.

**AgentMail does NOT have built-in auto-reply.** It only handles email transport. The "thinking" happens on our Vercel endpoint.

## Architecture

```
Candidate replies
  → AgentMail fires message.received webhook
  → POST /api/agentmail-webhook/route.ts (Vercel)
  → Verify Svix signature
  → Lookup candidate in Airtable by thread_id
  → Classify intent (regex → LLM if needed)
  → Auto-reply OR flag for recruiter
  → Update Airtable
  → Return 200
```

## Intent Classification

**Tier 1 — Regex (fast, no LLM cost):**
- Opt-out: "stop", "unsubscribe", "not interested", "remove me"
- Out-of-office: "out of office", "on vacation", "auto-reply"

**Tier 2 — Sonnet 4.6 (only when regex doesn't match):**
Classify into: interested, question-answerable, question-unanswerable, negative, ambiguous

## Decision Matrix

| Classification | Action |
|---|---|
| Opt-out | Auto-reply confirming removal, block list, cancel drips, Airtable "Declined" |
| Out-of-office | Label thread "ooo", do NOT reply, let drip continue |
| Interested | Auto-reply with enthusiasm + next steps from JD, cancel drips, Airtable "Replied" |
| Question-answerable | Auto-reply using ONLY JD + Airtable data, cancel drips, Airtable "Replied" |
| Question-unanswerable | Do NOT reply. Flag in Airtable as "Needs Recruiter" with the question |
| Negative (polite decline) | Auto-reply gracefully, cancel drips, Airtable "Declined" |
| Ambiguous | Flag for recruiter, don't reply |

## Critical Constraint

- NEVER hallucinate or make up information
- ONLY use JD text + candidate's Airtable row for reply context
- If candidate asks something not in JD/Airtable (team structure, interview process, specific people), flag for recruiter

## Webhook Implementation

```typescript
// /src/app/api/agentmail-webhook/route.ts
import { Webhook } from 'svix';

export async function POST(req: Request) {
  const body = await req.text(); // raw body for Svix verification
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  const wh = new Webhook(process.env.AGENTMAIL_WEBHOOK_SECRET!);
  const payload = wh.verify(body, headers);

  if (payload.event_type !== 'message.received') {
    return new Response('OK', { status: 200 });
  }

  await handleInboundMessage(payload.message);
  return new Response('OK', { status: 200 });
}
```

## Candidate Lookup

Primary: Airtable filterByFormula `{AgentMail Thread ID} = "{thread_id}"`
Fallback: `{Email} = "{from_}"`

## Loop Prevention (CRITICAL)

AgentMail has NO built-in loop detection. Must implement:
1. Check `from_` against our own inbox email — skip if it matches
2. Check if message has `in_reply_to` referencing our own recent message
3. Label threads as "auto-replied" — skip if already present

## Gotchas

- **1MB payload cap**: If exceeded, `text` and `html` are omitted. Fetch full message via API.
- **`extracted_text`**: AgentMail strips quoted history, gives only new content. Always prefer over `text`.
- **Svix retries**: Non-2xx triggers retries (5 times over ~8 hours). Use `event_id` for deduplication.
- **Vercel timeout**: Hobby 10s, Pro 60s. LLM call takes 3-8s. Tight on Hobby.
- **Cancel drips on reply**: Read thread labels for `follow-up:{draftId}`, delete each draft.

## Environment Variables Needed

```
AGENTMAIL_WEBHOOK_SECRET=whsec_xxx  # returned when creating webhook
```

## Dependencies

```bash
npm install svix
```

## Webhook Registration (one-time)

```bash
curl -X POST https://api.agentmail.to/v0/webhooks \
  -H "Authorization: Bearer $AGENTMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://x2-openrecruiter.vercel.app/api/agentmail-webhook",
    "event_types": ["message.received", "message.sent", "message.bounced"],
    "inbox_ids": ["carl.x2talent@agentmail.to"],
    "client_id": "openrecruiter-webhook"
  }'
```
Save the returned `secret` as `AGENTMAIL_WEBHOOK_SECRET`.
