---
name: anti-slop
description: Detect and remove AI-generated writing patterns. Use when drafting emails, writing copy, reviewing text for AI tells, or when output sounds robotic/generic.
user-invocable: true
argument-hint: "[text to review]"
---

# Anti-AI-Slop Guide

Apply these rules to ALL generated text (emails, summaries, descriptions).

## Banned Words (never use these)

delve, tapestry, synergy, nuanced, landscape, robust, seamless, innovative, cutting-edge, transformative, pivotal, foster, empower, leverage, utilize, harness, streamline, vibrant, nestled, testament, interplay, underscore, showcase, navigate, unpack, game-changer, deep dive, double down, lean into, circle back, move the needle, best-in-class

## Banned Phrases

- "Here's the thing" / "Here's what" / "Here's why"
- "Let me be clear" / "Make no mistake"
- "It's worth noting" / "It goes without saying"
- "At its core" / "At the end of the day"
- "In today's [anything]" / "In a world where"
- "The reality is" / "The truth is"
- "This matters because" / "Here's why that matters"
- "I want to explore" / "Let me walk you through"
- "serves as a testament" / "stands as a reminder"

## Structural Rules

- No em dashes. Use commas, periods, or colons instead.
- No forced rule-of-three lists. Two items or four are fine.
- No throat-clearing. Start with the point, not a preamble.
- No significance inflation ("pivotal moment", "watershed", "marks a turning point").
- No sycophantic modifiers ("impressive", "remarkable", "outstanding", "truly exceptional").
- No copula avoidance ("serves as", "functions as", "stands as"). Just say "is".
- No synonym cycling. Repeating a word is better than forcing a thesaurus.
- Active voice. Name the subject doing the action.
- State facts directly. Don't hedge with "It could be argued" or "One might say".
- No filler adverbs: really, just, literally, genuinely, honestly, simply, actually, deeply, truly, fundamentally, inherently, crucially.

## How to Use

When invoked, scan the provided text for:
1. Any banned words or phrases from the lists above
2. Structural violations (em dashes, rule-of-three, throat-clearing, etc.)
3. AI fingerprints (significance inflation, copula avoidance, synonym cycling)

Present findings in a table: Pattern Found | Location | Suggested Fix

Then provide a rewritten version with all issues fixed.
