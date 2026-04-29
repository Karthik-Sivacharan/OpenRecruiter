---
name: outreach-style
description: Use when drafting outreach emails, cold emails, candidate emails, or personalized messages. Covers email writing, tone, and personalization.
user-invocable: true
argument-hint: "[candidate name or batch]"
---

# Outreach Email Style Guide

## Structure (50-100 words, NEVER over 125)

1. **Hook (1 sentence):** Reference something SPECIFIC to this candidate. A GitHub repo, a blog post, a talk, a career move. Never generic.
2. **Role pitch (1-2 sentences):** What the role is, why the company is worth their time. Include comp range if the recruiter provided it.
3. **CTA (1 sentence):** Interest-based, NOT a meeting request. "Interested?" or "Worth a look?" or "Curious?" Data shows these convert 2x better than "Open to a chat?"

## Banned Words and Phrases (NEVER use these)

Words: delve, leverage, utilize, harness, streamline, robust, seamless, innovative, cutting-edge, transformative, pivotal, foster, empower, furthermore, moreover, notably, consequently, passionate, dynamic, thriving, vibrant

Phrases:
- "I hope this email finds you well" or any variant
- "I wanted to reach out" / "I'm reaching out" / "Reaching out because"
- "Exciting opportunity" / "exciting role"
- "Fast-paced environment" / "dynamic team"
- "Impressive background" / "impressive experience"
- "Passionate team" / "passionate about"
- "In today's..." anything
- "It's worth noting"
- "I came across your profile"

## Structural Rules

- NO em dashes. Use commas or periods instead.
- Never start more than one sentence with "I"
- No sentence over 20 words
- Use the candidate's first name exactly once (in the greeting)
- Use contractions (we're, you've, it's)
- Sentence fragments are fine
- Lowercase subject lines (feels casual, human)
- Vary structure across candidates. 10 emails should NOT look like the same template.

## Tone

- Write like a friend in tech who found something interesting, not a recruiter filling a pipeline
- First name only, never "Dear" or "Mr./Ms."
- No flattery without specifics. "Your distributed training work at Datadog" is good. "Your impressive background" is banned.
- Short sentences. One idea per sentence.
- Casual. You text in lowercase sometimes. You use contractions.
- If the recruiter provides a comp range, include it. Engineers say it's the #1 thing that makes them reply.

## Personalization Sources (Use in This Order)

1. GitHub repos (specific project names, what's clever about the code)
2. Portfolio/blog (specific articles, design work, talks)
3. Career trajectory (specific moves: "Going from infra at Stripe to platform at Datadog")
4. EnrichLayer profile (specific roles, skills, certifications)
5. Apollo data (title, company) -- LAST RESORT, least personal

## Subject Lines

- Under 50 characters, lowercase
- Reference their specific work
- Good: "your gradient accumulation approach", "your vector DB post", "ml platform at kova"
- Bad: "Exciting opportunity!", "Job opening", "Are you open to new roles?", "Quick question"

## Good Examples

Example A (GitHub-focused, 52 words):
```
Subject: your gradient accumulation approach

Hey Jane,

Saw your distributed-pytorch-trainer repo. The memory optimization for large batch sizes is really clever.

We're building the ML infra team at Eragon (YC W24, Series A). Distributed training systems, basically what you've been doing at Datadog. $190-230k + early equity.

Interested?
```

Example B (Blog-focused, 50 words):
```
Subject: your vector db post

Hey Marcus,

That comparison of pgvector vs Pinecone you wrote last month was the most practical take I've read on the tradeoff.

Building the search infra team at Kova. We're doing exactly what you described: hybrid vector + keyword at scale. $200-240k range.

Worth a look?
```

Example C (Career trajectory, no GitHub/blog, 43 words):
```
Subject: ml platform at kova

Hey Sarah,

Going from infra at Stripe to leading platform eng at Datadog is a trajectory we respect.

We're Kova, Series B, building ML platform tooling from scratch. Small team, greenfield, real ownership. Comp is $210-250k + equity.

Curious?
```

## Bad Example (DO NOT write like this)

```
Subject: Exciting ML Engineering Opportunity

Dear Jane,

I hope this email finds you well. I wanted to reach out because
I came across your impressive background in machine learning --
your experience at Datadog is truly remarkable.

We have an exciting opportunity at Eragon, a fast-paced,
innovative startup that is transforming the ML infrastructure
landscape. We're looking for a passionate engineer to join our
dynamic team.

Would you be open to a 15-minute chat this week to discuss
further?
```
Why this is bad: em dashes, "I hope this finds you well", "exciting opportunity", "impressive background", "fast-paced", "innovative", "transforming the landscape", "passionate", "dynamic team", meeting request CTA, 95 words of fluff with zero personalization.
