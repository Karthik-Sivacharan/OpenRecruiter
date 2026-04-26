"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCandidate = saveCandidate;
exports.rankCandidates = rankCandidates;
exports.getCandidate = getCandidate;
exports.updateCandidateAfterScreening = updateCandidateAfterScreening;
exports.isCandidateAlreadyContacted = isCandidateAlreadyContacted;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const NIA_BASE = "https://apigcp.trynia.ai";
const headers = () => ({ Authorization: `Bearer ${process.env.NIA_API_KEY}`, "Content-Type": "application/json" });
async function saveCandidate(c) {
    const res = await fetch(`${NIA_BASE}/contexts`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({
            title: `${c.name} - ${c.title} at ${c.company}`,
            content: `Name: ${c.name}\nEmail: ${c.email}\nTitle: ${c.title}\nCompany: ${c.company}\nSkills: ${c.key_skills?.join(", ")}\nFit Score: ${c.fit_score}/10\nFit Notes: ${c.fit_notes}\nStatus: ${c.status || "sourced"}`,
            tags: `candidate:${c.name?.replace(/\s+/g, "_").toLowerCase()},role:product-designer,status:sourced`,
            agent_source: "open-recruiter", memory_type: "fact"
        })
    });
    const data = await res.json();
    console.log(`Saved to Nia: ${c.name} (${data.id})`);
    return data.id;
}
async function rankCandidates(jobDescription, limit = 15) {
    const res = await fetch(`${NIA_BASE}/contexts/semantic-search?q=${encodeURIComponent(jobDescription)}&limit=${limit}&include_highlights=true`, { headers: headers() });
    const data = await res.json();
    return (data.results || data.contexts || []).map((r) => ({ id: r.id, title: r.title, score: r.score || 0 }));
}
async function getCandidate(id) {
    const res = await fetch(`${NIA_BASE}/contexts/${id}`, { headers: headers() });
    if (!res.ok)
        return null;
    const data = await res.json();
    const lines = {};
    (data.content || "").split("\n").forEach((l) => { const [k, ...v] = l.split(": "); if (k)
        lines[k.trim()] = v.join(": ").trim(); });
    return { id: data.id, name: lines["Name"], email: lines["Email"], title: lines["Title"], company: lines["Company"], key_skills: (lines["Skills"] || "").split(", "), fit_score: parseInt(lines["Fit Score"] || "5"), fit_notes: lines["Fit Notes"], status: lines["Status"] || "sourced" };
}
async function updateCandidateAfterScreening(id, transcript, notes, fitScore) {
    const curr = await fetch(`${NIA_BASE}/contexts/${id}`, { headers: headers() }).then(r => r.json());
    await fetch(`${NIA_BASE}/contexts/${id}`, {
        method: "PUT", headers: headers(),
        body: JSON.stringify({ content: curr.content + `\n\n--- SCREENING ---\n${transcript}\nNotes: ${notes}\nFit: ${fitScore}/10`, tags: `status:screened,fit:${fitScore >= 7 ? "strong" : "weak"}` })
    });
}
async function isCandidateAlreadyContacted(email) {
    const res = await fetch(`${NIA_BASE}/contexts/search?q=${encodeURIComponent(email)}&agent_source=open-recruiter&limit=3`, { headers: headers() });
    const data = await res.json();
    return (data.results || data.contexts || []).some((r) => r.content?.includes(email));
}
