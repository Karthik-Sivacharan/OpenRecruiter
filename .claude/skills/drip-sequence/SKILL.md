---
name: drip-sequence
description: Use when setting up drip campaigns, follow-up sequences, follow-up emails, or scheduling automated follow-ups for candidates who haven't replied.
user-invocable: true
argument-hint: "[role or candidate batch]"
---

# Drip Follow-Up Sequence

## Cadence

| Follow-Up | Timing | Purpose | Tone |
|-----------|--------|---------|------|
| #1 | Day 3 | Gentle bump, different angle | Casual, add new info |
| #2 | Day 7 | Value-add (team info, company news) | Helpful, no pressure |
| #3 | Day 14 | Break-up email | Respectful close |

## Follow-Up #1 (Day 3)

- Short (2-3 sentences max)
- Reference original email: "Following up on my note about [role]"
- Add ONE new piece of info not in the original (team size, tech stack detail, recent company news)
- Same thread (reply to original)

## Follow-Up #2 (Day 7)

- Different angle entirely
- Share something valuable: a relevant blog post, team culture detail, or interesting technical challenge they'd work on
- Still in same thread
- End with low-pressure CTA: "No worries if the timing isn't right"

## Follow-Up #3 (Day 14) -- Break-Up

- Acknowledge silence: "I know you're busy"
- One sentence on the role
- Close the loop: "I'll leave the door open -- feel free to reach out anytime"
- Ask for referral: "If you know anyone who might be interested, I'd appreciate the intro"
- This is the FINAL follow-up. Never send more than 3.

## Rules

- NEVER follow up if candidate has replied (check Attio status first)
- NEVER follow up if candidate unsubscribed or asked to stop
- Always reply in the same email thread (use thread_id)
- If candidate replies between follow-ups, cancel remaining drip
- Update Attio status after each follow-up: "Follow-up #1 sent", "Follow-up #2 sent", etc.
