# Recruiting Pipeline Rules

## Tool Execution Order

Always follow this order. Do not skip steps or reorder.

### Sourcing Chain
1. `apollo_mixed_people_api_search` (FREE, no credits) -> get candidate list
2. Present results to recruiter. ASK before enriching (costs credits).
3. `apollo_people_bulk_match` (1 credit/person, batches of 10) -> get emails
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

## Credit Awareness

Always tell the recruiter the credit cost before spending:
- Apollo enrich: 1 credit/person
- EnrichLayer profile: 1 credit
- EnrichLayer work email: 3 credits
- PDL enrich: 1 credit
- Nia web search: 1 credit
- Nia Tracer: 15 credits
