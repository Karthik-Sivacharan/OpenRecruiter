# AgentMail Research for OpenRecruiter

> Research date: 2026-04-29
> Sources: docs.agentmail.to (llms-full.txt, individual pages), agentmail.to (pricing)

---

## 1. Overview

AgentMail is an API-first email platform built specifically for AI agents. Unlike transactional email services (SendGrid, Mailgun, Resend), it provides first-class support for Threads, Inboxes, Drafts, and Labels -- all the primitives needed for conversational email agents.

**Key differentiators:**
- Programmatic inbox creation (create thousands of inboxes per org)
- Built-in threading (replies automatically group into threads)
- Draft system with scheduled sending (`send_at` parameter)
- Webhook + WebSocket support for real-time inbound processing
- Labels for state management (campaigns, read/unread, custom tags)
- Custom domain support with SPF/DKIM/DMARC
- TypeScript and Python SDKs
- MCP server integration available

**Base API URL:** `https://api.agentmail.to/v0/`

**Default email domain:** `@agentmail.to`

---

## 2. Core API

### 2.1 Authentication

- API keys prefixed with `am_`
- Bearer token in Authorization header: `Authorization: Bearer am_xxx`
- Generate keys from console.agentmail.to or via API
- Supports fine-grained permissions (30 permission types) and scope-based isolation (org, pod, inbox)

### 2.2 Inboxes

**Create an inbox:**
```
POST /v0/inboxes
```
```json
{
  "username": "recruiter-agent",
  "domain": "yourdomain.com",
  "display_name": "OpenRecruiter",
  "client_id": "openrecruiter-main-inbox"
}
```
- `username` and `domain` are optional; omit for auto-generated `@agentmail.to` address
- `client_id` enables idempotent creation (safe retries, won't create duplicates)
- `display_name` sets the human-readable sender name

**Other operations:** `GET /v0/inboxes` (list), `GET /v0/inboxes/{inbox_id}` (get), `PATCH /v0/inboxes/{inbox_id}` (update), `DELETE /v0/inboxes/{inbox_id}` (delete)

**Inbox-scoped API keys:** Can create restricted API keys limited to a single inbox for least-privilege agent access.

### 2.3 Sending Messages

**Send a new message:**
```
POST /v0/inboxes/{inbox_id}/messages/send
```
```json
{
  "to": ["candidate@example.com"],
  "subject": "Exciting opportunity at Acme Corp",
  "text": "Plain text version...",
  "html": "<html><body><p>HTML version...</p></body></html>",
  "labels": ["outreach", "role-swe-senior"],
  "cc": [],
  "bcc": ["recruiter@company.com"],
  "attachments": [
    {
      "filename": "job-description.pdf",
      "content_type": "application/pdf",
      "content": "<base64-encoded-content>"
    }
  ]
}
```

**Response:**
```json
{
  "message_id": "msg_xxx",
  "thread_id": "thr_xxx"
}
```

**Key details:**
- Max 50 recipients combined across to/cc/bcc
- Always provide BOTH `text` and `html` for deliverability
- Can include `labels` array at send time
- Can `bcc` a human for oversight (human-in-the-loop)
- Attachments are base64 encoded

### 2.4 Replying to Messages

**Reply to a specific message (stays in same thread):**
```
POST /v0/inboxes/{inbox_id}/messages/{message_id}/reply
```
```json
{
  "text": "Thanks for your interest! Let me tell you more...",
  "html": "<p>Thanks for your interest! Let me tell you more...</p>",
  "labels": ["replied"]
}
```

**Response:**
```json
{
  "message_id": "msg_yyy",
  "thread_id": "thr_xxx"
}
```

**Also available:** `reply-all` and `forward` endpoints.

### 2.5 Receiving / Reading Messages

**List messages in an inbox:**
```
GET /v0/inboxes/{inbox_id}/messages?labels=unread&limit=50
```

**Get a specific message:**
```
GET /v0/inboxes/{inbox_id}/messages/{message_id}
```

**Critical fields for processing replies:**
- `extracted_text` -- new content only, quoted history stripped automatically
- `extracted_html` -- same but HTML version
- `from_` -- sender address
- `subject`, `text`, `html` -- full message content
- `in_reply_to` -- references the message being replied to
- `thread_id` -- conversation grouping
- `attachments` -- array of attachment metadata

**Note:** `text` and `preview` may be absent if the sender only sent HTML. Always check `html` as fallback.

### 2.6 Thread Management

**List threads for an inbox:**
```
GET /v0/inboxes/{inbox_id}/threads?labels=active-campaign
```

**List threads across entire organization (supervisor mode):**
```
GET /v0/threads
```

**Get a specific thread (includes messages):**
```
GET /v0/threads/{thread_id}
```

- Threads are created automatically when sending a new message
- Replies to existing messages automatically join the thread
- Thread objects include: `senders`, `recipients`, `message_count`, `labels`
- Can filter by `labels`, paginate with `limit` and `page_token`
- Org-wide thread listing enables dashboard/supervisor views

### 2.7 Labels

Labels are string-based tags on Messages and Threads. They enable:

**State management:**
```json
{ "add_labels": ["contacted", "drip-day-3"], "remove_labels": ["draft-ready"] }
```

**Campaign tracking:**
- `"outreach-swe-2026-q2"`
- `"warm-lead"`
- `"responded-positive"`

**Read/unread tracking:**
- Add `"read"`, remove `"unread"` after processing
- Filter with `labels=["unread"]` to find unprocessed messages

**Filtering:** All list endpoints (messages, threads, drafts) accept `labels` parameter.

**Update labels on a message:**
```
PATCH /v0/inboxes/{inbox_id}/messages/{message_id}
{
  "add_labels": ["read", "processed"],
  "remove_labels": ["unread"]
}
```

### 2.8 Attachments

**Sending:** Base64 encode file content, include `filename` and `content_type` in attachments array.

**Receiving:** Get attachment by ID:
```
GET /v0/inboxes/{inbox_id}/messages/{message_id}/attachments/{attachment_id}
GET /v0/inboxes/{inbox_id}/threads/{thread_id}/attachments/{attachment_id}
```

**Deliverability note:** Do NOT send images in first email -- triggers spam filters.

---

## 3. Drafts System (Critical for OpenRecruiter)

### 3.1 Draft Lifecycle

```
Create Draft --> [Human Review] --> Send Draft --> Becomes Message (Draft deleted)
                                --> Delete Draft (cancel)
```

**Create a draft:**
```
POST /v0/inboxes/{inbox_id}/drafts
```
```json
{
  "to": ["candidate@example.com"],
  "subject": "Senior SWE opportunity at Acme",
  "text": "Plain text...",
  "html": "<p>HTML version...</p>",
  "labels": ["draft-ready", "role-swe-senior"],
  "client_id": "draft-candidate-john-doe",
  "send_at": "2026-05-02T09:00:00Z"
}
```

**Response:** Full Draft object with `draft_id`, `send_status`, etc.

### 3.2 Scheduled Sending (send_at)

AgentMail has BUILT-IN scheduled sending. Pass ISO 8601 datetime to `send_at`:

- Draft automatically gets `"scheduled"` label
- `send_status` transitions: `scheduled` --> `sending` --> (message sent, draft deleted)
- If failed: `send_status` = `"failed"`, retry by updating `send_at`

**Cancel scheduled send:** Delete the draft
**Reschedule:** Update `send_at` with new timestamp

**List scheduled drafts:**
```
GET /v0/inboxes/{inbox_id}/drafts?labels=scheduled
```

### 3.3 Conditional Follow-ups Pattern

This is EXACTLY what we need for drip campaigns:

1. Send initial outreach, schedule follow-up draft:
```python
initial = client.inboxes.messages.send(inbox_id, to=[...], subject=..., text=...)
follow_up = client.inboxes.drafts.create(
    inbox_id,
    to=[...],
    subject="Re: ...",
    send_at="2026-05-05T09:00:00Z",  # 3 days later
    in_reply_to=initial.message_id
)
# Tag the thread so webhook can find and cancel the follow-up
client.inboxes.threads.update(
    inbox_id,
    initial.thread_id,
    add_labels=[f"follow-up:{follow_up.draft_id}"]
)
```

2. When candidate replies (webhook fires), cancel the scheduled follow-up:
```python
# In webhook handler:
# Parse thread labels to find follow-up draft IDs
# Delete those drafts to cancel scheduled sends
```

### 3.4 Organization-Wide Draft Management

```
GET /v0/drafts
```
List ALL drafts across all inboxes -- enables a centralized review dashboard where the recruiter can approve/reject agent-drafted emails.

---

## 4. Webhooks (Inbound Email Handling)

### 4.1 Setup

**Create webhook:**
```
POST /v0/webhooks
```
```json
{
  "url": "https://openrecruiter.vercel.app/api/agentmail-webhook",
  "event_types": ["message.received", "message.bounced", "message.complained"],
  "inbox_ids": ["inbox_main_id"],
  "client_id": "openrecruiter-webhook"
}
```

**Response includes `secret`** -- a signing secret (prefixed `whsec_`) for verifying webhook authenticity.

**Can filter by:** `inbox_ids` (max 10), `pod_ids` (max 10), specific `event_types`.

### 4.2 Supported Events

| Event | Description |
|-------|-------------|
| `message.received` | New email received in inbox |
| `message.received.spam` | Spam-classified message (requires `label_spam_read` permission) |
| `message.received.blocked` | Message matched block list |
| `message.sent` | Message successfully sent |
| `message.delivered` | Delivery confirmed by recipient server |
| `message.bounced` | Delivery failed (includes `bounce.type`: "Permanent" or "Temporary") |
| `message.complained` | Recipient marked as spam |
| `message.rejected` | Pre-send rejection (validation/policy) |
| `domain.verified` | Custom domain verified |

**Default behavior:** Spam and blocked events are EXCLUDED by default. Must explicitly include them.

### 4.3 Webhook Payload Format

```json
{
  "event_type": "message.received",
  "event_id": "evt_abc123",
  "message": {
    "from_": "candidate@gmail.com",
    "organization_id": "org_xxx",
    "inbox_id": "inbox_xxx",
    "thread_id": "thr_xxx",
    "message_id": "msg_xxx",
    "to": ["agent@agentmail.to"],
    "cc": [],
    "bcc": [],
    "subject": "Re: Senior SWE opportunity",
    "preview": "Thanks for reaching out...",
    "text": "Full plain text body...",
    "html": "<html>...</html>",
    "labels": [],
    "attachments": [],
    "in_reply_to": "msg_original",
    "references": ["msg_original"],
    "sort_key": "...",
    "created_at": "2026-04-29T...",
    "updated_at": "2026-04-29T..."
  }
}
```

**1 MB payload cap:** If exceeded, `text` and `html` fields are omitted (inline base64 images can cause this). All metadata remains. Fetch full message via API using `inbox_id` + `message_id`.

### 4.4 Webhook Verification (Security)

AgentMail uses **Svix** for webhook delivery with cryptographic signatures.

**Verification headers on every request:**
- `svix-id` -- unique message ID (consistent across retries)
- `svix-timestamp` -- Unix timestamp
- `svix-signature` -- `v1,<base64>` format

**Verify with Svix library:**
```typescript
import { Webhook } from 'svix';
const wh = new Webhook(signingSecret);  // signingSecret starts with "whsec_"
const verifiedPayload = wh.verify(rawBody, headers);
```

**CRITICAL:** Use raw request body, NOT parsed JSON. In Express/Next.js, use `req.text()` or equivalent.

### 4.5 Best Practices

- Return HTTP 200 immediately, process asynchronously
- Use `event_id` for deduplication
- Implement exponential backoff on failures
- For production: deploy to stable HTTPS URL (not ngrok)

---

## 5. WebSockets (Alternative to Webhooks)

WebSockets provide real-time event streaming WITHOUT needing a public URL. Good for development, but webhooks are better for serverless (Vercel).

**TypeScript connection:**
```typescript
const socket = await client.websockets.connect();
socket.sendSubscribe({
  type: "subscribe",
  inboxIds: ["agent@agentmail.to"],
  eventTypes: ["message.received"]
});
socket.on("message", (event) => {
  if (event.type === "message_received") {
    console.log(event.message.subject);
  }
});
```

Same events as webhooks. Not suitable for Vercel serverless -- use webhooks instead.

---

## 6. Custom Domains & Deliverability

### 6.1 Custom Domain Setup (3 Steps)

**Step 1: Create domain via API:**
```
POST /v0/domains
```
```json
{
  "domain": "outreach.company.com",
  "client_id": "domain-outreach"
}
```
Response includes `records` array with required DNS entries.

**Step 2: Add DNS records:**
- SPF record (TXT)
- DKIM record (TXT) -- note: AWS Route 53 has 255-char limit per string, split DKIM into two quoted strings with NO space: `"part1""part2"`
- DMARC record (TXT) -- defaults to `p=reject`, can relax to `p=none` or `p=quarantine`
- MX record

Can bulk-import via zone file download (Cloudflare, Route 53 support this).

**Step 3: Verify domain:**
```
POST /v0/domains/{domain_id}/verify
```
Status progression: Not Started --> Pending --> Verifying --> Verified (or Invalid/Failed)

DNS propagation: minutes to 48 hours.

### 6.2 Domain Health Monitoring

- Check domain status via `GET /v0/domains/{domain_id}`
- Watch for status changes from `verified` to `missing` (DNS removed)
- `feedback_enabled` (default true) forwards bounce/complaint notifications

### 6.3 Deliverability Best Practices

**Domain warming schedule (30 days):**

| Period | Daily Volume | Focus |
|--------|-------------|-------|
| Days 1-3 | 10-20 | Most engaged recipients |
| Days 4-7 | 50-100 | Known, verified addresses |
| Days 8-14 | 200-500 | Broader audience, monitor bounces |
| Days 15-21 | 500-1,000 | Scale while tracking complaints |
| Days 22-30 | 1,000-5,000 | Approaching full capacity |
| Day 30+ | Full volume | Maintain healthy metrics |

**Stop if:** Bounce rate > 5% or spam complaint spike.

**Health targets:**
- Bounce rate: under 2%
- Spam complaint rate: under 0.1%

**Content rules for deliverability:**
- Always send both `text` and `html`
- Avoid spammy words: "FREE", "ACT NOW", "URGENT"
- No excessive links or exclamation marks
- No images in first email (including open-trackers)
- Personalize with recipient name + contextual data
- Send initial outreach without links; add CTAs only after reply
- Write conversationally, not marketing-speak

**Sender diversification:**
- Distribute volume across multiple inboxes (100 emails from 100 inboxes > 10,000 from 1)
- Use multiple custom domains to isolate reputation
- Subdomain isolation: `billing.company.com` vs `outreach.company.com`

### 6.4 Default Domain

`@agentmail.to` -- shared reputation, fine for development but NOT for production cold outreach. Always use custom domains in production.

### 6.5 SPF Record Conflicts

Only ONE SPF record per domain allowed. Merge services:
```
v=spf1 include:_spf.google.com include:spf.agentmail.to ~all
```

---

## 7. Pricing & Limits

### 7.1 Plans

| Feature | Free | Developer ($20/mo) | Startup ($200/mo) | Enterprise (Custom) |
|---------|------|--------------------|--------------------|---------------------|
| Inboxes | 3 | 10 | 150 | Custom |
| Emails/month | 3,000 | 10,000 | 150,000 | Custom |
| Emails/day | 100 | Unlimited | Unlimited | Unlimited |
| Storage | 3 GB | 10 GB | 150 GB | Custom |
| Custom domains | 0 | 10 | 150 | Custom |
| Pods | 2 | 2 | 10 | Custom |
| Webhook endpoints | 2 | 2 | 10 | Custom |
| Team members | 2 | 2 | 10 | Custom |
| Dedicated IPs | No | No | Yes | Yes |
| SOC 2 | No | No | Yes | Yes |
| Email support | No | Yes | Yes | Yes |
| Slack support | No | No | Yes | Yes |
| White-label | No | No | No | Yes |
| EU region | No | No | No | Yes |

**No credit card required for Free tier.**

**Startup offer:** Early-stage startups get a free month on Startup tier (apply).

### 7.2 Rate Limits

- All API endpoints rate-limited per API key
- 429 responses include `Retry-After` header
- Implement exponential backoff
- Use `client_id` for idempotent retries
- Specific requests/second limits not documented publicly -- contact support for details

### 7.3 OpenRecruiter Plan Recommendation

For MVP/early stage: **Developer plan ($20/mo)**
- 10 inboxes (enough: 1 per recruiter or per role)
- 10,000 emails/month (plenty for ~100 candidates/month with drip sequences)
- Custom domains (essential for deliverability)
- Unlimited daily sends

For scaling: **Startup plan ($200/mo)**
- 150 inboxes (multi-domain rotation)
- 150,000 emails/month
- Dedicated IPs for reputation control
- 10 webhook endpoints

---

## 8. Lists (Allow/Block)

Six types of lists for controlling email flow:

| Direction | Allow | Block |
|-----------|-------|-------|
| Send | Only send TO these addresses/domains | Never send TO these |
| Receive | Only accept FROM these | Block FROM these |
| Reply | Only reply TO these | Never reply TO these |

**Reply lists** check `In-Reply-To` header; replies bypass receive lists entirely.

**Scope hierarchy:** Organization --> Pod --> Inbox (most specific wins)

**Entries:** Full email addresses OR entire domains.

**Use case for OpenRecruiter:** If a candidate says "stop" or "unsubscribe", add their address to the inbox's send block list to prevent future emails.

---

## 9. Permissions System

30 fine-grained permissions available for API keys:

- `message_send`, `message_read`, `message_update`
- `draft_read`, `draft_create`, `draft_update`, `draft_delete`, `draft_send`
- `thread_read`, `thread_delete`
- `inbox_read`, `inbox_create`, `inbox_update`, `inbox_delete`
- `webhook_read`, `webhook_create`, `webhook_update`, `webhook_delete`
- `domain_read`, `domain_create`, `domain_update`, `domain_delete`
- `label_spam_read`, `label_blocked_read`, `label_trash_read`
- `list_entry_read`, `list_entry_create`, `list_entry_delete`
- `metrics_read`
- `api_key_read`, `api_key_create`, `api_key_delete`
- `pod_read`, `pod_create`, `pod_delete`

**Whitelist model:** No permissions field = full access. When present, only `true` permissions are active.

**Privilege escalation protection:** A restricted key cannot create a child key with more permissions.

---

## 10. TypeScript SDK

**Install:**
```bash
npm install agentmail
```

**Initialize:**
```typescript
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({
  apiKey: process.env.AGENTMAIL_API_KEY  // am_xxx
});
```

**Key methods:**
```typescript
// Inboxes
client.inboxes.create({ username, domain, displayName, clientId })
client.inboxes.get(inboxId)
client.inboxes.list()
client.inboxes.update(inboxId, { displayName })
client.inboxes.delete(inboxId)

// Messages
client.inboxes.messages.send(inboxId, { to, subject, text, html, labels, attachments })
client.inboxes.messages.list(inboxId, { labels, limit })
client.inboxes.messages.get(inboxId, messageId)
client.inboxes.messages.reply(inboxId, messageId, { text, html, labels })
client.inboxes.messages.replyAll(inboxId, messageId, { text, html })
client.inboxes.messages.forward(inboxId, messageId, { to, text })
client.inboxes.messages.update(inboxId, messageId, { addLabels, removeLabels })
client.inboxes.messages.getAttachment(inboxId, messageId, attachmentId)

// Threads
client.inboxes.threads.list(inboxId, { labels, limit })
client.inboxes.threads.get(inboxId, threadId)
client.inboxes.threads.update(inboxId, threadId, { addLabels, removeLabels })
client.threads.list()  // org-wide
client.threads.get(threadId)  // org-wide

// Drafts
client.inboxes.drafts.create(inboxId, { to, subject, text, html, sendAt, inReplyTo, clientId, labels })
client.inboxes.drafts.get(inboxId, draftId)
client.inboxes.drafts.list(inboxId, { labels })
client.inboxes.drafts.update(inboxId, draftId, { sendAt, ... })
client.inboxes.drafts.send(inboxId, draftId)  // converts to message
client.inboxes.drafts.delete(inboxId, draftId)  // cancel
client.drafts.list()  // org-wide

// Webhooks
client.webhooks.create({ url, eventTypes, inboxIds, clientId })
client.webhooks.get(webhookId)
client.webhooks.list()
client.webhooks.update(webhookId, { url, eventTypes })
client.webhooks.delete(webhookId)

// Domains
client.domains.create({ domain, clientId })
client.domains.get(domainId)
client.domains.list()
client.domains.verify(domainId)
client.domains.delete(domainId)
client.domains.getZoneFile(domainId)

// Labels (via update)
client.inboxes.messages.update(inboxId, messageId, { addLabels: [...], removeLabels: [...] })
client.inboxes.threads.update(inboxId, threadId, { addLabels: [...], removeLabels: [...] })

// Lists
client.inboxes.lists.create(inboxId, { direction, type, address })
client.inboxes.lists.list(inboxId)
client.inboxes.lists.delete(inboxId, listEntryId)

// WebSockets
const socket = await client.websockets.connect()
socket.sendSubscribe({ type: "subscribe", inboxIds: [...], eventTypes: [...] })
socket.on("message", handler)
```

---

## 11. Integration Plan for OpenRecruiter

### 11.1 Phase 4: Send Outreach

**Flow:**
1. During Phase 3, create drafts (NOT send) for each scored candidate
2. Store `draft_id` in Airtable row
3. Recruiter reviews in Airtable, says "send all" or picks specific candidates
4. For each approved candidate: `client.inboxes.drafts.send(inboxId, draftId)`
5. Store returned `message_id` and `thread_id` in Airtable
6. Update label: add `"contacted"`, update Airtable stage

**Draft creation during scoring phase:**
```typescript
const draft = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: draftSubject,
  text: draftTextBody,
  html: draftHtmlBody,
  labels: ["draft-ready", `role-${roleSlug}`],
  clientId: `draft-${candidate.apolloId}`  // idempotent
});
// Store draft.draftId in Airtable
```

### 11.2 Phase 5: Drip Campaigns

**We do NOT need Vercel Cron for drip timing.** AgentMail has built-in `send_at` scheduling.

**Better approach using AgentMail's conditional follow-up pattern:**

1. When initial outreach is sent, immediately create scheduled follow-up drafts:
```typescript
// Day 3: gentle bump
const day3Draft = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: `Re: ${originalSubject}`,
  text: day3Text,
  html: day3Html,
  sendAt: addDays(sentAt, 3).toISOString(),
  inReplyTo: originalMessageId,  // keeps it in same thread
  labels: ["drip-day-3", `role-${roleSlug}`],
  clientId: `drip-3-${candidate.apolloId}`
});

// Day 7: value-add
const day7Draft = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: `Re: ${originalSubject}`,
  text: day7Text,
  html: day7Html,
  sendAt: addDays(sentAt, 7).toISOString(),
  inReplyTo: originalMessageId,
  labels: ["drip-day-7", `role-${roleSlug}`],
  clientId: `drip-7-${candidate.apolloId}`
});

// Day 14: break-up
const day14Draft = await client.inboxes.drafts.create(INBOX_ID, {
  to: [candidate.email],
  subject: `Re: ${originalSubject}`,
  text: day14Text,
  html: day14Html,
  sendAt: addDays(sentAt, 14).toISOString(),
  inReplyTo: originalMessageId,
  labels: ["drip-day-14", `role-${roleSlug}`],
  clientId: `drip-14-${candidate.apolloId}`
});

// Tag thread with draft IDs so webhook can cancel them on reply
await client.inboxes.threads.update(INBOX_ID, threadId, {
  addLabels: [
    `follow-up:${day3Draft.draftId}`,
    `follow-up:${day7Draft.draftId}`,
    `follow-up:${day14Draft.draftId}`
  ]
});
```

2. Store all draft IDs in Airtable candidate row
3. When candidate replies, webhook handler cancels remaining drafts (see below)

### 11.3 Phase 6: Auto-Reply Webhook

**Webhook endpoint:** `/api/agentmail-webhook/route.ts`

**Handler flow:**
```
1. Receive POST with message.received event
2. Verify signature (Svix)
3. Extract: thread_id, message_id, from_, extracted_text, subject
4. Look up candidate in Airtable by thread_id
5. Read candidate context (profile, score, role details)
6. Check for stop/unsubscribe intent in extracted_text
   - If stop: add to block list, cancel drip drafts, update Airtable, reply confirming
7. Check for out-of-office pattern
   - If OOO: label thread "ooo", don't auto-reply, maybe reschedule drip
8. Generate contextual reply using Sonnet 4.6
9. Reply in same thread: client.inboxes.messages.reply(inboxId, messageId, ...)
10. Cancel remaining drip drafts for this candidate:
    - Get thread labels, find "follow-up:draft_xxx" labels
    - Delete each draft: client.inboxes.drafts.delete(inboxId, draftId)
11. Update Airtable: stage -> "Replied", add reply content
12. Return 200 immediately (process async)
```

**Webhook verification in Next.js:**
```typescript
import { Webhook } from 'svix';

export async function POST(req: Request) {
  const body = await req.text();  // raw body, NOT json
  const headers = {
    'svix-id': req.headers.get('svix-id')!,
    'svix-timestamp': req.headers.get('svix-timestamp')!,
    'svix-signature': req.headers.get('svix-signature')!,
  };

  const wh = new Webhook(process.env.AGENTMAIL_WEBHOOK_SECRET!);
  const payload = wh.verify(body, headers);
  // ... process payload
}
```

### 11.4 Bounce & Complaint Handling

Subscribe to `message.bounced` and `message.complained` events:

**Bounce handler:**
- Check `bounce.type`: "Permanent" (hard bounce) vs "Temporary" (soft bounce)
- Hard bounce: Update Airtable status to "Bounced", cancel drip drafts
- Soft bounce: Retry later or flag for review

**Complaint handler:**
- Update Airtable status to "Complained"
- Add candidate email to send block list
- Cancel all drip drafts
- Never email this person again

---

## 12. Guardrails

### 12.1 Unsubscribe / Stop Detection

AgentMail does NOT have built-in unsubscribe detection. We must implement:

```typescript
function detectOptOut(text: string): boolean {
  const patterns = [
    /\b(stop|unsubscribe|opt.?out|remove me|no more|don't contact|do not contact)\b/i
  ];
  return patterns.some(p => p.test(text));
}
```

On detection:
1. Reply confirming removal
2. Add to send block list: `client.inboxes.lists.create(inboxId, { direction: "send", type: "block", address: candidateEmail })`
3. Cancel all scheduled drip drafts
4. Update Airtable: stage -> "Declined"

### 12.2 Double-Send Prevention

Use `client_id` on ALL create operations:
- Draft creation: `client_id: "draft-{candidateId}"`
- Drip drafts: `client_id: "drip-{day}-{candidateId}"`
- Inbox creation: `client_id: "openrecruiter-inbox"`
- Webhook creation: `client_id: "openrecruiter-webhook"`

AgentMail returns existing resource instead of creating duplicate.

### 12.3 Warm-up Schedule for Custom Domains

Follow the 30-day ramp:
- Days 1-3: 10-20 emails/day
- Days 4-7: 50-100/day
- Days 8-14: 200-500/day
- Days 15-21: 500-1,000/day
- Days 22-30: 1,000-5,000/day

Monitor via `GET /v0/metrics/query` or console dashboard.

### 12.4 Reply Sentiment Detection

Not built into AgentMail. We handle this in our webhook handler using Sonnet 4.6:
- Positive reply (interested) -> flag for recruiter, update Airtable
- Negative reply (not interested) -> cancel drips, update Airtable
- Out-of-office -> label thread, potentially reschedule drips
- Question/clarification -> auto-reply with context from Airtable

### 12.5 Daily Send Limits

Free plan: 100/day hard cap. Developer plan: unlimited daily (10k monthly).
Enforce our own warm-up limits in code regardless of plan limits.

---

## 13. Environment Variables Needed

```env
AGENTMAIL_API_KEY=am_xxx
AGENTMAIL_WEBHOOK_SECRET=whsec_xxx
AGENTMAIL_INBOX_ID=inbox_xxx          # main outreach inbox
AGENTMAIL_DOMAIN=outreach.company.com  # custom domain (optional, for production)
```

---

## 14. NPM Dependencies

```bash
npm install agentmail svix
```

- `agentmail` -- TypeScript SDK
- `svix` -- webhook signature verification

---

## 15. Key Architecture Decisions

### Use Drafts + send_at instead of Vercel Cron for drip campaigns

**Before (planned):** Vercel Cron job checks Airtable for candidates needing follow-ups, generates email, sends.

**Better approach:** Create all drip drafts with `send_at` immediately after initial send. AgentMail handles the scheduling. Cancel drafts when candidate replies. No cron job needed.

**Benefits:**
- No Vercel Cron costs or configuration
- No state management for "when was last email sent"
- Built-in cancellation via draft deletion
- Thread labels link drafts to threads for easy cleanup
- AgentMail handles retry on failure

**One exception:** We may still want a daily Vercel Cron to:
- Check for stale threads with no response
- Generate metrics/reports
- Clean up orphaned drafts

### Use Labels extensively for state management

Instead of tracking state only in Airtable, mirror state in AgentMail labels:
- `"draft-ready"` -- awaiting recruiter approval
- `"contacted"` -- initial outreach sent
- `"drip-day-3"`, `"drip-day-7"`, `"drip-day-14"` -- drip sequence stage
- `"replied"` -- candidate responded
- `"positive"`, `"negative"`, `"ooo"` -- reply sentiment
- `"declined"` -- candidate opted out
- `"bounced"` -- email bounced
- Campaign labels: `"role-swe-senior-acme-2026"`

### Single inbox vs multiple inboxes

For MVP: **single inbox** with recruiter's custom domain. All outreach from one address.

For scale: **multiple inboxes** across multiple domains for sender diversification and deliverability. Rotate sending across inboxes.

---

## 16. API Reference Quick Links

| Resource | Endpoint Pattern |
|----------|-----------------|
| Inboxes | `GET/POST /v0/inboxes`, `GET/PATCH/DELETE /v0/inboxes/{id}` |
| Messages | `POST /v0/inboxes/{id}/messages/send`, `GET /v0/inboxes/{id}/messages` |
| Reply | `POST /v0/inboxes/{id}/messages/{msg_id}/reply` |
| Threads | `GET /v0/inboxes/{id}/threads`, `GET /v0/threads` (org-wide) |
| Drafts | `POST /v0/inboxes/{id}/drafts`, `POST /v0/inboxes/{id}/drafts/{id}/send` |
| Webhooks | `POST /v0/webhooks`, `GET /v0/webhooks` |
| Domains | `POST /v0/domains`, `POST /v0/domains/{id}/verify` |
| Lists | `POST /v0/inboxes/{id}/lists`, `GET /v0/inboxes/{id}/lists` |
| Metrics | `GET /v0/metrics/query` |

**Full OpenAPI spec:** https://docs.agentmail.to/openapi.json

---

## 17. Open Questions / To Investigate

1. **Tracking opens/clicks:** Not mentioned in docs. AgentMail explicitly says NOT to include images or links in first email for deliverability. May not support open/click tracking. Probably intentional -- tracking pixels hurt deliverability for cold outreach.

2. **Email warmup service:** AgentMail provides guidance but no built-in warmup automation. We need to implement our own volume ramp in code or use a third-party warmup service.

3. **Rate limit specifics:** Per-key requests/second not documented publicly. Need to test or contact support.

4. **Attachment size limits:** Not documented. Test with realistic file sizes.

5. **IMAP/SMTP access:** Available but not needed for our use case (we use the API exclusively).

6. **MCP server:** AgentMail has an MCP integration. Could potentially use this instead of REST API for tool calling, but REST gives us more control.

7. **Startup tier free month:** Apply as early-stage startup for free Startup tier month.
