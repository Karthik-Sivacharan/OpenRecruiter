# Recruiting Pipeline Rules

## Tool Execution Order

Always follow this order. Do not skip steps or reorder.

### Sourcing Chain
1. `apollo_mixed_people_api_search` -> get candidate list
2. `apollo_people_bulk_match` (batches of 10) -> get emails
4. `enrichProfile` via EnrichLayer (1 credit) -> full LinkedIn data
5. `enrichWorkEmail` via EnrichLayer (3 credits) -> verified work email (only if Apollo email missing)

### GitHub/Portfolio Discovery Chain
1. `pdlEnrichPerson` via PDL (1 credit) -> check for github_username, profiles[], websites[]
2. `githubSearchByEmail` via GitHub GraphQL (FREE) -> find GitHub from email
3. If no GitHub: `githubSearchByName` (FREE) -> name-based fallback
4. If still no GitHub: `niaWebSearch` (1 credit) -> web search for GitHub/portfolio
5. `githubFetchProfile` (FREE) -> get websiteUrl, bio, README for portfolio links

### Analysis Chain
1. `niaTracer` (15 credits/candidate) -> deep GitHub repo analysis
2. `niaTracer` on portfolio/blog sites (15 credits/site) -> portfolio analysis
3. Score using `.claude/skills/scoring-rubric/` skill (Claude Opus)

### Outreach Chain
1. Generate personalized email per candidate using `.claude/skills/outreach-style/` skill
2. `agentmailCreateDraft` -> create draft (NOT sent)
3. Present drafts to recruiter. WAIT for approval.
4. On approval: `agentmailSendEmail` -> send
5. Update Attio stage to "Contacted"
6. Schedule drip per `.claude/skills/drip-sequence/` skill

## Graphiti Logging

Log to Graphiti at EVERY step:
- Role created -> `add_episode` with role details + constraints
- Candidate sourced -> `add_episode` with Apollo + EnrichLayer profile
- Links discovered -> `add_episode` with GitHub URL, portfolio, social links
- Analysis complete -> `add_episode` with Tracer results
- Score assigned -> `add_episode` with score + reasoning
- Email drafted -> `add_episode` with draft content
- Email sent -> `add_episode` with timestamp, thread ID
- Reply received -> `add_episode` with content + sentiment
- Follow-up sent -> `add_episode` with follow-up number + content

## Attio Pipeline Stages

Sourced -> Enriched -> Analyzed -> Scored -> Draft Ready -> Contacted -> Replied -> Screened -> Intro'd

## Model Routing Strategy

The chat agent (orchestrator) always runs on **Sonnet 4.6**. Individual tool implementations use different models internally for cost optimization.

| Pipeline Step | Orchestrator | Internal Model | Why |
|---|---|---|---|
| Sourcing (Apollo search, enrich) | Sonnet 4.6 | None (pure API calls) | No LLM needed, just REST calls |
| Enrichment (EnrichLayer, PDL) | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| GitHub/Portfolio Discovery | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| Nia Tracer Analysis | Sonnet 4.6 | None (Nia does the analysis) | Nia's own AI handles it |
| **Candidate Scoring** | Sonnet 4.6 | **Opus 4.6** | Best reasoning for nuanced fit assessment |
| Email Drafting | Sonnet 4.6 | Sonnet 4.6 | Needs good writing quality |
| CRM Updates (Attio) | Sonnet 4.6 | None (pure API calls) | No LLM needed |
| Auto-Reply Generation | Sonnet 4.6 | Sonnet 4.6 | Needs context + good writing |
| Drip Follow-ups | Sonnet 4.6 | Sonnet 4.6 | Needs personalization quality |

### How Model Routing Works in Code

```typescript
// The main /api/chat/route.ts always uses Sonnet 4.6
const result = streamText({
  model: anthropic('claude-sonnet-4-6-20250514'),
  messages,
  tools: { ... }
})

// Inside the scoreCandidate tool implementation, call Opus separately
const scoringResult = await generateText({
  model: anthropic('claude-opus-4-6-20250626'),
  prompt: `Score this candidate against the role...`,
})
```

### Model IDs
- **Sonnet 4.6**: `claude-sonnet-4-6-20250514` (orchestrator + writing)
- **Opus 4.6**: `claude-opus-4-6-20250626` (scoring only)
- **Haiku 4.5**: `claude-haiku-4-5-20251001` (reserved for future batch operations)

### Cost Estimate Per Session (~$0.25)
- Sonnet 4.6 orchestration: ~$0.20 (50k input, 8k output)
- Opus 4.6 scoring call: ~$0.05 (5k input, 2k output)
- Most tools are pure API calls with zero LLM cost

## Credit Awareness

Do NOT surface credit costs to the recruiter. Just run the pipeline. The agent should enrich, analyze, and score without asking about credits — only pause for approval on sending outreach emails.
