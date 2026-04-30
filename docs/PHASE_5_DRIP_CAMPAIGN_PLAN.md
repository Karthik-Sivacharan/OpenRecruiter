# Phase 5B: Drip Campaigns via AgentMail

> Date: 2026-04-29

## Overview

Scheduled follow-up emails using AgentMail's built-in `send_at` on drafts. **No Vercel Cron needed.** AgentMail handles all scheduling internally.

## Drip Sequence

| Day | Type | Content |
|-----|------|---------|
| 0 | Initial outreach | Personalized cold email (Phase 4C) |
| 3 | Gentle follow-up | Different angle, reference something new about the role |
| 7 | Value-add | Share something useful (team blog, company news, product demo) |
| 14 | Break-up | "Totally understand if timing isn't right" — graceful close |

## How It Works

### 1. After Initial Send, Create 3 Scheduled Drafts

```typescript
// Initial outreach sent, we have: messageId, threadId, sentAt

// Day 3
const day3 = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: `Re: ${originalSubject}`,
  text: day3Text,
  html: day3Html,
  sendAt: addDays(sentAt, 3).toISOString(), // ISO 8601: "2026-05-02T09:00:00Z"
  inReplyTo: originalMessageId,              // same thread
  labels: ["drip-day-3", `role-${roleSlug}`],
  clientId: `drip-3-${candidate.recordId}`,  // idempotent
});

// Day 7
const day7 = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: `Re: ${originalSubject}`,
  text: day7Text,
  html: day7Html,
  sendAt: addDays(sentAt, 7).toISOString(),
  inReplyTo: originalMessageId,
  labels: ["drip-day-7", `role-${roleSlug}`],
  clientId: `drip-7-${candidate.recordId}`,
});

// Day 14
const day14 = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: `Re: ${originalSubject}`,
  text: day14Text,
  html: day14Html,
  sendAt: addDays(sentAt, 14).toISOString(),
  inReplyTo: originalMessageId,
  labels: ["drip-day-14", `role-${roleSlug}`],
  clientId: `drip-14-${candidate.recordId}`,
});
```

### 2. Tag Thread with Draft IDs

```typescript
await client.inboxes.threads.update(INBOX_ID, threadId, {
  addLabels: [
    `follow-up:${day3.draftId}`,
    `follow-up:${day7.draftId}`,
    `follow-up:${day14.draftId}`,
  ],
});
```

### 3. AgentMail Auto-Sends on Schedule

Draft lifecycle: `scheduled` → `sending` → draft deleted, message created.
No action needed from us.

### 4. Cancel on Reply (in webhook handler)

```typescript
// When message.received fires:
const thread = await client.inboxes.threads.get(INBOX_ID, threadId);
const followUpLabels = thread.labels.filter(l => l.startsWith("follow-up:"));
const draftIds = followUpLabels.map(l => l.replace("follow-up:", ""));

for (const draftId of draftIds) {
  try {
    await client.inboxes.drafts.delete(INBOX_ID, draftId);
  } catch {
    // Draft may have already sent — that's fine
  }
}

// Clean up labels
await client.inboxes.threads.update(INBOX_ID, threadId, {
  removeLabels: followUpLabels,
  addLabels: ["replied"],
});
```

## Key Details

- **`inReplyTo`**: All 3 drips reference the ORIGINAL message ID (not each other). Keeps everything in one thread.
- **`sendAt`**: ISO 8601 UTC. To send 9am ET, use `14:00Z`.
- **`clientId`**: Makes creation idempotent. Safe to retry.
- **Draft deletion = cancellation**: Deleting a scheduled draft cancels the send.
- **After send**: Draft resource is deleted, message resource is created. Draft ID becomes invalid.

## Airtable Fields Needed

| Field | Type | Purpose |
|-------|------|---------|
| Drip Status | Select | Active / Cancelled (replied) / Cancelled (opted out) / Completed |
| Drip Day 3 Draft ID | Text | For reference/debugging |
| Drip Day 7 Draft ID | Text | For reference/debugging |
| Drip Day 14 Draft ID | Text | For reference/debugging |
| Last Drip Sent | Text | "day-3" / "day-7" / "day-14" |

## Data Flow

```
Send initial outreach
  → Store message_id, thread_id in Airtable
  → Create 3 scheduled drafts with send_at
  → Tag thread with follow-up:{draftId} labels
  → Store draft IDs in Airtable, Drip Status = "Active"
  |
  |--- Day 3: AgentMail auto-sends, draft deleted
  |--- Day 7: AgentMail auto-sends, draft deleted
  |--- Day 14: AgentMail auto-sends, draft deleted
  |     → If no reply after day 14: Drip Status = "Completed"
  |
  |--- At ANY point: candidate replies
        → Webhook fires
        → Delete remaining drafts (cancel future sends)
        → Drip Status = "Cancelled (replied)"
```

## Vercel Cron — Not Needed for Core Flow

Optional lightweight daily cron for:
- Drip completion detection (all 3 sent, no reply → mark "Completed")
- Failed send recovery (list drafts with `send_status: "failed"`)
- Metrics reporting

## Gotchas

- **Timezone**: Always use UTC. Calculate offset for local time delivery.
- **Race condition**: Candidate replies at exact moment a draft sends. Delete fails (404). Candidate gets one extra follow-up. Acceptable.
- **Free plan**: 100 emails/day. 33+ candidates × 3 drips = hits limit. Developer plan ($20/mo) removes daily cap.
- **System labels are read-only**: Can't add/remove `sent`, `received`, `scheduled`. Only custom labels.
