# Airtable Schema: Candidate Leads

Base ID: `appe7dUY6krm3vYyl`
Table ID: `tbla8PJMJKquIcG60`
Table Name: `Candidate Leads`

## Fields

### Identity & Contact (from Apollo Enrich)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Name | singleLineText | Apollo | Full name (pre-existing field) |
| Email | email | Apollo | Work email |
| Email Status | singleLineText | Apollo | "verified", "extrapolated", "guessed" |
| Email Confidence | singleLineText | Apollo | 0-1 confidence score (only when status is "extrapolated") |
| Personal Email | email | Apollo / EnrichLayer | Best personal email (gmail, etc.) — preferred for outreach |
| All Emails | multilineText | Apollo + EnrichLayer | JSON: [{email, source, type, status, confidence}] — every email from all sources |
| Title | singleLineText | Apollo | Current job title |
| Headline | singleLineText | Apollo | LinkedIn headline |
| Photo URL | url | Apollo | LinkedIn profile photo |

### Location (from Apollo Enrich)
| Field | Type | Source |
|-------|------|--------|
| City | singleLineText | Apollo |
| State | singleLineText | Apollo |
| Country | singleLineText | Apollo |

### Company (from Apollo Enrich)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Company | singleLineText | Apollo | Company name |
| Company Domain | singleLineText | Apollo | Primary domain |
| Company Industry | singleLineText | Apollo | Industry classification |
| Company Size | number | Apollo | Estimated employee count |
| Company Funding | singleLineText | Apollo | Total funding (formatted string) |
| Company Stage | singleLineText | Apollo | Latest funding stage |
| Company Tech Stack | singleLineText | Apollo | Comma-separated tech names |
| Company Description | multilineText | Apollo | Short company description |

### Social & Professional
| Field | Type | Source |
|-------|------|--------|
| LinkedIn URL | url | Apollo |
| GitHub URL | url | Apollo / PDL |
| Twitter URL | url | Apollo |

### Career & Signals (from Apollo Enrich)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Seniority | singleLineText | Apollo | "senior", "director", "vp", etc. |
| Department | singleLineText | Apollo | e.g. "product_management, design, engineering" |
| Employment History | multilineText | Apollo | JSON: [{company, title, start_date, end_date, current}] |
| Likely to Engage | singleLineText | Apollo | "true" or "false" |
| Apollo ID | singleLineText | Apollo | For re-enrichment and dedup |

### Deep Enrichment (EnrichLayer, PDL)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Personal Email | email | EnrichLayer | Personal email for outreach (gmail, etc.) — preferred over work email |
| Skills | multilineText | EnrichLayer | Comma-separated skill list |
| Education | multilineText | EnrichLayer | JSON: [{school, degree, field_of_study, start_date, end_date}] |
| Certifications | multilineText | EnrichLayer | JSON: [{name, authority, url}] |
| EnrichLayer Experiences | multilineText | EnrichLayer | JSON: full experiences array with job descriptions. Separate from Apollo's Employment History — EnrichLayer has descriptions but may be stale. Apollo's Employment History is untouched. |
| EnrichLayer ID | singleLineText | EnrichLayer | For future re-enrichment |

### Analysis & Scoring (future — Nia, Opus)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Nia Analysis | multilineText | Nia Tracer | GitHub/portfolio analysis summary |
| Score | number | Claude Opus | 1-10 |
| Score Rationale | multilineText | Claude Opus | Why this score |

### Outreach (future — Sonnet, AgentMail)
| Field | Type | Source |
|-------|------|--------|
| Draft Email Subject | singleLineText | Sonnet 4.6 |
| Draft Email Body | multilineText | Sonnet 4.6 |
| AgentMail Thread ID | singleLineText | AgentMail |
| Reply Content | multilineText | AgentMail webhook |

### Pipeline
| Field | Type | Values |
|-------|------|--------|
| Pipeline Stage | singleSelect | Enriched, Analyzed, Scored, Draft Ready, Contacted, Replied, Screened, Intro'd, Declined |
| Role | singleLineText | The role this candidate was sourced for |
| Status | singleSelect | Pre-existing field |
| Notes | multilineText | Pre-existing field, running log |

### Pre-existing Fields (untouched)
| Field | Type | Notes |
|-------|------|-------|
| Assignee | singleCollaborator | Pre-existing |
| Attachments | multipleAttachments | Pre-existing |
| Attachment Summary | aiText | Pre-existing, AI-generated |

## Incremental Push Strategy

Data is pushed to Airtable after EACH enrichment step so nothing is lost:

| Step | Action | Fields Updated | Stage Set |
|------|--------|---------------|-----------|
| Apollo Enrich | CREATE row | Name, Email, Email Status, Email Confidence, Personal Email, All Emails, Department, Title, Company, Location, LinkedIn, Seniority, Employment History, all Company fields | Enriched |
| EnrichLayer | UPDATE row | Personal Email (only if empty), All Emails (append), Skills, Education, Certifications, EnrichLayer Experiences, EnrichLayer ID | (stays Enriched) |
| PDL / GitHub | UPDATE row | GitHub URL | (stays Enriched) |
| Nia Tracer | UPDATE row | Nia Analysis | Analyzed |
| Scoring | UPDATE row | Score, Score Rationale | Scored |
| Email Draft | UPDATE row | Draft Email Subject, Draft Email Body | Draft Ready |
| Email Sent | UPDATE row | AgentMail Thread ID | Contacted |
| Reply Received | UPDATE row | Reply Content | Replied |
