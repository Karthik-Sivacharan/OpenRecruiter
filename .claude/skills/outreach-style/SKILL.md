---
name: outreach-style
description: Use when drafting outreach emails, cold emails, candidate emails, or personalized messages. Covers email writing, tone, and personalization.
user-invocable: true
argument-hint: "[candidate name or batch]"
---

# Outreach Email Style Guide

## The Golden Rule

Every email must do THREE things:
1. Show you know the CANDIDATE (specific work, not generic flattery)
2. Show you know the ROLE (specific details from the JD, not generic pitch)
3. Connect the two (why THIS person would be great for THIS role)

If any of these is missing, the email is not ready.

## Structure (75-125 words, not counting signature)

The recruiter's name, intro, preferred CTA, and signature are provided by the system. Use them exactly.

1. **Subject line:** "Role at Company" format, normal capitalization. E.g. "Senior Product Designer at ComfyUI". If investor info is in the JD, can add: "Senior Product Designer at ComfyUI (a16z backed)".
2. **Intro (1 sentence):** "Hi {first_name}, I'm {recruiter_name}, {recruiter_intro}." This is provided by the system prompt.
3. **Hook (1-2 sentences):** Reference something SPECIFIC about this candidate's work FROM THEIR DATA. Then connect it to why it caught your eye for THIS role.
4. **Role pitch (2-3 sentences):** Name the ACTUAL HIRING COMPANY (never the recruiting agency). Include 1 compelling detail from the JD (product, users, valuation, funding stage, team, mission). Include comp range if available in the JD.
5. **Connection (1 sentence):** Link their experience to a specific JD requirement.
6. **CTA (1 sentence):** Use the recruiter's preferred CTA from the system prompt.
7. **Signature:** Auto-appended by the agentmailCreateDrafts tool. Do NOT include it in the draft body.

## Hiring Context Rules (CRITICAL)

- ALWAYS use the hiring company name from the JD, NEVER use the recruiting agency name
- ALWAYS include at least 1 specific detail about the company/product from the JD (notable users, valuation, funding, user count, what the product does)
- ALWAYS include comp range when it's available in the JD. This is the #1 driver of replies from candidates.
- ALWAYS connect the candidate's experience to a specific requirement from the JD
- NEVER write a generic pitch like "small team, greenfield, real ownership" without specifics from the JD

## Personalization Rules

- ONLY use information that EXISTS in the candidate's Airtable row. NEVER invent, guess, or hallucinate details about a candidate's work, projects, or background.
- If a candidate has rich data (portfolio, GitHub, employment history, summary), personalize using that data.
- If a candidate has THIN data (just title + company, no portfolio/GitHub/summary), do NOT fake personalization. Instead, lead with the ROLE as the hook and use their title/company as a light connection. A role-focused email with genuine info beats a candidate-focused email with made-up details.
- The personalized hook MUST connect to why this person fits the role. If you remove the hook and the email still makes sense, the personalization isn't working.
- Use "you/your" more than "I/we". Lead with their world, not yours.
- Never start more than one sentence with "I"

**Personalization sources (use ONLY data from the Airtable row, in order of impact):**
1. Personal Website / Portfolio URL (if present, reference their visible work)
2. GitHub URL (if present, reference repos or activity)
3. Employment History / EnrichLayer Experiences (specific career moves, companies, roles)
4. Summary (LinkedIn about section, if present)
5. Skills / Certifications (specific technical skills)
6. Title + Company (LAST RESORT, least personal, but never fabricate beyond this)

**When data is thin (no portfolio, no GitHub, no summary):**
Lead with the role instead. Example:
```
Hey Marcus,

ComfyUI is building the leading visual AI platform (4M+ users,
Netflix and OpenAI use it). They need a Senior Product Designer
to translate complex node-based AI tools into elegant creative
experiences. $150K-$300K + equity, on-site in SF.

Your background in product design at Unity caught my eye for this.

Interested?
```
This is honest — it references real data (title, company) without inventing specifics.

## Banned Words and Phrases (NEVER use these)

**Words:** delve, leverage, utilize, harness, streamline, robust, seamless, innovative, cutting-edge, transformative, pivotal, foster, empower, furthermore, moreover, notably, consequently, passionate, dynamic, thriving, vibrant, synergy

**Phrases:**
- "I hope this email finds you well" or any variant
- "I wanted to reach out" / "I'm reaching out" / "Reaching out because"
- "Exciting opportunity" / "exciting role"
- "Fast-paced environment" / "dynamic team"
- "Impressive background" / "impressive experience"
- "Passionate team" / "passionate about"
- "In today's..." anything
- "It's worth noting"
- "I came across your profile"
- "Leading provider" / "best-in-class"
- "We are hiring" without naming WHO is hiring

**Structural bans:**
- NO em dashes. Use commas or periods instead.
- No sentence over 20 words
- Use the candidate's first name exactly once (in the greeting)

## Tone and Voice

- Write like a smart colleague who noticed something relevant and is sharing it. Not a recruiter, not a salesperson.
- First name only, never "Dear" or "Mr./Ms."
- Use contractions (we're, you've, it's). Sentence fragments are fine.
- Include human touches: "genuinely impressed", "caught my eye", "I'd love to"
- Normal capitalization in the body. Lowercase is for subject lines only.
- Vary structure across candidates. 10 emails should each feel individually written, not stamped from a template.

## Subject Lines

- Format: "Role at Company" — normal capitalization, under 60 characters
- If investor info is known: "Role at Company (a16z backed)" or "Role at Company (YC W24)"
- Good: "Senior Product Designer at ComfyUI", "Staff ML Engineer at Eragon (YC W24)", "Search Infra Lead at Kova"
- Bad: "Exciting Opportunity!", "Job Opening", "Are you open to new roles?", "Quick question", "your gradient accumulation approach"

## Pre-Flight Checklist

Before finalizing ANY email, verify:
- [ ] Does it name the actual hiring company (not the recruiting agency)?
- [ ] Does it reference a specific detail about the company/product from the JD?
- [ ] Does it include comp range (if available in the JD)?
- [ ] Does the hook reference specific candidate work (not generic flattery)?
- [ ] Does it connect the candidate's experience to a JD requirement?
- [ ] Is there ONE clear interest-based CTA as a standalone line?
- [ ] Is it 75-125 words?
- [ ] Would you feel comfortable reading this aloud to the candidate?
- [ ] Does "you/your" appear more than "I/we"?

## Good Examples

Example A (Rich candidate data, 95 words):
```
Subject: Senior Product Designer at ComfyUI

Hi Lola, I'm Carl, a former product designer turned design recruiter.

Your trajectory from Cloud AI at Google to Gen AI design at Adobe shows you know how to make complex AI products feel intuitive. That is a rare skill.

ComfyUI is hiring a Senior Product Designer to own the UX for their visual AI workflow platform. 4M+ users including Netflix, OpenAI, and Ubisoft. Series B, $500M valuation. The core challenge: translating node-based AI tooling into elegant creative experiences. $150K-$300K + equity, on-site in SF.

Your experience designing AI-powered creative tools at Adobe and YouTube maps directly to what they need.

Open to a quick conversation if this sounds interesting?
```

Example B (Blog + JD connection, 90 words):
```
Subject: Staff Search Engineer at Kova (Sequoia backed)

Hi Marcus, I'm Carl, a former product designer turned design recruiter.

That comparison of pgvector vs Pinecone you wrote last month was the most practical take I've seen on the tradeoff.

Kova (Series B, Sequoia backed, $40M raised) is building search infrastructure that does exactly what you described: hybrid vector + keyword at scale. They process 2B queries/day for customers like Shopify and Notion. Looking for a Staff Engineer to lead the indexing team. $200-240k + equity.

Your writing shows deep fluency in exactly the problem they're solving.

Open to a quick conversation if this sounds interesting?
```

Example C (Thin data, role-led, 80 words):
```
Subject: Senior Product Designer at ComfyUI

Hi Minsun, I'm Carl, a former product designer turned design recruiter.

ComfyUI is the leading visual AI platform (4M+ users, Netflix and OpenAI use it, $500M valuation). They need a Senior Product Designer to translate complex node-based AI tools into elegant creative experiences. $150K-$300K + equity, on-site in SF.

Your product design experience at Unity caught my eye for this role.

Open to a quick conversation if this sounds interesting?
```
This is for candidates with thin data (just title + company). Lead with the role, keep the candidate reference honest and minimal.

## Bad Examples (DO NOT write like these)

Bad Example 1 (no JD context, wrong company, no intro):
```
Subject: Senior Product Designer role

Hey Lola,

Your work on design systems at Adobe stands out. Building cohesive
design language at that scale takes serious craft.

We are hiring a Senior Product Designer at X2 Talent. Small team,
greenfield product, real ownership over the entire design direction.

Interested?
```
Why this is bad: No recruiter intro. Uses the agency name "X2 Talent" instead of "ComfyUI". Zero JD details. "Small team, greenfield, real ownership" is generic. No comp range despite JD having $150K-$300K. No connection between candidate and role.

Bad Example 2 (AI slop):
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

Would you be open to a 15-minute chat this week to discuss further?
```
Why this is bad: No recruiter intro. Em dashes. "I hope this finds you well", "exciting opportunity", "impressive background", "fast-paced", "innovative", "transforming the landscape", "passionate", "dynamic team". Meeting request CTA. Zero JD details. Pure fluff.

Bad Example 3 (hallucinated personalization):
```
Subject: Senior Product Designer at ComfyUI

Hi Minsun, I'm Carl, a former product designer turned design recruiter.

Your stunning portfolio of 3D interface designs really caught my eye,
especially the AR prototyping work you showcased at Config last year.

ComfyUI is hiring...
```
Why this is bad: The candidate's Airtable row has no portfolio, no conference talks, no "3D interface designs". This is fabricated. If the data isn't there, don't invent it. Use the thin-data template instead.
