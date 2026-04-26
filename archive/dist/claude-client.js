"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAndScoreCandidate = extractAndScoreCandidate;
exports.generateOutreachEmail = generateOutreachEmail;
exports.generateAutoReply = generateAutoReply;
exports.summarizeScreeningCall = summarizeScreeningCall;
exports.generateCandidateBrief = generateCandidateBrief;
exports.extractAndScoreCandidateWithGitHub = extractAndScoreCandidateWithGitHub;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
async function extractAndScoreCandidate(apolloRaw, jobDescription) {
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are a recruiting analyst. Extract candidate info and score fit for the job.
Respond ONLY with valid JSON, no markdown:
{"name":"","email":"","title":"","company":"","linkedin":"","location":"","key_skills":[],"fit_notes":"","fit_score":0}`,
        messages: [{ role: "user", content: `Job:\n${jobDescription}\n\nCandidate:\n${JSON.stringify(apolloRaw)}` }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}
async function generateOutreachEmail(candidate, jobTitle, companyName) {
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: `Write a short personalized recruiting outreach email. Respond ONLY with JSON: {"subject":"","body":""}. Include {{SCREENING_LINK}} in the body.`,
        messages: [{ role: "user", content: `Write outreach for ${candidate.name} (${candidate.title} at ${candidate.company}) for ${jobTitle} at ${companyName}. Their skills: ${candidate.key_skills?.join(", ")}` }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}
async function generateAutoReply(candidateName, reply, screeningLink) {
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `You are a recruiter. Write a short warm reply acknowledging their interest and sharing the screening link. Just the email body text.`,
        messages: [{ role: "user", content: `${candidateName} replied: "${reply}"\n\nScreening link: ${screeningLink}` }],
    });
    return response.content[0].type === "text" ? response.content[0].text : "";
}
async function summarizeScreeningCall(name, transcript) {
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: `Summarize a screening call. Respond ONLY with JSON: {"summary":"","fit_score":0,"key_points":[]}`,
        messages: [{ role: "user", content: `Summarize screening call for ${name}:\n${transcript}` }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}
async function generateCandidateBrief(context, jobTitle, hiringManager) {
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: `Write a warm intro email to a hiring manager. Respond ONLY with JSON: {"subject":"","body":""}`,
        messages: [{ role: "user", content: `Write warm intro to ${hiringManager} for ${jobTitle}.\n\nCandidate:\n${context}` }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}
// Enhanced scoring with GitHub research from Nia Tracer
async function extractAndScoreCandidateWithGitHub(apolloRaw, jobDescription, githubReport) {
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are a recruiting analyst. Extract candidate info and score their fit.
Respond ONLY with valid JSON, no markdown:
{"name":"","email":"","title":"","company":"","linkedin":"","location":"","key_skills":[],"fit_notes":"","fit_score":0,"github_highlights":""}
fit_score is 1-10. If GitHub data is provided, factor actual work quality into the score.`,
        messages: [{
                role: "user",
                content: `Job:\n${jobDescription}\n\nCandidate:\n${JSON.stringify(apolloRaw)}\n\n${githubReport ? `GitHub Research:\n${githubReport}` : "No GitHub data available."}`
            }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}
