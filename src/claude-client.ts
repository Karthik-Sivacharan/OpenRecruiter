import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function extractAndScoreCandidate(apolloRaw: any, jobDescription: string): Promise<any> {
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

export async function generateOutreachEmail(candidate: any, jobTitle: string, companyName: string): Promise<any> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: `Write a short personalized recruiting outreach email. Respond ONLY with JSON: {"subject":"","body":""}. Include {{SCREENING_LINK}} in the body.`,
    messages: [{ role: "user", content: `Write outreach for ${candidate.name} (${candidate.title} at ${candidate.company}) for ${jobTitle} at ${companyName}. Their skills: ${candidate.key_skills?.join(", ")}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function generateAutoReply(candidateName: string, reply: string, screeningLink: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You are a recruiter. Write a short warm reply acknowledging their interest and sharing the screening link. Just the email body text.`,
    messages: [{ role: "user", content: `${candidateName} replied: "${reply}"\n\nScreening link: ${screeningLink}` }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function summarizeScreeningCall(name: string, transcript: string): Promise<any> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `Summarize a screening call. Respond ONLY with JSON: {"summary":"","fit_score":0,"key_points":[]}`,
    messages: [{ role: "user", content: `Summarize screening call for ${name}:\n${transcript}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function generateCandidateBrief(context: string, jobTitle: string, hiringManager: string): Promise<any> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `Write a warm intro email to a hiring manager. Respond ONLY with JSON: {"subject":"","body":""}`,
    messages: [{ role: "user", content: `Write warm intro to ${hiringManager} for ${jobTitle}.\n\nCandidate:\n${context}` }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
