---
name: outreach-style
description: Use when drafting outreach emails, cold emails, candidate emails, or personalized messages. Covers email writing, tone, and personalization.
user-invocable: true
argument-hint: "[candidate name or batch]"
---

# Outreach Email Style Guide

## Structure (Max 150 Words)

1. **Hook (1 sentence):** Reference something SPECIFIC to this candidate. A GitHub project, a blog post, a talk, a specific role at a specific company. Never generic.
2. **Role pitch (2 sentences):** What the role is, why it's interesting, what makes the company worth their time.
3. **CTA (1 sentence):** Simple ask. "Open to a quick chat this week?" Not "Please find attached the job description for your review."

## Tone Rules

- Write like a smart friend who found something cool, not a recruiter filling a pipeline
- First name only, never "Dear" or "Mr./Ms."
- No corporate phrases: "exciting opportunity", "fast-paced environment", "passionate team"
- No flattery without specifics: "Your impressive background" is banned. "Your distributed training work at Datadog" is good.
- Short sentences. No semicolons. One idea per sentence.

## Personalization Sources (Use in This Order)

1. Nia Tracer analysis (specific projects, code quality observations)
2. GitHub repos (project names, languages, stars)
3. Portfolio/blog (specific articles, design work)
4. EnrichLayer profile (specific roles, companies, skills)
5. Apollo data (title, company) -- LAST RESORT, least personal

## Subject Lines

- Under 50 characters
- Specific, not clickbait
- Examples: "Your PyTorch distributed work", "Re: your blog on vector DBs", "ML eng role - saw your Datadog work"
- Never: "Exciting opportunity!", "Job opening", "Are you open to new roles?"

## Example

```
Subject: Your distributed training repo

Hey Jane,

Your distributed-pytorch-trainer repo caught my eye -- the custom gradient accumulation approach is clever, especially the memory optimization for large batch sizes.

We're building the ML infrastructure team at Eragon (YC W24, Series A). The role is hands-on distributed training systems -- exactly what you've been shipping at Datadog.

Open to a 15-min chat this week?
```
