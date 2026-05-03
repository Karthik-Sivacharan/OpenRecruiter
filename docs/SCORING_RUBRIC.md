# Scoring Rubric

> This is a human-readable copy of the rubric sent to Opus for candidate scoring.
> The source of truth is `src/lib/prompts/scoring-rubric.ts`.

## Core Principle

Score fit for THIS role, not general career impressiveness. A VP of Design at Google is a 5 if the JD asks for B2B SaaS startup experience and they have none. An impressive resume that doesn't match what the JD asks for is not a strong fit.

## Scoring Process

### Step 1: Extract JD Requirements

Before scoring, mentally extract the key requirements from the job description:
- Required skills and tools
- Required experience type and depth (domain, seniority, years)
- Required environment fit (startup vs enterprise, team size, B2B vs B2C, industry)
- Specific responsibilities they must be able to do on day one
- Nice-to-haves vs must-haves (the JD usually signals this)

### Step 2: Check Each Requirement Against the Candidate

For each JD requirement, check whether the candidate has direct evidence, adjacent evidence, or no evidence. Direct evidence (did this exact thing) is worth far more than adjacent evidence (did something similar).

### Step 3: Score Using Dimensions

## Core Dimensions (weighted by role type)

| Dimension | Engineering | Design | PM/Other |
|-----------|:-:|:-:|:-:|
| JD requirement match | 35% | 35% | 35% |
| Experience depth | 25% | 15% | 15% |
| Code quality / Portfolio | 15% | 20% | - |
| Domain expertise | - | - | 25% |
| Environment fit | 15% | 20% | 15% |
| Logistics | 10% | 10% | 10% |

### JD Requirement Match (35%)

Go through the JD's key requirements one by one. How many does this candidate directly satisfy with evidence? A candidate who checks 8/10 JD requirements scores high. A candidate who checks 3/10 scores low, regardless of how impressive their background is.

### Environment Fit (15-20%)

Has the candidate worked in a similar environment to this role?
- **Stage:** startup vs growth vs enterprise
- **Market:** B2B vs B2C, SMB vs enterprise customers
- **Team size:** building a team vs joining an established org
- **Pace:** fast-moving product team vs slow-moving corporate

If the candidate has ONLY worked at large enterprises and the role is at an early-stage startup, this is a significant gap (score 3-4 on this dimension).

### Experience Depth (15-25%)

Years in the *relevant* domain, seniority progression, scope of past work. "Relevant" means relevant to the JD - 20 years of print design is not depth for a SaaS product design role.

### Portfolio/Code Quality (15-20%)

Evidence of craft quality in the domain the JD cares about. If missing, estimate from other signals but note lower confidence.

### Logistics (10%)

Location, remote compatibility, timezone, work authorization.

## Additional Factors for INBOUND Candidates

If the candidate applied and provided self-reported data:

- **Salary alignment:** >30% gap from JD range is a yellow flag. No data = skip.
- **Work authorization:** Mismatch when JD requires it = hard blocker, cap score at 3.
- **Role interest alignment:** Misalignment suggests applying broadly.

Inbound self-selection is a modest positive signal but don't inflate the score for intent alone.

## Handling Missing Data

- Missing portfolio/GitHub: note as gap, estimate from other signals, don't assign 0
- Self-Reported vs Verified conflicts: flag the discrepancy
- Entirely unrelated domain: substantive gap, not just "missing data"

## Score Definitions

| Score | Meaning |
|-------|---------|
| 9-10 | Exceptional. Matches nearly all JD requirements with direct evidence. Relevant environment experience. Would succeed on day one. Reserve 10 for near-perfect. |
| 7-8 | Strong. Matches most JD requirements. May have gaps in environment fit or 1-2 key requirements. |
| 5-6 | Moderate. Some requirements met but notable gaps - wrong domain, missing key skills, or environment mismatch. |
| 3-4 | Weak. Few requirements met. Impressive career but wrong fit for this specific role. |
| 1-2 | Not a match. Wrong domain, wrong level, or hard blockers. |

## Data Sent to Opus

The candidate profile is structured into labeled sections before sending:

| Section | Source | What's Included |
|---------|--------|----------------|
| Candidate Source | Derived (has Intake Notes or Resume = INBOUND) | INBOUND or OUTBOUND tag |
| Verified Profile Data | Apollo + EnrichLayer | Title, company, location, skills, education, certifications, summary, deduplicated work history |
| Self-Reported Data | Intake form (parsed) | Salary range, work auth, years of exp, work preference, employment type, roles interested, bio |
| Web Presence | Apollo + EnrichLayer + Nia | LinkedIn, GitHub, personal website, portfolio analysis |
| Missing Data | Derived | Explicit NOT PROVIDED markers for GitHub, portfolio |
| Resume | Airtable attachment | PDF sent as file, DOCX converted to text via mammoth |

Employment history is deduplicated: if the same role appears in both Apollo and EnrichLayer, the EnrichLayer version (with descriptions) is kept.

Intake Notes are parsed from a free-text blob into structured fields using known label matching (e.g. "Salary Range:", "Work Authorization (US):").
