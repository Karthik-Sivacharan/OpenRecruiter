# Airtable Audit Report

**Table:** Candidate Leads (`tbla8PJMJKquIcG60`)
**Base:** `appe7dUY6krm3vYyl`
**Date:** 2026-04-29
**Records:** 23

---

## 1. Current Field Inventory

All 56 fields in order as they appear in Airtable, with type and data coverage.

| # | Field Name | Type | Records with Data | Notes |
|---|-----------|------|-------------------|-------|
| 1 | Name | singleLineText | 23/23 | Primary field |
| 2 | Notes | multilineText | 0/23 | Empty |
| 3 | Assignee | singleCollaborator | 0/23 | Empty |
| 4 | Status | singleSelect (Todo/In progress/Done) | 0/23 | Empty |
| 5 | Attachments | multipleAttachments | 0/23 | Empty |
| 6 | Attachment Summary | aiText (refs Attachments) | 0/23 | AI-generated, errors on empty |
| 7 | Email | email | 21/23 | |
| 8 | Email Status | singleLineText | 23/23 | |
| 9 | Title | singleLineText | 23/23 | |
| 10 | Headline | singleLineText | 23/23 | |
| 11 | Current Company | singleLineText | 23/23 | |
| 12 | Current Company Domain | singleLineText | 23/23 | |
| 13 | Current Company Industry | singleLineText | 23/23 | |
| 14 | Current Company Size | number (precision 0) | 23/23 | |
| 15 | Current Company Funding | singleLineText | 0/23 | Empty |
| 16 | Current Company Stage | singleLineText | 0/23 | Empty |
| 17 | Current Company Tech Stack | singleLineText | 0/23 | Empty |
| 18 | Current Company Description | multilineText | 0/23 | Empty |
| 19 | Seniority | singleLineText | 23/23 | |
| 20 | City | singleLineText | 23/23 | |
| 21 | State | singleLineText | 23/23 | |
| 22 | Country | singleLineText | 23/23 | |
| 23 | LinkedIn URL | url | 23/23 | |
| 24 | GitHub URL | url | 2/23 | |
| 25 | Twitter URL | url | 4/23 | |
| 26 | Photo URL | url | 15/23 | |
| 27 | Employment History | multilineText | 23/23 | |
| 28 | Apollo ID | singleLineText | 23/23 | |
| 29 | Skills | multilineText | 11/23 | |
| 30 | Education | multilineText | 17/23 | |
| 31 | Nia Analysis | multilineText | 0/23 | Empty (future) |
| 32 | Score | number (precision 0) | 0/23 | Empty (future) |
| 33 | Score Rationale | multilineText | 0/23 | Empty (future) |
| 34 | Draft Email Subject | singleLineText | 0/23 | Empty (future) |
| 35 | Draft Email Body | multilineText | 0/23 | Empty (future) |
| 36 | AgentMail Thread ID | singleLineText | 0/23 | Empty (future) |
| 37 | Pipeline Stage | singleSelect (9 choices) | 23/23 | |
| 38 | Role | singleLineText | 23/23 | |
| 39 | Reply Content | multilineText | 0/23 | Empty (future) |
| 40 | Likely to Engage | singleLineText | 0/23 | Empty |
| 41 | Personal Email | email | 6/23 | |
| 42 | Certifications | multilineText | 5/23 | |
| 43 | EnrichLayer ID | singleLineText | 0/23 | Empty |
| 44 | EnrichLayer Experiences | multilineText | 16/23 | |
| 45 | Department | singleLineText | 14/23 | |
| 46 | All Emails | multilineText | 14/23 | |
| 47 | Email Confidence | singleLineText | 1/23 | |
| 48 | Personal Website | url | 11/23 | |
| 49 | Summary | multilineText | 8/23 | |
| 50 | Recommendations | multilineText | 5/23 | |
| 51 | Languages | singleLineText | 7/23 | |
| 52 | Photo | multipleAttachments | 23/23 | Photo uploaded as attachment |
| 53 | Hiring Company | multipleSelects | 3/23 | |
| 54 | Hiring Role | multipleSelects | 3/23 | |
| 55 | Hiring JD URL | url | 3/23 | |
| 56 | Hiring Job Description | multilineText | 2/23 | |
| 57 | Nia Summary | singleLineText | 0/23 | Empty |

**Total: 57 fields** (56 from meta + Nia Summary)

---

## 2. Fields That Can Be Removed

These fields exist in Airtable but are NEVER written to by any tool in the codebase, have zero data in all 23 records, and are NOT part of the documented pipeline schema.

| Field | Type | Reason to Remove |
|-------|------|-----------------|
| **Notes** | multilineText | Default Airtable template field. No code writes to it. Pipeline uses specific fields (Score Rationale, etc.) instead. |
| **Assignee** | singleCollaborator | Default Airtable template field. No code references it. |
| **Status** | singleSelect | Default Airtable template field (Todo/In progress/Done). Replaced by Pipeline Stage. |
| **Attachments** | multipleAttachments | Default Airtable template field. No code writes to it. |
| **Attachment Summary** | aiText | AI summary of Attachments. Since Attachments is empty and unused, this is dead weight. |
| **EnrichLayer ID** | singleLineText | Never written to by any tool. enrichProfile does not return an ID that gets saved. Zero data. |
| **Photo URL** | url | Redundant with Photo (multipleAttachments). Code writes to Photo via `photo_url`, but this URL field is separate and not documented in the schema. 15/23 records have data but it duplicates what Photo already stores. |

**Safe to remove immediately (zero data, no code writes):** Notes, Assignee, Status, Attachments, Attachment Summary, EnrichLayer ID.

**Consider removing (redundant):** Photo URL -- the code writes `candidate.photo_url` as an attachment to the "Photo" field (line 136 of airtable.ts). The "Photo URL" url field is not written to by code and is not in the documented schema. The 15 records with data likely came from typecast on the Photo attachment field.

---

## 3. Fields with Zero Data That SHOULD Be Kept

These have zero data but are part of the documented pipeline and will be populated by future pipeline steps:

| Field | Pipeline Phase | When It Gets Populated |
|-------|---------------|----------------------|
| Nia Analysis | Phase 3 Step 4 | Nia Tracer deep analysis (future) |
| Score | Phase 3 Step 4 | Opus 4.6 scoring (future) |
| Score Rationale | Phase 3 Step 4 | Opus 4.6 scoring (future) |
| Draft Email Subject | Phase 3 Step 4 | Sonnet 4.6 email drafting (future) |
| Draft Email Body | Phase 3 Step 4 | Sonnet 4.6 email drafting (future) |
| AgentMail Thread ID | Phase 4 | After outreach is sent |
| Reply Content | Phase 5 | AgentMail webhook on candidate reply |
| Nia Summary | Phase 3 Step 4 | Nia analysis summary (future) |
| Current Company Funding | Phase 3 Step 1 | Apollo enrichment (data depends on company) |
| Current Company Stage | Phase 3 Step 1 | Apollo enrichment (data depends on company) |
| Current Company Tech Stack | Phase 3 Step 1 | Apollo enrichment (data depends on company) |
| Current Company Description | Phase 3 Step 1 | Apollo enrichment (data depends on company) |
| Likely to Engage | Phase 3 Step 1 | Apollo enrichment (data depends on candidate) |

---

## 4. Recommended Column Order (Left to Right)

Optimized for a recruiter scanning candidates quickly.

### Group 1: Identity (Who is this?)
1. Name
2. Title
3. Current Company
4. Photo
5. Seniority
6. City, State, Country

### Group 2: Quality Signal (How good are they?)
7. Score
8. Score Rationale
9. Nia Analysis
10. Nia Summary
11. Skills
12. Education
13. Summary

### Group 3: Pipeline Status (Where are they?)
14. Pipeline Stage
15. Role
16. Hiring Company
17. Hiring Role

### Group 4: Contact Info (How to reach them?)
18. Email
19. Email Status
20. Personal Email
21. All Emails
22. LinkedIn URL
23. GitHub URL
24. Personal Website

### Group 5: Outreach (What's been sent?)
25. Draft Email Subject
26. Draft Email Body
27. AgentMail Thread ID
28. Reply Content

### Group 6: Deep Profile (Drill-down details)
29. Headline
30. Employment History
31. EnrichLayer Experiences
32. Certifications
33. Recommendations
34. Languages

### Group 7: Company Intel
35. Current Company Domain
36. Current Company Industry
37. Current Company Size
38. Current Company Funding
39. Current Company Stage
40. Current Company Tech Stack
41. Current Company Description

### Group 8: Metadata (usually hidden)
42. Apollo ID
43. Department
44. Email Confidence
45. Likely to Engage
46. Twitter URL
47. Hiring JD URL
48. Hiring Job Description

---

## 5. Fields That Might Need Type Changes

| Field | Current Type | Recommended Type | Reason |
|-------|-------------|-----------------|--------|
| **Email Status** | singleLineText | singleSelect | Only has a few values (verified, guessed, etc.). Select would enable filtering and color-coding. |
| **Email Confidence** | singleLineText | number (percent) | Code writes `String(candidate.email_confidence)` but this is inherently a number (0-1 or 0-100). Storing as text prevents sorting/filtering by confidence. |
| **Likely to Engage** | singleLineText | checkbox | Code writes `String(candidate.is_likely_to_engage)` which is a boolean. A checkbox is the natural Airtable type for true/false. |
| **Seniority** | singleLineText | singleSelect | Apollo returns a fixed set of values (senior, manager, vp, etc.). Select enables filtering. |
| **Department** | singleLineText | singleSelect | Apollo returns a fixed set (design, engineering, etc.). Select enables filtering. |
| **Current Company Tech Stack** | singleLineText | multilineText | Tech stacks can be long comma-separated lists. Would overflow a single-line view. |
| **Draft Email Subject** | singleLineText | singleLineText | Fine as-is. |
| **Hiring Company** | multipleSelects | singleLineText | Code writes a plain string (`fields['Hiring Company'] = hiring.hiring_company`). The multipleSelects type works via typecast but is semantically wrong -- each candidate row has exactly one hiring company. |
| **Hiring Role** | multipleSelects | singleLineText | Same issue. Code writes a plain string. Each candidate has exactly one hiring role. |
| **Role** | singleLineText | singleSelect | Would enable filtering by role. Each pipeline run targets one role. |
| **Nia Summary** | singleLineText | multilineText | Summaries are typically multi-sentence. Will truncate in singleLine. |
| **Photo URL** | url | (remove) | Redundant with Photo (multipleAttachments). See removal section above. |

### Type change priority

**High (causes data issues):**
- Hiring Company: multipleSelects -> singleLineText (or singleSelect)
- Hiring Role: multipleSelects -> singleLineText (or singleSelect)
- Email Confidence: singleLineText -> number
- Likely to Engage: singleLineText -> checkbox

**Medium (improves recruiter UX):**
- Email Status -> singleSelect
- Seniority -> singleSelect
- Department -> singleSelect
- Nia Summary -> multilineText

**Low (nice to have):**
- Role -> singleSelect
- Current Company Tech Stack -> multilineText

---

## 6. Summary of Findings

- **57 fields** total in the table
- **6 fields** are safe to remove immediately (default Airtable template leftovers + unused EnrichLayer ID)
- **1 field** (Photo URL) is likely redundant with Photo
- **13 fields** have zero data but are expected to be populated by future pipeline phases
- **10 fields** would benefit from type changes, with 4 being high priority
- **Current column order** is roughly the order fields were added, not optimized for recruiter scanning
- **Hiring Company and Hiring Role** are multipleSelects but should be singleLineText or singleSelect -- the code writes plain strings via typecast, which silently creates select options
