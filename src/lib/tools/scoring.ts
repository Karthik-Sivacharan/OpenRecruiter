import { tool, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const SCORING_MODEL = () => process.env.MODEL_SCORING || 'claude-opus-4-6';

const AIRTABLE_API_KEY = () => process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = () => process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID = () => process.env.AIRTABLE_TABLE_ID || '';

function airtableUrl(): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID()}/${AIRTABLE_TABLE_ID()}`;
}

function airtableHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY()}`,
    'Content-Type': 'application/json',
  };
}

// ---------------------------------------------------------------------------
// Scoring rubric — embedded in the system prompt sent to Opus
// ---------------------------------------------------------------------------

const SCORING_RUBRIC = `You are an expert technical recruiter scoring a candidate's fit for a specific role.

## Instructions

Score the candidate on a 1-10 scale based on ALL available data. Be precise and honest — never round up out of kindness.

## Scoring Dimensions

Evaluate each dimension and weight them based on the role type:

### For Engineering Roles (weight accordingly)
| Dimension | Weight | What to Evaluate |
|-----------|--------|-----------------|
| Technical skill overlap | 30% | Skills match JD requirements. Exact matches > adjacent skills. |
| Experience depth | 25% | Years in domain, seniority progression, scope of past work. |
| Code quality (GitHub/portfolio) | 20% | If analysis data exists: code organization, testing, documentation. If no data: note it. |
| Company trajectory | 15% | Caliber of past employers, industry relevance, growth trajectory. |
| Location/logistics | 10% | Location match, remote compatibility, visa considerations. |

### For Design Roles (weight accordingly)
| Dimension | Weight | What to Evaluate |
|-----------|--------|-----------------|
| Portfolio/work quality | 35% | Design quality signals from portfolio, case studies, or Nia analysis if available. |
| Tool/skill overlap | 25% | Skills and tools matching JD requirements. |
| Experience depth | 20% | Years in domain, seniority, scope of design work. |
| Company trajectory | 10% | Quality of past employers, B2B/B2C relevance. |
| Location/logistics | 10% | Location match, remote compatibility. |

### For PM/Other Roles (weight accordingly)
| Dimension | Weight | What to Evaluate |
|-----------|--------|-----------------|
| Domain expertise | 30% | Relevant industry and product experience. |
| Experience depth | 25% | Years, seniority, scope of past work. |
| Skill overlap | 20% | Skills matching JD requirements. |
| Company trajectory | 15% | Quality and relevance of past employers. |
| Location/logistics | 10% | Location match, remote compatibility. |

## Score Definitions

| Score | Meaning | Action |
|-------|---------|--------|
| 9-10 | Exceptional match. Nearly all requirements met. Strong signals. | Outreach immediately. |
| 7-8 | Strong match. Most requirements met. Solid evidence of relevant work. | Outreach recommended. |
| 5-6 | Moderate match. Some requirements met. Worth considering. | Outreach if pipeline is thin. |
| 3-4 | Weak match. Few requirements met. Missing key skills. | Skip unless recruiter insists. |
| 1-2 | Not a match. Wrong domain, level, or disqualifying gaps. | Do not outreach. |

## Output Format

You MUST respond with ONLY valid JSON in this exact format:
{
  "fit_score": <number 1-10>,
  "fit_rationale": "<3-5 sentences: overall assessment, key strengths, key gaps, and recommendation>"
}

Do NOT include any text outside the JSON object.`;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ScoringResponseSchema = z.object({
  fit_score: z.number().min(1).max(10),
  fit_rationale: z.string(),
});

const CandidateToScore = z.object({
  record_id: z.string().describe('Airtable record ID (e.g. "recXXX")'),
  name: z.string().describe('Candidate full name'),
  data: z
    .string()
    .describe('ALL available candidate data as readable text: title, company, employment history, skills, education, certifications, experiences, summary, portfolio URL, GitHub URL, Nia analysis (if available).'),
});

// ---------------------------------------------------------------------------
// Internal: score one candidate via Opus
// ---------------------------------------------------------------------------

interface ScoreResult {
  record_id: string;
  candidate_name: string;
  fit_score: number | null;
  fit_rationale: string;
  status: 'scored' | 'error';
}

async function scoreOne(
  candidate: { record_id: string; name: string; data: string },
  jobDescription: string,
  roleType: string,
): Promise<ScoreResult> {
  const userPrompt = `## Role Type: ${roleType}

## Job Description
${jobDescription}

## Candidate: ${candidate.name}
${candidate.data}

Score this candidate's fit for the role. Respond with JSON only.`;

  try {
    const result = await generateText({
      model: anthropic(SCORING_MODEL()),
      system: SCORING_RUBRIC,
      prompt: userPrompt,
      maxOutputTokens: 1024,
    });

    const text = result.text.trim();
    const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const parsed = ScoringResponseSchema.safeParse(JSON.parse(jsonStr));

    if (!parsed.success) {
      console.error(`Scoring parse error for ${candidate.name}: ${parsed.error.message}`);
      return {
        record_id: candidate.record_id,
        candidate_name: candidate.name,
        fit_score: null,
        fit_rationale: `Scoring failed: could not parse response. Raw: ${text.slice(0, 200)}`,
        status: 'error',
      };
    }

    return {
      record_id: candidate.record_id,
      candidate_name: candidate.name,
      fit_score: parsed.data.fit_score,
      fit_rationale: parsed.data.fit_rationale,
      status: 'scored',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Scoring error for ${candidate.name}: ${message}`);
    return {
      record_id: candidate.record_id,
      candidate_name: candidate.name,
      fit_score: null,
      fit_rationale: `Scoring failed: ${message}`,
      status: 'error',
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: update Airtable with score
// ---------------------------------------------------------------------------

async function updateAirtableScore(result: ScoreResult): Promise<void> {
  const fields: Record<string, unknown> = {
    'Pipeline Stage': 'Scored',
  };
  if (result.fit_score != null) fields['Fit Score'] = result.fit_score;
  if (result.fit_rationale) fields['Fit Rationale'] = result.fit_rationale;

  const response = await fetch(airtableUrl(), {
    method: 'PATCH',
    headers: airtableHeaders(),
    body: JSON.stringify({
      typecast: true,
      records: [{ id: result.record_id, fields }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Airtable update error for ${result.candidate_name}: ${response.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// scoreCandidates — batch tool: score all + update Airtable in one call
// ---------------------------------------------------------------------------

export const scoreCandidates = tool({
  description:
    'Score ALL candidates for a role in one call. Internally calls Opus for each candidate, then updates Airtable with Fit Score + Fit Rationale + stage "Scored". Returns a summary sorted by score. Call this ONCE with all candidates after enrichment is complete.',
  inputSchema: z.object({
    candidates: z
      .array(CandidateToScore)
      .min(1)
      .max(50)
      .describe('Array of candidates to score. Each needs record_id, name, and data (all available profile text).'),
    job_description: z
      .string()
      .describe('The full job description text or concise summary of key requirements.'),
    role_type: z
      .enum(['engineering', 'design', 'pm', 'other'])
      .describe('The type of role, used to weight scoring dimensions.'),
  }),
  execute: async ({ candidates, job_description, role_type }) => {
    const results: ScoreResult[] = [];

    // Dynamic batch size: up to 10 parallel Opus calls per batch
    // For ≤10 candidates, all run in one batch. For more, chunks of 10.
    const BATCH_SIZE = Math.min(10, candidates.length);
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((c) => scoreOne(c, job_description, role_type)),
      );

      for (let j = 0; j < batchResults.length; j++) {
        const br = batchResults[j];
        if (br.status === 'fulfilled') {
          results.push(br.value);
        } else {
          results.push({
            record_id: batch[j].record_id,
            candidate_name: batch[j].name,
            fit_score: null,
            fit_rationale: `Scoring failed: ${br.reason instanceof Error ? br.reason.message : String(br.reason)}`,
            status: 'error',
          });
        }
      }

      // Update Airtable for this batch
      await Promise.allSettled(
        results.slice(i, i + batch.length).map(updateAirtableScore),
      );
    }

    // Sort by score descending
    const sorted = [...results].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
    const scored = results.filter((r) => r.status === 'scored').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return {
      total: results.length,
      scored,
      failed,
      results: sorted.map((r) => ({
        name: r.candidate_name,
        fit_score: r.fit_score,
        fit_rationale: r.fit_rationale,
        status: r.status,
      })),
    };
  },
});
