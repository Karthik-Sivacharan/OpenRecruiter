# Airtable Schema: Candidate Leads

Base ID: `appe7dUY6krm3vYyl`
Table ID: `tbla8PJMJKquIcG60`
Table Name: `Candidate Leads`

## Fields

### Identity & Contact (from Apollo Enrich)
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Name | singleLineText | Apollo | Full name |
| Email | email | Apollo | Work email |
| Email Status | singleLineText | Apollo | "verified", "extrapolated", "guessed" |
| Email Confidence | singleLineText | Apollo | 0-1 confidence score |
| Personal Email | email | Apollo / EnrichLayer | Personal email (gmail, etc.) |
| All Emails | multilineText | Apollo + EnrichLayer | Readable text: "email (type, status) [source]" per line |
| Title | singleLineText | Apollo | Current job title |
| Headline | singleLineText | Apollo | LinkedIn headline |
| Photo | multipleAttachments | Apollo | Profile photo thumbnail |
| Photo URL | url | Apollo | Direct URL to profile photo |

### Location (from Apollo Enrich)
| Field | Airtable Type | Source |
|-------|---------------|--------|
| City | singleLineText | Apollo |
| State | singleLineText | Apollo |
| Country | singleLineText | Apollo |

### Current Company (from Apollo Enrich)
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Current Company | singleLineText | Apollo | Company name |
| Current Company Domain | singleLineText | Apollo | Primary domain |
| Current Company Industry | singleLineText | Apollo | Industry classification |
| Current Company Size | number | Apollo | Estimated employee count |
| Current Company Description | multilineText | Apollo | Short company description |

### Social & Professional
| Field | Airtable Type | Source |
|-------|---------------|--------|
| LinkedIn URL | url | Apollo |
| GitHub URL | url | Apollo / EnrichLayer / Nia |
| Twitter URL | url | Apollo |
| Personal Website | url | EnrichLayer / Nia |

### Career & Signals (from Apollo Enrich)
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Seniority | singleLineText | Apollo | "senior", "director", "vp", etc. |
| Department | singleLineText | Apollo | e.g. "engineering, product_management" |
| Employment History | multilineText | Apollo | Readable text: "Title @ Company (date-date)" per line |
| Likely to Engage | singleLineText | Apollo | "true" or "false" |
| Apollo ID | singleLineText | Apollo | For re-enrichment and dedup |

### Deep Enrichment (EnrichLayer)
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Summary | multilineText | EnrichLayer | LinkedIn summary/about section |
| Recommendations | multilineText | EnrichLayer | Testimonials from colleagues |
| Languages | singleLineText | EnrichLayer | Comma-separated, e.g. "English, Tamil" |
| Skills | multilineText | EnrichLayer | Comma-separated skill list |
| Education | multilineText | EnrichLayer | Readable text: "Degree, School (year-year)" per line |
| Certifications | multilineText | EnrichLayer | Readable text: "Name - Authority (year)" per line |
| EnrichLayer Experiences | multilineText | EnrichLayer | Readable text: "Title @ Company (year-year)" with descriptions |

### Analysis & Scoring
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Nia Summary | multilineText | Nia Tracer | Short web presence summary |
| Nia Analysis | multilineText | Nia Tracer | Full GitHub/portfolio analysis |
| Fit Score | number | Claude Opus 4.6 | 1-10 fit score |
| Fit Rationale | multilineText | Claude Opus 4.6 | 3-5 sentence assessment |

### Outreach (AgentMail)
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Draft Email Subject | singleLineText | Sonnet 4.6 | Email subject line |
| Draft Email Body | multilineText | Sonnet 4.6 | Personalized email body |
| AgentMail Draft ID | singleLineText | AgentMail | Links to draft for sending |
| AgentMail Thread ID | singleLineText | AgentMail | Set after draft is sent |
| AgentMail Message ID | singleLineText | AgentMail | Set after draft is sent |
| Sent At | singleLineText | AgentMail | ISO timestamp when outreach was sent |
| Reply Content | multilineText | AgentMail webhook | Candidate's reply text |

### Hiring Context (from JD / recruiter intake)
| Field | Airtable Type | Source | Notes |
|-------|---------------|--------|-------|
| Role | singleLineText | Intake | The role this candidate was sourced for |
| Hiring Company | multipleSelects | JD | The company hiring |
| Hiring Role | multipleSelects | JD | Exact role title from JD |
| Hiring JD URL | url | Recruiter | Link to the job description |
| Hiring Job Description | multilineText | JD fetch | Full JD text |

### Pipeline & Notes
| Field | Airtable Type | Notes |
|-------|---------------|-------|
| Pipeline Stage | singleSelect | Enriched, Scored, Draft Ready, Contacted, Replied, Screened, Intro'd, Declined |
| Recruiter Notes | multilineText | Free-form notes from the recruiter about the candidate |

### Supermemory Sync
| Field | Airtable Type | Notes |
|-------|---------------|-------|
| Supermemory Synced At | singleLineText | ISO timestamp of last sync to Supermemory talent pool |
| Last Modified Time | lastModifiedTime | Auto-updated by Airtable when any field changes. Used for daily batch sync diff. |

### Pre-existing Fields
| Field | Airtable Type | Notes |
|-------|---------------|-------|
| Attachments | multipleAttachments | Pre-existing |

## Pipeline Stages

Enriched -> Scored -> Draft Ready -> Contacted -> Replied -> Screened -> Intro'd -> Declined

## Incremental Push Strategy

Data is pushed to Airtable after EACH enrichment step so nothing is lost:

| Step | Action | Key Fields Updated | Stage Set |
|------|--------|--------------------|-----------|
| Apollo Enrich | CREATE row | Name, Email, Title, Company, LinkedIn, Employment History, all Company fields | Enriched |
| EnrichLayer | UPDATE row | Summary, Skills, Education, Certifications, EnrichLayer Experiences, Languages | (stays Enriched) |
| Web Presence | UPDATE row | Personal Website, GitHub URL (if missing) | (stays Enriched) |
| Scoring | UPDATE row | Fit Score, Fit Rationale | Scored |
| Email Draft | UPDATE row | Draft Email Subject, Draft Email Body, AgentMail Draft ID | Draft Ready |
| Email Sent | UPDATE row | AgentMail Thread ID, AgentMail Message ID, Sent At | Contacted |
| Reply Received | UPDATE row | Reply Content | Replied |
| Supermemory Sync | UPDATE row | Supermemory Synced At | (no stage change) |
