import dotenv from "dotenv";
dotenv.config();

import { searchCandidates } from "./apollo-client";
import { extractAndScoreCandidate, extractAndScoreCandidateWithGitHub, generateOutreachEmail, generateAutoReply, generateCandidateBrief, summarizeScreeningCall } from "./claude-client";
import { findGitHubUrl, traceGitHub } from "./candidate-researcher";
import { saveCandidate, rankCandidates, getCandidate, updateCandidateAfterScreening, isCandidateAlreadyContacted } from "./nia-client";
import { sendOutreachEmail, replyInThread, startReplyListener } from "./agentmail-client";
import { createCandidateRecord, updateCandidateStatus, findCandidateByEmail } from "./airtable-client";

const SCREENING_BASE_URL = process.env.SCREENING_BASE_URL || "https://x2talent-recruiter.vercel.app/screen";

// Fetch job description from Eragon careers page
async function fetchJobDescription(jobUrl: string): Promise<string> {
  try {
    const res = await fetch(jobUrl);
    const html = await res.text();
    // Strip HTML tags and get readable text
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.substring(0, 3000);
  } catch {
    return "Machine Learning Engineer at Eragon (San Francisco, CA). Requirements: production ML experience, deep learning, Python, distributed systems.";
  }
}

export async function runSourcingPipeline(): Promise<void> {
  console.log("\n🚀 STEP 1: SOURCING + PROFILING");

  // Get job description from Airtable job URL
  const JOB_URL = "https://www.eragon.ai/careers/machine-learning-engineer";
  console.log(`Fetching job description from: ${JOB_URL}`);
  const JOB_DESCRIPTION = await fetchJobDescription(JOB_URL);
  console.log(`Job description loaded (${JOB_DESCRIPTION.length} chars)`);

  const candidates = await searchCandidates("Machine Learning Engineer", "San Francisco, CA", 20);

  for (const c of candidates) {
    if (!c.email) continue;
    const alreadyIn = await isCandidateAlreadyContacted(c.email).catch(() => false);
    if (alreadyIn) { console.log(`Skipping ${c.name} — already in pipeline`); continue; }

    try {
      const githubUrl = await findGitHubUrl(c.name, c.organization_name || c.company, c.github_url).catch(() => null);
      const githubReport = githubUrl ? await traceGitHub(githubUrl, JOB_DESCRIPTION).catch(() => "") : "";

      const extracted = githubReport
        ? await extractAndScoreCandidateWithGitHub(c, JOB_DESCRIPTION, githubReport)
        : await extractAndScoreCandidate(c, JOB_DESCRIPTION);

      if (extracted.fit_score < 5) {
        console.log(`Skipping ${extracted.name} — low fit (${extracted.fit_score}/10)`);
        continue;
      }
      if (githubUrl) extracted.github_url = githubUrl;

      const niaId = await saveCandidate({ ...extracted, status: "sourced" }).catch(() => "no-nia");
      await createCandidateRecord({ ...extracted, status: "Sourced", nia_context_id: niaId }).catch(() => {});

      console.log(`✅ ${extracted.name} — Nia Score: ${extracted.fit_score}/10${githubUrl ? " (GitHub enhanced)" : ""}`);
      await sleep(500);
    } catch (e) {
      console.error(`Failed: ${c.name}`, e);
    }
  }
}

export async function runOutreachPipeline(): Promise<void> {
  console.log("\n🚀 STEP 2: OUTREACH");
  const JOB_URL = "https://www.eragon.ai/careers/machine-learning-engineer";
  const JOB_DESCRIPTION = await fetchJobDescription(JOB_URL);
  const ranked = await rankCandidates(JOB_DESCRIPTION, 15).catch(() => []);

  for (const r of ranked) {
    const candidate = await getCandidate(r.id).catch(() => null);
    if (!candidate?.email) continue;

    try {
      const email = await generateOutreachEmail(candidate, "Machine Learning Engineer", "Eragon");
      const link = `${SCREENING_BASE_URL}?email=${encodeURIComponent(candidate.email)}&nia=${r.id}`;
      const body = email.body.replace("{{SCREENING_LINK}}", link);
      const { threadId } = await sendOutreachEmail(candidate.email, email.subject, body);
      const rec = await findCandidateByEmail(candidate.email).catch(() => null);
      if (rec?.airtable_id) {
        await updateCandidateStatus(rec.airtable_id, "Contacted", { "AgentMail Thread ID": threadId });
      }
      console.log(`📧 Emailed ${candidate.name}`);
      await sleep(1000);
    } catch (e) {
      console.error(`Outreach failed: ${candidate?.name}`, e);
    }
  }
}

export function startReplyHandler(): void {
  startReplyListener(async (message: any) => {
    const from = message.from || message.sender;
    if (!from) return;
    console.log(`\n📨 Reply from: ${from}`);
    const rec = await findCandidateByEmail(from).catch(() => null);
    if (!rec) return;
    if (rec.airtable_id) await updateCandidateStatus(rec.airtable_id, "Replied").catch(() => {});
    const link = `${SCREENING_BASE_URL}?email=${encodeURIComponent(from)}&nia=${rec.nia_context_id}`;
    const JOB_DESCRIPTION = await fetchJobDescription("https://www.eragon.ai/careers/machine-learning-engineer");
    const reply = await generateAutoReply(rec.name, message.body || "", link);
    if (rec.agentmail_thread_id) await replyInThread(rec.agentmail_thread_id, from, reply).catch(() => {});
  });
}

export async function handleScreeningCallComplete(email: string, niaId: string, transcript: string): Promise<void> {
  console.log(`\n📞 POST-CALL: ${email}`);
  const summary = await summarizeScreeningCall(email, transcript).catch(() => ({ summary: "Call completed.", key_points: [], fit_score: 5 }));
  await updateCandidateAfterScreening(niaId, summary.summary, summary.key_points?.join("; ") || "", summary.fit_score).catch(() => {});
  const rec = await findCandidateByEmail(email).catch(() => null);
  if (rec?.airtable_id) {
    await updateCandidateStatus(rec.airtable_id, "Screened", {
      "Nia Score": summary.fit_score,
      "Nia Analysis": summary.summary,
    }).catch(() => {});
  }
  console.log(`✅ Screening saved for ${email}`);
}

export async function sendWarmIntro(email: string, niaId: string): Promise<void> {
  console.log(`\n🤝 WARM INTRO: ${email}`);
  const candidate = await getCandidate(niaId);
  if (!candidate) return;
  const context = `Name: ${candidate.name}\nTitle: ${candidate.title} at ${candidate.company}\nSkills: ${candidate.key_skills?.join(", ")}\nFit: ${candidate.fit_score}/10\n${candidate.fit_notes}`;
  const brief = await generateCandidateBrief(context, "Machine Learning Engineer", "Josh");
  await sendOutreachEmail(process.env.HIRING_MANAGER_EMAIL || "hiring@eragon.ai", brief.subject, brief.body);
  const rec = await findCandidateByEmail(email).catch(() => null);
  if (rec?.airtable_id) await updateCandidateStatus(rec.airtable_id, "Intro'd").catch(() => {});
  console.log(`✅ Warm intro sent for ${candidate.name}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
