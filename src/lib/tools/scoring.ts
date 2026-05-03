import { tool, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import mammoth from 'mammoth';
import { SCORING_RUBRIC } from '@/lib/prompts/scoring-rubric';

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
// Zod schemas
// ---------------------------------------------------------------------------

const ScoringResponseSchema = z.object({
  fit_score: z.number().min(1).max(10),
  fit_rationale: z.string(),
});

// ---------------------------------------------------------------------------
// Internal: fetch candidates from Airtable by role
// ---------------------------------------------------------------------------

interface AirtableRecordScoring {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableFetchByRoleScoring(
  role: string,
  extraFilter?: string,
): Promise<AirtableRecordScoring[]> {
  const records: AirtableRecordScoring[] = [];
  let offset: string | undefined;
  const baseFormula = extraFilter
    ? `AND({Role}='${role}',${extraFilter})`
    : `{Role}='${role}'`;

  do {
    const params = new URLSearchParams({ filterByFormula: baseFormula });
    if (offset) params.set('offset', offset);
    const response = await fetch(`${airtableUrl()}?${params.toString()}`, {
      headers: airtableHeaders(),
    });
    if (!response.ok) break;
    const data = await response.json();
    for (const rec of data.records ?? []) {
      records.push({ id: rec.id, fields: rec.fields ?? {} });
    }
    offset = data.offset;
  } while (offset);

  return records;
}

// ---------------------------------------------------------------------------
// Intake Notes parser - known labels extracted into structured fields
// ---------------------------------------------------------------------------

const INTAKE_LABELS = [
  'Years of Experience',
  'Work Authorization',
  'Work Authorization (US)',
  'Salary Range',
  'Salary Expectation',
  'Work Preference',
  'Employment Type',
  'Roles Interested',
  'AI Tools',
  'Tools',
  'Referred By',
  'Referral Source',
  'Notice Period',
  'Visa Status',
  'Current Location',
  'Preferred Location',
  'Available Start Date',
  'Start Date',
] as const;

interface ParsedIntakeNotes {
  structured: Record<string, string>;
  bio: string | null;
  additionalNotes: string | null;
}

function parseIntakeNotes(raw: string): ParsedIntakeNotes {
  const structured: Record<string, string> = {};
  const remainingLines: string[] = [];
  const bioLines: string[] = [];
  let inBio = false;

  const labelsLower = INTAKE_LABELS.map((l) => l.toLowerCase());

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inBio) bioLines.push('');
      continue;
    }

    if (/^bio\s*:/i.test(trimmed)) {
      inBio = true;
      const bioValue = trimmed.replace(/^bio\s*:\s*/i, '').trim();
      if (bioValue) bioLines.push(bioValue);
      continue;
    }

    if (inBio) {
      bioLines.push(trimmed);
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const candidateLabel = trimmed.slice(0, colonIdx).trim();
      const candidateLabelLower = candidateLabel.toLowerCase();
      const matchIdx = labelsLower.findIndex((l) => candidateLabelLower === l);
      if (matchIdx !== -1) {
        const value = trimmed.slice(colonIdx + 1).trim();
        if (value) {
          structured[INTAKE_LABELS[matchIdx]] = value;
        }
        continue;
      }
    }

    remainingLines.push(trimmed);
  }

  return {
    structured,
    bio: bioLines.length > 0 ? bioLines.join('\n').trim() : null,
    additionalNotes: remainingLines.length > 0 ? remainingLines.join('\n').trim() : null,
  };
}

// ---------------------------------------------------------------------------
// Employment deduplication - merge Apollo Employment History + EnrichLayer
// ---------------------------------------------------------------------------

interface ParsedJob {
  title: string;
  company: string;
  source: 'apollo' | 'enrichlayer';
}

function normalizeForComparison(str: string): string {
  return str.toLowerCase().trim().replace(/[.,\-()]/g, '').replace(/\s+/g, ' ');
}

function parseEmploymentLine(line: string, source: 'apollo' | 'enrichlayer'): ParsedJob | null {
  const atMatch = line.match(/^(.+?)\s*@\s*(.+?)(?:\s*\((.+)\))?$/);
  if (atMatch) {
    return {
      title: atMatch[1].trim(),
      company: atMatch[2].trim(),
      source,
    };
  }
  return null;
}

function deduplicateWorkHistory(
  apolloHistory: string | undefined,
  enrichLayerExperiences: string | undefined,
): string | null {
  if (!apolloHistory && !enrichLayerExperiences) return null;
  if (!apolloHistory) return enrichLayerExperiences?.trim() ?? null;
  if (!enrichLayerExperiences) return apolloHistory.trim();

  const enrichEntries: Array<{ header: ParsedJob; fullText: string }> = [];
  const enrichBlocks = enrichLayerExperiences.split(/\n(?=\S)/);
  for (const block of enrichBlocks) {
    const firstLine = block.split('\n')[0].trim();
    const parsed = parseEmploymentLine(firstLine, 'enrichlayer');
    if (parsed) {
      enrichEntries.push({ header: parsed, fullText: block.trim() });
    }
  }

  const apolloEntries: Array<{ header: ParsedJob; fullText: string }> = [];
  for (const line of apolloHistory.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseEmploymentLine(trimmed, 'apollo');
    if (parsed) {
      apolloEntries.push({ header: parsed, fullText: trimmed });
    }
  }

  // Keep all EnrichLayer entries. Only add Apollo entries without a match.
  const result: string[] = enrichEntries.map((e) => e.fullText);

  for (const apolloEntry of apolloEntries) {
    const apolloTitle = normalizeForComparison(apolloEntry.header.title);
    const apolloCompany = normalizeForComparison(apolloEntry.header.company);

    const isDuplicate = enrichEntries.some((enrichEntry) => {
      const enrichTitle = normalizeForComparison(enrichEntry.header.title);
      const enrichCompany = normalizeForComparison(enrichEntry.header.company);
      return enrichTitle === apolloTitle && enrichCompany === apolloCompany;
    });

    if (!isDuplicate) {
      result.push(apolloEntry.fullText);
    }
  }

  return result.length > 0 ? result.join('\n') : null;
}

// ---------------------------------------------------------------------------
// Build structured candidate profile for Opus scoring
// ---------------------------------------------------------------------------

function buildStructuredCandidateProfile(fields: Record<string, unknown>): string {
  const sections: string[] = [];

  const str = (key: string): string | undefined => {
    const val = fields[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
    return undefined;
  };

  const num = (key: string): number | undefined => {
    const val = fields[key];
    if (typeof val === 'number') return val;
    return undefined;
  };

  // --- Candidate source ---
  // Inbound detection: candidates who applied have Intake Notes (from intake form).
  // We can't rely on Pipeline Stage because enrichment changes 'Imported' to 'Enriched'
  // before scoring runs. Intake Notes presence is a stable signal that never gets overwritten.
  const hasIntakeNotes = Boolean(str('Intake Notes'));
  const hasResume = Array.isArray(fields['Resume']) && (fields['Resume'] as unknown[]).length > 0;
  const isInbound = hasIntakeNotes || hasResume;
  sections.push(
    isInbound
      ? '## Candidate Source: INBOUND (applied via intake form)'
      : '## Candidate Source: OUTBOUND (sourced via Apollo search)',
  );

  // --- Verified Profile Data ---
  const profileLines: string[] = [];
  const addProfile = (label: string, value: string | number | undefined) => {
    if (value !== undefined) profileLines.push(`${label}: ${value}`);
  };

  addProfile('Title', str('Title'));
  addProfile('Company', str('Current Company'));

  const city = str('City');
  const state = str('State');
  const country = str('Country');
  const locationParts = [city, state, country].filter(Boolean);
  if (locationParts.length > 0) {
    profileLines.push(`Location: ${locationParts.join(', ')}`);
  }

  addProfile('Headline', str('Headline'));
  addProfile('Seniority', str('Seniority'));
  addProfile('Department', str('Department'));
  addProfile('Skills', str('Skills'));
  addProfile('Education', str('Education'));
  addProfile('Certifications', str('Certifications'));
  addProfile('Summary', str('Summary'));
  addProfile('Languages', str('Languages'));
  addProfile('Recommendations', str('Recommendations'));
  addProfile('Current Company Industry', str('Current Company Industry'));
  addProfile('Current Company Size', num('Current Company Size'));
  addProfile('Current Company Description', str('Current Company Description'));

  const workHistory = deduplicateWorkHistory(str('Employment History'), str('EnrichLayer Experiences'));
  if (workHistory) {
    profileLines.push(`Work History:\n${workHistory}`);
  }

  if (profileLines.length > 0) {
    sections.push(`## Verified Profile Data (from Apollo + EnrichLayer)\n${profileLines.join('\n')}`);
  }

  // --- Self-Reported Data ---
  const intakeNotesRaw = str('Intake Notes');
  if (intakeNotesRaw) {
    const parsed = parseIntakeNotes(intakeNotesRaw);
    const selfReportedLines: string[] = [];

    const orderedLabels = [
      'Salary Range', 'Salary Expectation',
      'Work Authorization', 'Work Authorization (US)',
      'Years of Experience',
      'Work Preference',
      'Employment Type',
      'Roles Interested',
      'AI Tools', 'Tools',
      'Notice Period',
      'Visa Status',
      'Current Location', 'Preferred Location',
      'Available Start Date', 'Start Date',
      'Referred By', 'Referral Source',
    ];

    for (const label of orderedLabels) {
      if (parsed.structured[label]) {
        selfReportedLines.push(`${label}: ${parsed.structured[label]}`);
      }
    }

    for (const [label, value] of Object.entries(parsed.structured)) {
      if (!orderedLabels.includes(label)) {
        selfReportedLines.push(`${label}: ${value}`);
      }
    }

    if (parsed.bio) {
      selfReportedLines.push(`Candidate Bio: ${parsed.bio}`);
    }
    if (parsed.additionalNotes) {
      selfReportedLines.push(`Additional Notes: ${parsed.additionalNotes}`);
    }

    if (selfReportedLines.length > 0) {
      sections.push(`## Self-Reported Data (from candidate application)\n${selfReportedLines.join('\n')}`);
    }
  }

  // --- Web Presence ---
  const webLines: string[] = [];
  const missingLines: string[] = [];

  const githubUrl = str('GitHub URL');
  const personalWebsite = str('Personal Website');
  const linkedinUrl = str('LinkedIn URL');
  const niaAnalysis = str('Nia Analysis');
  const niaSummary = str('Nia Summary');

  if (linkedinUrl) webLines.push(`LinkedIn: ${linkedinUrl}`);
  if (githubUrl) {
    webLines.push(`GitHub: ${githubUrl}`);
  } else {
    missingLines.push('GitHub: NOT PROVIDED');
  }
  if (personalWebsite) {
    webLines.push(`Personal Website: ${personalWebsite}`);
  } else {
    missingLines.push('Portfolio/Personal Website: NOT PROVIDED - candidate did not share a portfolio link');
  }
  if (niaAnalysis) webLines.push(`Portfolio/Code Analysis:\n${niaAnalysis}`);
  if (niaSummary) webLines.push(`Analysis Summary: ${niaSummary}`);

  if (webLines.length > 0) {
    sections.push(`## Web Presence\n${webLines.join('\n')}`);
  }

  // --- Missing Data ---
  if (missingLines.length > 0) {
    sections.push(`## Missing Data\n${missingLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Internal: extract resume attachment info from Airtable
// ---------------------------------------------------------------------------

interface ResumeAttachment {
  url: string;
  filename: string;
}

function extractResumeAttachment(fields: Record<string, unknown>): ResumeAttachment | undefined {
  const resume = fields['Resume'];
  if (!Array.isArray(resume) || resume.length === 0) return undefined;
  const first = resume[0];
  if (typeof first === 'object' && first !== null && 'url' in first && 'filename' in first) {
    return { url: (first as ResumeAttachment).url, filename: (first as ResumeAttachment).filename };
  }
  if (typeof first === 'object' && first !== null && 'url' in first) {
    return { url: (first as { url: string }).url, filename: 'resume.pdf' };
  }
  return undefined;
}

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
  candidate: { record_id: string; name: string; data: string; resume?: ResumeAttachment },
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
    const content: Array<
      | { type: 'file'; data: Buffer; mediaType: 'application/pdf' }
      | { type: 'text'; text: string }
    > = [];

    let finalPrompt = userPrompt;

    // Attach resume based on file type
    if (candidate.resume) {
      const ext = candidate.resume.filename.toLowerCase().split('.').pop() ?? '';
      try {
        const res = await fetch(candidate.resume.url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (ext === 'pdf') {
            content.push({ type: 'file', data: buffer, mediaType: 'application/pdf' as const });
          } else if (ext === 'docx' || ext === 'doc') {
            const { value: resumeText } = await mammoth.extractRawText({ buffer });
            if (resumeText.trim()) {
              finalPrompt = `## Resume Content (extracted from DOCX)\n${resumeText.trim()}\n\n${finalPrompt}`;
            }
          } else {
            console.warn(`Unsupported resume format for ${candidate.name}: .${ext}`);
          }
        }
      } catch {
        // Resume fetch/parse failed, continue without it
      }
    }

    content.push({ type: 'text', text: finalPrompt });

    const result = await generateText({
      model: anthropic(SCORING_MODEL()),
      system: SCORING_RUBRIC,
      messages: [{ role: 'user', content }],
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
// scoreCandidates - batch tool: score all + update Airtable in one call
// ---------------------------------------------------------------------------

export const scoreCandidates = tool({
  description:
    'Score ALL unscored candidates for a role. Internally fetches candidates from Airtable (Pipeline Stage "Enriched" or "Imported"), builds structured profile data, calls Opus for scoring, and writes Fit Score + Fit Rationale + stage "Scored" back to Airtable. Call ONCE with just the role name, JD, and role type.',
  inputSchema: z.object({
    role: z.string().describe('The role name (e.g. "Senior Product Designer")'),
    job_description: z
      .string()
      .describe('The full job description text or concise summary of key requirements.'),
    role_type: z
      .enum(['engineering', 'design', 'pm', 'other'])
      .describe('The type of role, used to weight scoring dimensions.'),
  }),
  execute: async ({ role, job_description, role_type }) => {
    // 1. Fetch unscored candidates from Airtable (both Enriched and Imported)
    const records = await airtableFetchByRoleScoring(role, `OR({Pipeline Stage}='Enriched',{Pipeline Stage}='Imported')`);

    if (records.length === 0) {
      return { total: 0, scored: 0, failed: 0, results: [], message: 'No unscored candidates found for this role.' };
    }

    // 2. Build candidate data from Airtable fields
    const candidates = records.map((r) => ({
      record_id: r.id,
      name: (r.fields['Name'] as string) ?? 'Unknown',
      data: buildStructuredCandidateProfile(r.fields),
      resume: extractResumeAttachment(r.fields),
    }));

    // 3. Score in parallel batches
    const results: ScoreResult[] = [];
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

    // 4. Sort by score descending
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
