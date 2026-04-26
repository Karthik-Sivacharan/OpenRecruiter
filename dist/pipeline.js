"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSourcingPipeline = runSourcingPipeline;
exports.runOutreachPipeline = runOutreachPipeline;
exports.startReplyHandler = startReplyHandler;
exports.handleScreeningCallComplete = handleScreeningCallComplete;
exports.sendWarmIntro = sendWarmIntro;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apollo_client_1 = require("./apollo-client");
const claude_client_1 = require("./claude-client");
const candidate_researcher_1 = require("./candidate-researcher");
const nia_client_1 = require("./nia-client");
const agentmail_client_1 = require("./agentmail-client");
const airtable_client_1 = require("./airtable-client");
const JOB_DESCRIPTION = `Product Designer at Eragon (San Francisco, CA)
We need a Product Designer to shape AI-powered developer tools.
Requirements: 3+ years product design, strong B2B SaaS portfolio, Figma proficiency, design systems experience, user research.`;
const SCREENING_BASE_URL = process.env.SCREENING_BASE_URL || "https://x2talent-recruiter.vercel.app/screen";
async function runSourcingPipeline() {
    console.log("\n🚀 STEP 1: SOURCING + PROFILING");
    const candidates = await (0, apollo_client_1.searchCandidates)("Product Designer", "San Francisco, CA", 20);
    for (const c of candidates) {
        if (!c.email)
            continue;
        const alreadyIn = await (0, nia_client_1.isCandidateAlreadyContacted)(c.email).catch(() => false);
        if (alreadyIn) {
            console.log(`Skipping ${c.name} — already in pipeline`);
            continue;
        }
        try {
            const extracted = await (0, claude_client_1.extractAndScoreCandidate)(c, JOB_DESCRIPTION);
            if (extracted.fit_score < 5) {
                console.log(`Skipping ${extracted.name} — low fit (${extracted.fit_score}/10)`);
                continue;
            }
            const githubUrl = await (0, candidate_researcher_1.findGitHubUrl)(c.name, c.organization_name || c.company, c.github_url).catch(() => null);
            if (githubUrl) {
                extracted.github_url = githubUrl;
                const githubReport = await (0, candidate_researcher_1.traceGitHub)(githubUrl, JOB_DESCRIPTION).catch(() => "");
                if (githubReport)
                    extracted.fit_notes = `${extracted.fit_notes} | GitHub: ${githubReport.substring(0, 150)}`;
            }
            const niaId = await (0, nia_client_1.saveCandidate)({ ...extracted, status: "sourced" }).catch(() => "no-nia");
            await (0, airtable_client_1.createCandidateRecord)({ ...extracted, status: "Sourced", nia_context_id: niaId }).catch(() => { });
            console.log(`✅ ${extracted.name} — fit: ${extracted.fit_score}/10${githubUrl ? " (GitHub found)" : ""}`);
            await sleep(500);
        }
        catch (e) {
            console.error(`Failed: ${c.name}`, e);
        }
    }
}
async function runOutreachPipeline() {
    console.log("\n🚀 STEP 2: OUTREACH");
    const ranked = await (0, nia_client_1.rankCandidates)(JOB_DESCRIPTION, 15).catch(() => []);
    for (const r of ranked) {
        const candidate = await (0, nia_client_1.getCandidate)(r.id).catch(() => null);
        if (!candidate?.email)
            continue;
        try {
            const email = await (0, claude_client_1.generateOutreachEmail)(candidate, "Product Designer", "Eragon");
            const link = `${SCREENING_BASE_URL}?email=${encodeURIComponent(candidate.email)}&nia=${r.id}`;
            const body = email.body.replace("{{SCREENING_LINK}}", link);
            const { threadId } = await (0, agentmail_client_1.sendOutreachEmail)(candidate.email, email.subject, body);
            const rec = await (0, airtable_client_1.findCandidateByEmail)(candidate.email).catch(() => null);
            if (rec?.airtable_id) {
                await (0, airtable_client_1.updateCandidateStatus)(rec.airtable_id, "Contacted", { "AgentMail Thread ID": threadId });
            }
            console.log(`📧 Emailed ${candidate.name}`);
            await sleep(1000);
        }
        catch (e) {
            console.error(`Outreach failed: ${candidate?.name}`, e);
        }
    }
}
function startReplyHandler() {
    (0, agentmail_client_1.startReplyListener)(async (message) => {
        const from = message.from || message.sender;
        if (!from)
            return;
        console.log(`\n📨 Reply from: ${from}`);
        const rec = await (0, airtable_client_1.findCandidateByEmail)(from).catch(() => null);
        if (!rec)
            return;
        if (rec.airtable_id)
            await (0, airtable_client_1.updateCandidateStatus)(rec.airtable_id, "Replied").catch(() => { });
        const link = `${SCREENING_BASE_URL}?email=${encodeURIComponent(from)}&nia=${rec.nia_context_id}`;
        const reply = await (0, claude_client_1.generateAutoReply)(rec.name, message.body || "", link);
        if (rec.agentmail_thread_id)
            await (0, agentmail_client_1.replyInThread)(rec.agentmail_thread_id, from, reply).catch(() => { });
    });
}
async function handleScreeningCallComplete(email, niaId, transcript) {
    console.log(`\n📞 POST-CALL: ${email}`);
    const summary = await (0, claude_client_1.summarizeScreeningCall)(email, transcript).catch(() => ({ summary: "Call completed.", key_points: [], fit_score: 5 }));
    await (0, nia_client_1.updateCandidateAfterScreening)(niaId, summary.summary, summary.key_points?.join("; ") || "", summary.fit_score).catch(() => { });
    const rec = await (0, airtable_client_1.findCandidateByEmail)(email).catch(() => null);
    if (rec?.airtable_id) {
        await (0, airtable_client_1.updateCandidateStatus)(rec.airtable_id, "Screened", {
            "Notes": `Fit: ${summary.fit_score}/10 | ${summary.summary}`
        }).catch(() => { });
    }
    console.log(`✅ Screening saved for ${email}`);
}
async function sendWarmIntro(email, niaId) {
    console.log(`\n🤝 WARM INTRO: ${email}`);
    const candidate = await (0, nia_client_1.getCandidate)(niaId);
    if (!candidate)
        return;
    const context = `Name: ${candidate.name}\nTitle: ${candidate.title} at ${candidate.company}\nSkills: ${candidate.key_skills?.join(", ")}\nFit: ${candidate.fit_score}/10\n${candidate.fit_notes}`;
    const brief = await (0, claude_client_1.generateCandidateBrief)(context, "Product Designer", "Josh");
    await (0, agentmail_client_1.sendOutreachEmail)(process.env.HIRING_MANAGER_EMAIL || "hiring@eragon.ai", brief.subject, brief.body);
    const rec = await (0, airtable_client_1.findCandidateByEmail)(email).catch(() => null);
    if (rec?.airtable_id)
        await (0, airtable_client_1.updateCandidateStatus)(rec.airtable_id, "Intro'd").catch(() => { });
    console.log(`✅ Warm intro sent for ${candidate.name}`);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
