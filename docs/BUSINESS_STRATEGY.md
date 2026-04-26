# OpenRecruiter: Integration & Business Strategy

## Integration Strategy

### Demo (Now)
Hardcoded API keys in `.env.local`. No OAuth, no integration platform. It just works.

### Product Launch (2-3 months)
- **CRM:** Nango ($50/mo) for OAuth connections — users connect their HubSpot, Salesforce, Airtable, Attio
- **Apollo + AgentMail:** OpenRecruiter-managed accounts (users don't need their own)
- **Why Nango:** 700+ integrations, open source (self-hostable), $1/connection, drop-in OAuth UI component

### Scale (6+ months)
- Nango for CRM + optional BYO for power users (bring your own Apollo, email, etc.)
- Settings page with connection cards

## Integration Platform Comparison

| Platform | Free Tier | Paid Starting | Integrations | Risk |
|----------|-----------|---------------|-------------|------|
| Maton | 30 connections | Custom | 24 apps | 2-person team, small catalog |
| **Nango** | **10 connections** | **$50/mo** | **700+ apps** | **Open source fallback** |
| Merge.dev | 3 accounts | $650/mo | 200+ | Expensive |
| Paragon | None | Custom | 100+ | Opaque pricing |
| Build ourselves | N/A | Engineering time | N/A | Weeks per integration |

## Business Model

### Full-Service (Recommended)

OpenRecruiter provides everything as a service. User only connects their CRM.

| Tier | Price | Included |
|------|-------|---------|
| Starter | $299/mo | 500 candidates/mo, 1 pipeline, Apollo sourcing, AI scoring, email drafting + sending |
| Growth | $599/mo | 2000 candidates/mo, unlimited pipelines, priority support |
| Enterprise | Custom | Custom volume, SSO, dedicated account manager |

### COGS Per Customer (~$30-80/mo)
- Apollo credits: ~$10-30/mo (shared org account, amortized)
- AgentMail: ~$5-15/mo (per-inbox allocation)
- LLM tokens (Sonnet + Opus scoring): ~$15-35/mo
- **Gross margin: 70-85%**

### Why Full-Service Wins

1. **Onboarding:** Sign up → paste JD → connect CRM → go. Under 5 minutes.
2. **Moat:** Own the pipeline, build proprietary scoring from outcomes (who replied, who got hired).
3. **Revenue:** $299-599/mo vs $99-149/mo in BYO model.
4. **Control:** Consistent quality, no "my Apollo key is expired" support tickets.

### Competitor Pricing Reference

| Tool | Price | Model |
|------|-------|-------|
| SeekOut | ~$830/seat/mo | Full-service enterprise |
| Juicebox | $375-950/mo | Credit-based sourcing |
| Fetcher | $379-649/mo | Full-service |
| Gem | $135/seat/mo | Full-service CRM + AI |
| hireEZ | $139-199/seat/mo | Full-service |
| Clay | $185-495/mo | BYO email, credits for enrichment |
| Apollo Sequences | $49-119/user/mo | Full-service data + outreach |
| Instantly.ai | $47-286/mo | Cold email only |

### What Users Connect (via Nango OAuth)
- Their CRM only: HubSpot, Salesforce, Airtable, Attio, Notion, Google Sheets

### What OpenRecruiter Provides (managed)
- Apollo.io (sourcing + enrichment)
- AgentMail (email sending + auto-reply)
- Nia Tracer (GitHub analysis)
- EnrichLayer (profile enrichment)
- Claude API (AI orchestration + scoring)
- Graphiti (knowledge graph)
