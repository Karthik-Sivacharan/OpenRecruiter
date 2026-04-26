---
name: scoring-rubric
description: Use when scoring, rating, evaluating, or ranking candidates for a role. Covers fit scoring, candidate comparison, and assessment reasoning.
user-invocable: true
argument-hint: "[role context or candidate name]"
---

# Candidate Scoring Rubric

Score every candidate on a 1-10 scale using ALL available data. Never score on resume alone if GitHub/portfolio data exists.

## Scoring Dimensions (Weight by Role Type)

### Engineering Roles
| Dimension | Weight | What to Evaluate |
|-----------|--------|-----------------|
| Technical skill overlap | 30% | Skills match JD requirements. Exact matches > adjacent skills. |
| Experience depth | 25% | Years in domain, seniority progression, scope of past work. |
| Code quality (GitHub) | 20% | If Nia Tracer data exists: code organization, testing habits, documentation, commit quality. |
| Company quality | 15% | Caliber of past employers. FAANG/top-startup experience is signal, not requirement. |
| Location/logistics | 10% | Remote OK? Visa? Relocation needed? |

### Design Roles
| Dimension | Weight |
|-----------|--------|
| Portfolio quality | 35% |
| Tool/skill overlap | 25% |
| Experience depth | 20% |
| Company quality | 10% |
| Location/logistics | 10% |

## Score Definitions

| Score | Meaning | Action |
|-------|---------|--------|
| 9-10 | Exceptional match. All requirements met. Strong GitHub/portfolio signal. | Outreach immediately. |
| 7-8 | Strong match. Most requirements met. Some evidence of relevant work. | Outreach recommended. |
| 5-6 | Moderate match. Some requirements met. Worth considering if pipeline is thin. | Outreach if recruiter approves. |
| 3-4 | Weak match. Few requirements met. Missing critical skills. | Skip unless recruiter insists. |
| 1-2 | Not a match. Wrong domain, wrong level, or disqualifying gaps. | Do not outreach. |

## Scoring Rules

1. ALWAYS explain the score. One sentence per dimension.
2. If GitHub/portfolio exists but wasn't analyzed, flag it: "Score may increase with Nia Tracer analysis."
3. Never round up out of kindness. A 6 is a 6.
4. Compare against the JD, not against other candidates.
5. Use Claude Opus for scoring (switch model if on Sonnet).
