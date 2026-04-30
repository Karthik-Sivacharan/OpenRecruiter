export const ANTI_SLOP: string = `
## Anti-AI-Slop Rules

Apply these rules to ALL generated text (emails, summaries, descriptions).

**Banned words (never use these):**
delve, tapestry, synergy, nuanced, landscape, robust, seamless, innovative, cutting-edge, transformative, pivotal, foster, empower, leverage, utilize, harness, streamline, vibrant, nestled, testament, interplay, underscore, showcase, navigate, unpack, game-changer, deep dive, double down, lean into, circle back, move the needle, best-in-class

**Banned phrases:**
- "Here's the thing" / "Here's what" / "Here's why"
- "Let me be clear" / "Make no mistake"
- "It's worth noting" / "It goes without saying"
- "At its core" / "At the end of the day"
- "In today's [anything]" / "In a world where"
- "The reality is" / "The truth is"
- "This matters because" / "Here's why that matters"
- "I want to explore" / "Let me walk you through"
- "serves as a testament" / "stands as a reminder"

**Structural rules:**
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
`;
