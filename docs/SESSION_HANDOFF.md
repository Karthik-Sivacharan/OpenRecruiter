# Session Handoff

## Latest Session: Manual Candidate Import Pipeline (2026-05-01)

Branch: `feat/manual-candidate-import` (merged to main)

### What Was Built

**Manual import flow** for candidates from external sources (Tally forms, Notion tables, CSVs) instead of Apollo sourcing:

1. **Import script** (`scripts/import-notion-candidates.ts`) - reads Notion CSV, maps fields, pushes to Airtable with resume attachments + intake notes
2. **"Imported" pipeline stage** - new pre-enrichment stage for manually imported candidates
3. **`apolloMatchAndEnrich` tool** - self-serving batch tool that matches candidates by email/LinkedIn/name via Apollo bulk_match (no Apollo ID needed), writes enrichment data back to Airtable
4. **Resume PDF scoring** - scoring tool now passes resume PDFs natively to Opus via AI SDK `type: 'file'` content part (no pdf-parse dependency)
5. **Intake Notes** - new Airtable field read by scoring tool, contains combined first-contact info

### New Airtable Columns

| Column | Type | Purpose |
|--------|------|---------|
| Resume | Attachment | Candidate resume PDF |
| Phone | Phone number | Direct contact number |
| Personal Website Password | Single line text | Portfolio passwords |
| Intake Notes | Long text | Combined form data (bio, salary, work pref, years, etc.) |

### Pipeline for Manual Imports

```
Import (CSV -> Airtable, stage: Imported)
  -> apolloMatchAndEnrich (match by email/LinkedIn, get employment history + company data)
  -> enrichAndSaveProfiles (EnrichLayer: skills, education, summary from LinkedIn)
  -> searchAndSaveWebPresence (find missing GitHub/portfolio)
  -> scoreCandidates (Opus reads profile + Intake Notes + Resume PDF)
```

### Test Run Results (Ninety Head of Design, 37 candidates)

- Apollo matched 35/37
- EnrichLayer enriched 35/35
- Scored 30/35 (5 failed due to .docx resume format - see Known Issues)

### Known Issues / Pending Work

1. **DOCX resume handling**: 5 candidates had .docx resumes (not PDFs). Claude's file API only accepts PDFs. These candidates scored without resume data. Fix: detect non-PDF attachments and either skip gracefully or convert to text before scoring.

2. **Inbound response emails**: Current outreach tools are built for cold outbound. Need a new email mode for candidates who applied to a role - different tone (e.g. "thanks for applying, we'd love to chat" vs "hey I found your profile"). Could be a new skill/prompt or just recruiter config at draft time.

3. **Test via chat UI**: The pipeline was run via scripts. Need to verify the agent can orchestrate the same flow when told "candidates are already in Airtable, skip sourcing, run enrichment and scoring."

4. **2 candidates not found in Apollo**: Seth Jenks (no email or LinkedIn) and GURKAN MARUF MIHCI (no LinkedIn). These could be enriched via `enrichLookupPerson` if needed.

### Key Files Changed

- `src/lib/tools/apollo.ts` - added `apolloMatchAndEnrich` self-serving tool
- `src/lib/tools/scoring.ts` - added Intake Notes field + Resume PDF support via AI SDK file content part
- `src/lib/tools/enrichlayer.ts` - filter accepts both "Imported" and "Enriched" stages
- `src/app/api/chat/route.ts` - wired `apolloMatchAndEnrich` into chat tools
- `docs/AIRTABLE_SCHEMA.md` - added 4 new fields + Imported stage
- `.claude/rules/recruiting-pipeline.md` - updated pipeline stages and schema
- `scripts/import-notion-candidates.ts` - one-time Notion CSV import
- `scripts/run-pipeline.ts` - batch pipeline runner
- `scripts/test-pdf-to-claude.ts` - PDF-to-Claude dry test
- `scripts/test-full-pipeline.ts` - single-candidate pipeline test
