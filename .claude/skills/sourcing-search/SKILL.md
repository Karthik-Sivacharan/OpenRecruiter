---
name: sourcing-search
description: Use when constructing candidate search queries, sourcing candidates, building Apollo search filters, PDL queries, or translating job descriptions into API parameters.
user-invocable: true
argument-hint: "[job description or search criteria]"
---

# Sourcing Search Query Guide

## Step 1: Parse the JD into Filter Categories

Split every requirement into one of two buckets:

| Category | Goes Into | Examples |
|----------|----------|---------|
| **Must-have** | API filters (Apollo/PDL) | Title, location, seniority, years of experience |
| **Nice-to-have** | Post-enrichment scoring (Opus) | Specific skills, education prestige, company tier, GitHub quality |

**Never put nice-to-haves in API filters** — they eliminate good candidates who might match on everything else.

## Step 2: Construct Apollo Search Filters

Use `apollo_mixed_people_api_search` with these parameters:

### Person Filters
- **`person_titles`** (array): Include 2-3 title variations. Apollo does fuzzy matching by default.
  - "ML Engineer" → `["machine learning engineer", "ml engineer", "applied ml engineer"]`
  - "Backend Engineer" → `["backend engineer", "software engineer backend", "server engineer"]`
  - Set `include_similar_titles: false` only if you're getting too much noise
- **`person_locations`** (array): City + state format.
  - `["San Francisco, CA", "Bay Area", "California"]`
- **`person_seniorities`** (array): Valid values:
  - `senior`, `manager`, `director`, `vp`, `head`, `c_suite`, `partner`, `owner`, `founder`, `entry`, `intern`
- **`q_keywords`** (string): Free-text across name, title, employer, email. Use sparingly — it's broad.
- **`contact_email_status`** (array): Set to `["verified", "likely to engage"]` for contactable candidates.

### Company Filters (filter people BY their employer)
- **`currently_using_any_of_technology_uids`** (array): Company tech stack as a proxy for person skills.
  - UIDs use underscores: `pytorch`, `tensorflow`, `kubernetes`, `apache_spark`, `google_cloud_platform`, `amazon_web_services`
  - This is COMPANY-level, not person-level. A PyTorch user at a company that uses PyTorch.
- **`currently_using_all_of_technology_uids`** (array): ALL must be in company stack. Use for hard requirements.
- **`organization_num_employees_ranges`** (array): Company size.
  - `["11,50"]`, `["51,200"]`, `["201,500"]`, `["501,1000"]`, `["1001,5000"]`, `["5001,10000"]`
- **`q_organization_keyword_tags`** (array): Industry tags.
  - `["SaaS", "fintech", "artificial intelligence", "machine learning"]`
- **`q_organization_domains_list`** (array): Target specific companies by domain.

### Hiring Intent Filters
- **`q_organization_job_titles`** (array): Companies actively hiring for these titles.
- **`organization_job_posted_at_range`** (object): `{min: "2026-01-01"}` for recent postings.

### Pagination
- **`per_page`**: Set to `100` (max). Default is 10 — always override this.
- **`page`**: 1-500.

## Step 3: Run Multi-Pass Searches

For any technical role, run 2-3 search passes with different title variations. Deduplicate by email.

**Example: "Senior ML Engineer, PyTorch, distributed systems, SF Bay Area"**

Pass 1 (direct titles):
```json
{
  "person_titles": ["machine learning engineer", "ml engineer"],
  "person_seniorities": ["senior"],
  "person_locations": ["San Francisco, California", "Bay Area"],
  "currently_using_any_of_technology_uids": ["pytorch", "tensorflow"],
  "per_page": 100
}
```

Pass 2 (adjacent titles):
```json
{
  "person_titles": ["applied scientist", "research engineer", "ml infrastructure engineer"],
  "person_locations": ["San Francisco, California", "Bay Area"],
  "currently_using_any_of_technology_uids": ["pytorch"],
  "per_page": 100
}
```

Pass 3 (broader, tech-stack-filtered):
```json
{
  "person_titles": ["data scientist", "software engineer"],
  "person_seniorities": ["senior"],
  "person_locations": ["California"],
  "currently_using_all_of_technology_uids": ["pytorch"],
  "q_keywords": "distributed training OR distributed systems",
  "per_page": 100
}
```

## Step 4: Company-First Sourcing (For Niche Roles)

When targeting specific company types:

1. Search companies first: `apollo_mixed_companies_search` with `q_organization_keyword_tags` + tech filters
2. Collect `organization_ids` from results
3. Search people within those companies: `apollo_mixed_people_api_search` with `organization_ids` + title/seniority filters

This is more precise than broad people search for roles like "ML Engineer at AI-native startups."

## Step 5: When to Use PDL Instead of Apollo

| Scenario | Use Apollo | Use PDL |
|----------|-----------|---------|
| Title + location + seniority search | Yes | Overkill |
| **Skills-based filtering** (person-level, not company) | No (can't do it) | **Yes — SQL query API** |
| **Education filtering** (school, degree, major) | No (can't do it) | **Yes** |
| GitHub/portfolio discovery | No | **Yes — returns github_url, websites[]** |
| Broad prospecting (100+ candidates) | Yes (free search) | Expensive (credits per result) |

### PDL SQL Query Examples

Skills + location:
```
job_title LIKE '%machine learning%'
AND location_country = 'united states'
AND location_region = 'california'
AND skills.name IN ('pytorch', 'distributed systems', 'python')
```

Education filter:
```
job_title LIKE '%machine learning%'
AND education.school.name IN ('stanford university', 'mit', 'carnegie mellon university')
AND education.degrees IN ('masters', 'doctorates')
```

## Step 6: Enrichment Decision Tree

After search results come back:

```
For EVERY candidate:
  1. apollo_people_bulk_match → get email (batches of 10)
  2. enrichProfile (EnrichLayer) → full LinkedIn data, skills, job history

For candidates with missing email:
  3. enrichWorkEmail (EnrichLayer, 3 credits) → verified work email

For GitHub/portfolio discovery:
  4. pdlEnrichPerson → github_url, websites[], profiles[]
  5. If no GitHub from PDL → githubSearchByEmail (free)
  6. If still no GitHub → githubSearchByName (free)
  7. If still nothing → niaWebSearch (1 credit)

For top candidates only (score 7+):
  8. niaTracer on GitHub repos (15 credits each)
  9. niaTracer on portfolio/blog (15 credits each)
```

## Apollo Technology UID Naming Convention

UIDs use lowercase with underscores. Common ones for tech recruiting:

| Technology | UID |
|-----------|-----|
| PyTorch | `pytorch` |
| TensorFlow | `tensorflow` |
| Kubernetes | `kubernetes` |
| Apache Spark | `apache_spark` |
| AWS | `amazon_web_services` |
| GCP | `google_cloud_platform` |
| Azure | `microsoft_azure` |
| Docker | `docker` |
| React | `react` |
| Node.js | `node_js` |
| PostgreSQL | `postgresql` |
| Redis | `redis` |
| Go | `go_programming_language` |
| Rust | `rust_programming_language` |
| Python | `python` |
| TypeScript | `typescript` |
| GraphQL | `graphql` |
| Kafka | `apache_kafka` |
| Elasticsearch | `elasticsearch` |
| MongoDB | `mongodb` |
