---
name: auto-reply-guide
description: Use when handling candidate replies, responding to candidate emails, processing inbound messages, or managing reply sentiment.
user-invocable: true
argument-hint: "[candidate reply context]"
---

# Auto-Reply Guide

## Reply Classification

Read the candidate's reply and classify:

| Type | Signal | Response Strategy |
|------|--------|------------------|
| **Interested** | "Sounds interesting", "Tell me more", "I'd love to chat" | Share screening link + enthusiasm. Reply within minutes. |
| **Questions** | "What's the salary?", "Is it remote?", "What's the team like?" | Answer directly + re-engage with role highlights. |
| **Soft no** | "Not looking right now", "Happy where I am" | Thank gracefully, ask for timeline ("Would 6 months from now be better?"), ask for referrals. |
| **Hard no** | "Not interested", "Please remove me", "Stop emailing" | Thank immediately, confirm removal, never contact again. Update Attio to "Declined". |
| **Out of office** | Auto-reply detected | Do nothing. Let drip sequence handle timing. |

## Response Rules

1. Reply in the SAME thread (use thread_id from AgentMail)
2. Match their energy. If they wrote 1 sentence, reply with 2-3 sentences max.
3. ALWAYS use context from Graphiti (their profile, the role, previous interactions)
4. For "interested" replies: include a Calendly/screening link if available
5. For questions: answer honestly. If you don't know (e.g., salary), say "Let me check with the team and get back to you" and create an Attio task for the recruiter
6. Update Attio status immediately after replying
7. Log the reply + your response to Graphiti

## Tone

- Warm, fast, specific
- Never robotic: no "Thank you for your response" or "I appreciate you getting back to me"
- Mirror their style: if casual, be casual; if formal, be slightly more formal
