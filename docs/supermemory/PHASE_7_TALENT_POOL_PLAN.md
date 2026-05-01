# Phase 7: Talent Pool / Candidate Memory

> This was the original planning doc. Superseded by PHASE_7_SUPERMEMORY_PLAN.md.
> Decision: Supermemory (not Mem0, not Graphiti) for the demo.
> See PHASE_7_SUPERMEMORY_PLAN.md for the current implementation plan.

## Vision

The agent remembers every candidate the recruiter has ever touched. When a new role comes in, it proactively surfaces past candidates who match. When the recruiter asks "who did I talk to who knows X?", it answers instantly.

## Demo Scenarios

1. **Proactive Candidate Surfacing** - New JD comes in, agent says "I found 3 candidates from past searches who match"
2. **Recruiter Asks About Their Pool** - "Do I have anyone who knows Python and ML?" - instant answer
3. **Recruiter Notes Remembered** - "Sarah wants remote, exploring AI startups" remembered weeks later
4. **Cross-Role Relevance** - "James scored 6/10 for Notion (wrong fit) but perfect for this Ramp role"
5. **Interested But Not Placed** - "Maria replied positively but timing was off, said Q2 works better"

## Tools Evaluated

| Tool | Outcome |
|------|---------|
| Graphiti + Neo4j | Too much infra for demo (Python server + Neo4j). Good for later. |
| Mem0 | Graph memory only on $249/mo Pro. Free tier only has 1K searches/mo. |
| pgvector on Neon | Just vector similarity, no memory extraction or graph. |
| **Supermemory** | **Selected.** Graph memory on free tier, native AI SDK integration, 10K searches/mo. |

## Future: Graphiti Upgrade

When we have hundreds of candidates and need:
- Temporal queries ("who changed jobs recently?")
- Rich graph traversal ("candidates at YC companies")
- Multi-hop relationships

Add Graphiti + Neo4j on top of Supermemory data. Not needed for the demo.
