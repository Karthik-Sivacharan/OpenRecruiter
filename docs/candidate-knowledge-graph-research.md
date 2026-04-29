# Holistic Candidate Knowledge Graph — Research Report

> Research conducted April 28, 2026. Covers architecture, competitive landscape, AI memory systems, and CRM import strategies.

## The Big Insight: What Nobody Does Well

After researching the entire landscape, here's the gap no one fills:

**Connecting qualitative understanding of a candidate's actual work output + recruiter conversations + structured career data in a temporal knowledge graph that enables proactive, context-aware matching.**

- **Eightfold** has 1.6B profiles but they're structured records — no deep work analysis
- **Findem** has "3D data" (career trajectories over time) but it's a proprietary black box
- **Beamery** literally wrote a blog post saying "there hasn't ever been a single data source to track a person's career over time" — they see the gap but haven't solved it
- **Nobody** does: GitHub code analysis + portfolio review + recruiter conversation insights + temporal career tracking + proactive re-matching against new roles

OpenRecruiter already has Nia Tracer (deep code analysis), Graphiti (temporal knowledge graph), and Mem0 (memory). The pieces exist — they just need to be wired into a unified candidate intelligence layer.

---

## Architecture: Three-Layer Candidate Intelligence

### Layer 1: Graphiti (Temporal Knowledge Graph) — The Backbone

Graphiti is already the right tool. The shift is from **pipeline event log** to **persistent candidate knowledge graph**.

**How it works for candidates:**
- Every data source becomes an **episode** with `group_id = candidate_{id}`
- Graphiti's LLM pipeline auto-extracts entities and relationships
- **Bi-temporal model** tracks both event time ("Alice joined Stripe in June 2023") and ingestion time ("we learned about it in September 2023")
- When facts contradict (e.g., new job), old edges get `invalid_at` set — **nothing is ever deleted**

**Prescribed ontology (custom Pydantic types):**

| Entity Types | Edge Types |
|---|---|
| Candidate, Company, Skill, Role, Institution | WORKED_AT, HAS_SKILL, STUDIED_AT, APPLIED_FOR, CONTACTED_BY, KNOWS_PERSON |

**Career timeline example:**

| Event | Graphiti Representation |
|---|---|
| Alice joins Google as SWE, Jan 2020 | `Alice -[WORKS_AT {title: "SWE"}]-> Google`, `valid_at: 2020-01` |
| Promoted to Senior SWE, Mar 2022 | Old edge gets `invalid_at: 2022-03`. New edge with `valid_at: 2022-03` |
| Moves to Stripe, Jun 2023 | Google edge gets `invalid_at: 2023-06`. New Stripe edge created |

**Key academic validation:** The CAPER framework (KDD 2025) proved that career moves are inherently **ternary** — (person, position, company, time). Graphiti's temporal edges natively support this. NASA used a similar Neo4j graph with PageRank and community detection to discover "hidden skills."

### Layer 2: Mem0 (Qualitative Memory) — The Soul

Mem0 stores the unstructured, qualitative insights that don't fit in a graph schema.

**Per-candidate memory using `user_id`:**
- Each candidate gets a unique `user_id` in Mem0
- Recruiter observations: "values remote work", "seemed disengaged in current role"
- Conversation summaries: "enthusiastic about ML projects, asked about team size"
- Behavioral signals: "responded within 2 hours", "ghosted after second email"

**Key capabilities:**
- **Conflict resolution**: When new info contradicts old, Mem0 classifies as ADD/UPDATE/DELETE — old memories are marked invalid, not deleted
- **Semantic search**: Three parallel scoring passes (vector similarity + BM25 + entity matching) — so queries like "candidates who expressed interest in startups" actually work
- **80% token compression**: Background summarization keeps context manageable
- **Structured attributes** (new): Typed fields queryable alongside semantic content

### Layer 3: Attio/Airtable (Structured CRM) — The Interface

Stays as-is — the recruiter-facing view. But now it's backed by the knowledge graph, not just flat fields.

### How They Work Together

```
New data arrives (Apollo, recruiter note, email, GitHub)
  |
  v
Graphiti: Extract entities + relationships, update temporal graph
  |
  v
Mem0: Store qualitative insights per candidate
  |
  v
Attio: Update structured CRM fields
  |
  v
Vector index: Re-embed candidate profile for matching
```

When a recruiter asks about a candidate, the agent pulls from all three and synthesizes:

> "Sarah Chen is a Staff ML Engineer at Stripe (since 2023), previously at Google Brain. Deep expertise in recommendation systems and MLOps. In our last interaction, she expressed strong interest in early-stage startups and noted she values technical autonomy. Her GitHub shows increasing work on LLM fine-tuning over the past year, suggesting a shift toward generative AI. Recruiter noted she seemed actively exploring — responded within 2 hours to our initial outreach."

---

## Proactive Matching: The Killer Feature

When a new JD comes in, the system doesn't just search Apollo — it searches the **existing talent pool** first:

1. Parse JD into structured requirements + unstructured signals
2. Embed the full JD
3. **Hybrid query** across all three layers:
   - **Graphiti**: Cypher traversal for skill matching with `invalid_at IS NULL` (current facts only)
   - **Mem0**: Semantic search for qualitative matches ("looking for startups", "interested in ML")
   - **Vector similarity**: Candidate profile embeddings vs JD embedding
4. Score and rank
5. Alert recruiter: *"You have 3 candidates from past searches who match this role, and one of them just changed jobs"*

---

## Career Change Tracking: Keeping Profiles Fresh

### Data sources for job change detection

| Service | Mechanism | Best For |
|---|---|---|
| **Crustdata Watcher API** | Real-time webhooks on profile changes | Best real-time detection |
| **Apollo job change alerts** | Monitors saved contacts, auto-enriches | Already integrated |
| **People Data Labs** | 1.5B profiles, Watcher API with webhooks | Broadest coverage |
| **Netrows Radar** | LinkedIn profile monitoring (title, skills, headline) | LinkedIn-specific |

### Re-enrichment strategy (tiered)

- **Hot** (active pipeline): Monthly re-enrich
- **Warm** (talent pool): Quarterly
- **Cold** (historical): Only on demand or when job change signal detected

B2B contact data loses ~2.1% accuracy per month (~22.5% annually), so this isn't optional.

---

## Competitive Landscape

### Talent Intelligence Platforms

| Platform | Profiles | Key Feature | Limitation |
|---|---|---|---|
| **Eightfold AI** | 1.6B | Deep learning on career trajectories, predicts potential | Closed ecosystem, enterprise pricing ($50K+/yr) |
| **Findem** | Large | "3D data" — tracks people over time with attributes from GitHub, patents, publications | Proprietary black box, $500+/user/month |
| **SeekOut** | Large | Diversity filters, deep search across LinkedIn/GitHub/patents | More sourcing than intelligence |
| **Beamery** | N/A | Talent CRM with enrichment/dedup, TalentGPT | Acknowledges knowledge graph gap, hasn't solved it |
| **Loxo** | 1.2B | All-in-one ATS+CRM+sourcing+outreach | No deep analysis, no knowledge graph |
| **Phenom** | N/A | AI-powered talent experience, agentic orchestration | Enterprise only, broad not deep |

### What's Missing in the Market

1. **Deep work output analysis** — nobody does automated code review of GitHub repos or portfolio analysis as part of scoring
2. **Continuous monitoring with context** — job change tracking exists but is treated as a sales signal, not a recruiting intelligence signal with re-scoring
3. **Recruiter notes connected to candidate graph** — Metaview does AI interview notes, Read.ai builds knowledge graphs from meetings, but neither connects to sourcing/enrichment/scoring
4. **Proactive talent pool matching** — rediscovery exists but is reactive (recruiter opens role, then searches). Nobody pushes notifications proactively
5. **Temporal knowledge graph** — Beamery talks about it, Findem approximates with 3D data, nobody offers an open queryable graph

---

## CRM Import: The Growth Lever

### Strategy: Use a unified ATS API

**Merge.dev** or **Kombo** covers 30+ ATSes (Greenhouse, Lever, Ashby, Bullhorn, Workable) with **one integration**. Standardized objects:
- `Candidate` (contact info, emails, social URLs)
- `Activity` (notes, emails — type: NOTE, EMAIL, OTHER)
- `Attachment` (resumes, cover letters)
- `Application`, `Interview`, `Scorecard`

### Per-CRM API notes

- **Greenhouse (Harvest API)**: Most developer-friendly. Endpoints for candidates, activity_feed, scorecards, attachments. Rate limit: 50 req/10s. Webhooks for stage changes, hires.
- **Lever**: Primary endpoint is `/opportunities/`. `expand` parameter hydrates notes, feedback, resumes inline. Contact = person, Opportunity = application.
- **Ashby**: API is a "first-class product." Built-in CSV export. Less mature but covers basics.
- **Bullhorn**: REST API, entity-based. Dominant in staffing/agency. Mass import accepts CSV.
- **Gem**: CSV export with event logs, projects, notes. Less documented public API.
- **Loxo**: API primarily for job posting. CSV export likely needed.
- **HubSpot**: Async export API. Notes/activities require separate Engagements API.

### Processing imported recruiter notes

**Two-pass LLM approach:**
1. **Pass 1 (Haiku, cheap)**: Extract structured facts from each note — skills, sentiment, dates, compensation mentions, preferences, red flags
2. **Pass 2 (Sonnet, quality)**: Synthesize all extracted facts per candidate into a rich profile summary

Feed output into Graphiti as episodes with historical `reference_time` — the bi-temporal model correctly places them on the timeline even though they're imported retroactively.

### The pitch to recruiters

*"Bring your existing candidate data from Greenhouse/Lever/whatever. We'll build a knowledge graph from your years of notes and interactions. Within minutes, we can tell you which candidates from your existing pool match your next role — something your current ATS literally cannot do."*

---

## AI Memory Architecture: Detailed Findings

### Mem0

- Storage: per-entity via `user_id` (one per candidate), with metadata tags for source tracking
- Conflict resolution: LLM classifies as ADD/UPDATE/DELETE/NOOP. Old relationships marked invalid, not deleted
- Search: three parallel passes — semantic similarity, BM25 keyword, entity matching
- Compression: 80% token reduction, 91% lower p95 latency vs full-context
- Graph memory (Mem0g): graph-based relational representation, complements Graphiti

### MemGPT / Letta

Three-tier memory hierarchy:
- **Core Memory** (RAM): lives in context window, agent reads/writes directly
- **Recall Memory** (Disk cache): searchable conversation history
- **Archival Memory** (Cold storage): long-term, queried via tool calls

The agent manages promotion/demotion between tiers. Relevant pattern for OpenRecruiter but Mem0 is simpler and already integrated.

### LangMem / LangGraph

Two memory representations:
- **Collections**: unbounded knowledge searched at runtime
- **Profiles**: task-specific information following strict schema

Multi-level namespaces (org > role > candidate_id), background memory manager, Pydantic schema support.

### Profile Synthesis

When combining data from Apollo, LinkedIn, PDL, GitHub, etc.:
1. **Entity resolution**: email match (primary), LinkedIn URL (secondary), name+company (fuzzy)
2. **Survivorship rules**: recency + source reliability per field type (LinkedIn for titles, Apollo for emails, GitHub for technical skills)
3. **Golden record**: merge into single comprehensive record, never delete older data
4. **Narrative generation**: LLM synthesizes structured + unstructured data into readable candidate brief

### Proactive Matching Approaches

- **Dual-encoder architecture**: encode JDs and candidate profiles into same vector space, cosine similarity
- **Skill vector similarity**: weight recent experience more heavily (last 2 years > 5 years ago)
- **Graph neural networks**: bipartite candidate-job graphs, captures second-order relationships
- **Hybrid retrieval**: graph traversal + vector similarity + BM25, reranking layer combines signals
- **Qualitative signal integration**: embed Mem0 memories alongside structured data for matching

---

## GDPR: Must-Build Before Launch

- Consent management system with DSAR (Data Subject Access Request) handling
- "Manage my data" link in every outreach email
- Self-service portal for candidates to view/export/delete data
- Retention policies: active pipeline (duration + buffer), talent pool (12-24 months with consent renewal)
- Anonymization/pseudonymization during knowledge graph building
- Penalties: EUR 10M or 2% of annual turnover

---

## Differentiation Summary

| Feature | Eightfold | Findem | Beamery | Gem | **OpenRecruiter** |
|---|---|---|---|---|---|
| Deep code/portfolio analysis | No | No | No | No | **Yes (Nia Tracer)** |
| Temporal knowledge graph | No | Partial (3D data) | Talks about it | No | **Yes (Graphiti)** |
| Qualitative memory per candidate | No | No | No | No | **Yes (Mem0)** |
| Proactive re-matching | Reactive | Reactive | Reactive | Reactive | **Proactive (agent-driven)** |
| Autonomous end-to-end pipeline | No | No | No | No | **Yes** |
| Frontier model scoring | Proprietary ML | Proprietary ML | Proprietary ML | No | **Yes (Opus 4.6)** |
| CRM import to knowledge graph | No | No | No | No | **Planned** |

**The moat:** every candidate interaction — every search, enrichment, recruiter call, email exchange, GitHub commit, job change — feeds the knowledge graph. Over time, the system knows candidates better than any individual recruiter could, and it never forgets.

---

## Key Sources

### Knowledge Graph & Temporal Models
- [Graphiti GitHub Repository](https://github.com/getzep/graphiti)
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956)
- [CAPER: Career Trajectory Prediction using Temporal KG (KDD 2025)](https://arxiv.org/abs/2408.15620)
- [NASA Hidden Skills with Neo4j](https://neo4j.com/blog/combining-knowledge-graph-graph-algorithms-find-hidden-skills-nasa/)
- [HRGraph: Leveraging LLMs for HR Data Knowledge Graphs](https://arxiv.org/html/2408.13521v1)

### AI Memory Systems
- [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413)
- [Letta/MemGPT Documentation](https://docs.letta.com/concepts/memgpt/)
- [LangMem Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)

### Competitive Landscape
- [Eightfold AI: AI-Powered Talent Matching Architecture](https://eightfold.ai/engineering-blog/ai-powered-talent-matching-the-tech-behind-smarter-and-fairer-hiring/)
- [Findem 3D Talent Data](https://www.findem.ai/why-findem/3d-data)
- [Beamery: Knowledge Graphs, the Future of Talent Management](https://beamery.com/resources/blogs/knowledgegraphs-the-future-of-talent-management)
- [Crustdata Real-Time People Data for Recruiting](https://crustdata.com/blog/real-time-people-data-ai-recruiting-platforms-2025)

### CRM Import & Data Ingestion
- [Merge.dev ATS Unified API](https://www.merge.dev/categories/ats-recruiting-api)
- [Kombo ATS API](https://www.kombo.dev/use-cases/ats-api)
- [Greenhouse Harvest API](https://developers.greenhouse.io/harvest.html)
- [People Data Labs Entity Resolution Guide](https://www.peopledatalabs.com/data-lab/datafication/entity-resolution-guide)

### Matching & Recommendation
- [Graph Neural Networks for Candidate-Job Matching](https://link.springer.com/article/10.1007/s41019-025-00293-y)
- [JobMatchAI: Knowledge Graphs, Semantic Search and Explainable AI](https://arxiv.org/html/2603.14558)
- [From Text to Talent: Extracting Insights from Candidate Profiles](https://arxiv.org/html/2503.17438v1)
