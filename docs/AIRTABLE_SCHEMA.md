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
| All Emails | multilineText | Apollo + EnrichLayer | Readable text: "email (type, status) [source]" per line — every email from all sources |
| Title | singleLineText | Apollo | Current job title |
| Headline | singleLineText | Apollo | LinkedIn headline |
| Photo | multipleAttachments | Apollo | Profile photo (rendered as thumbnail from LinkedIn URL) |

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
| Employment History | multilineText | Apollo | Readable text: "Title @ Company (date–date)" per line |
| Likely to Engage | singleLineText | Apollo | "true" or "false" |
| Apollo ID | singleLineText | Apollo | For re-enrichment and dedup |

### Deep Enrichment (EnrichLayer, PDL)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Personal Email | email | EnrichLayer | Personal email for outreach (gmail, etc.) — preferred over work email |
| Personal Website | url | EnrichLayer | Personal website/portfolio URL from LinkedIn Contact Info (extra.website) |
| Summary | multilineText | EnrichLayer | LinkedIn summary/about section — key for outreach personalization and scoring |
| Recommendations | multilineText | EnrichLayer | Readable paragraphs — testimonials from colleagues |
| Languages | singleLineText | EnrichLayer | Comma-separated, e.g. "English, Tamil" |
| Skills | multilineText | EnrichLayer | Comma-separated skill list |
| Education | multilineText | EnrichLayer | Readable text: "Degree, School (year–year)" per line |
| Certifications | multilineText | EnrichLayer | Readable text: "Name — Authority (year)" per line. Blank if none. |
| EnrichLayer Experiences | multilineText | EnrichLayer | Readable text: "Title @ Company (year–year)" with indented descriptions. Separate from Apollo's Employment History. |
| EnrichLayer ID | singleLineText | EnrichLayer | For future re-enrichment |

### Analysis & Scoring (Nia, Opus)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Nia Analysis | multilineText | Nia Tracer | GitHub/portfolio analysis summary |
| Fit Score | number | Claude Opus 4.6 | 1-10 fit score |
| Fit Rationale | multilineText | Claude Opus 4.6 | 3-5 sentence assessment |

### Outreach (Sonnet, AgentMail)
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Draft Email Subject | singleLineText | Sonnet 4.6 | Lowercase, under 50 chars |
| Draft Email Body | multilineText | Sonnet 4.6 | 50-100 words, personalized |
| AgentMail Draft ID | singleLineText | AgentMail | Links to draft for sending |
| AgentMail Thread ID | singleLineText | AgentMail | Set after draft is sent |
| AgentMail Message ID | singleLineText | AgentMail | Set after draft is sent |
| Sent At | singleLineText | AgentMail | ISO timestamp when outreach was sent |
| Reply Content | multilineText | AgentMail webhook | Candidate's reply text |

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
| EnrichLayer | UPDATE row | Personal Email (only if empty), Personal Website, Summary, Recommendations, Languages, All Emails (append), Skills, Education, Certifications, EnrichLayer Experiences, EnrichLayer ID | (stays Enriched) |
| Nia Web Search | UPDATE row | Personal Website (if missing), GitHub URL (if missing) — only for candidates where enrichment didn't find these. Verified against candidate's name + employment history before saving. | (stays Enriched) |
| Nia Tracer | UPDATE row | Nia Analysis | Analyzed |
| Scoring | UPDATE row | Fit Score, Fit Rationale | Scored |
| Email Draft | UPDATE row | Draft Email Subject, Draft Email Body, AgentMail Draft ID | Draft Ready |
| Email Sent | UPDATE row | AgentMail Thread ID, AgentMail Message ID, Sent At | Contacted |
| Reply Received | UPDATE row | Reply Content | Replied |
