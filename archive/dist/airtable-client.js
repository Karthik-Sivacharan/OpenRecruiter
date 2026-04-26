"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCandidateRecord = createCandidateRecord;
exports.updateCandidateStatus = updateCandidateStatus;
exports.findCandidateByEmail = findCandidateByEmail;
const airtable_1 = __importDefault(require("airtable"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let base;
function getBase() {
    if (!base) {
        airtable_1.default.configure({ apiKey: process.env.AIRTABLE_API_KEY });
        base = airtable_1.default.base(process.env.AIRTABLE_BASE_ID);
    }
    return base;
}
const TABLE = () => process.env.AIRTABLE_CANDIDATES_TABLE || "Candidates";
async function createCandidateRecord(c) {
    if (!process.env.AIRTABLE_API_KEY) {
        console.log("No Airtable key — skipping CRM");
        return "no-airtable";
    }
    try {
        // Check if candidate already exists
        const existing = await findCandidateByEmail(c.email);
        if (existing?.airtable_id) {
            console.log(`Airtable: ${c.name} already exists — updating`);
            await updateCandidateStatus(existing.airtable_id, c.status || "Sourced", {
                "Notes": c.fit_notes || "",
            });
            return existing.airtable_id;
        }
        const record = await getBase()(TABLE()).create({
            "Candidate Name": c.name,
            "Email": c.email,
            "Current Company": c.company,
            "Current Role / Title": c.title,
            "LinkedIn": c.linkedin || "",
            "Pipeline Stage": c.status || "Sourced",
            "Notes": c.fit_notes || "",
            "GitHub URL": c.github_url || "",
            "Skills": c.key_skills?.join(", ") || "",
        });
        console.log(`Airtable: ${c.name} added (${record.id})`);
        return record.id;
    }
    catch (e) {
        console.log(`Airtable create failed: ${e.message}`);
        return "no-airtable";
    }
}
async function updateCandidateStatus(id, status, extra) {
    if (!process.env.AIRTABLE_API_KEY || id === "no-airtable")
        return;
    try {
        await getBase()(TABLE()).update(id, { "Pipeline Stage": status, ...extra });
        console.log(`Airtable: ${id} updated to ${status}`);
    }
    catch (e) {
        console.log(`Airtable update failed: ${e.message}`);
    }
}
async function findCandidateByEmail(email) {
    if (!process.env.AIRTABLE_API_KEY || !email)
        return null;
    try {
        const records = await getBase()(TABLE())
            .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
            .firstPage();
        if (!records.length)
            return null;
        const r = records[0];
        return {
            airtable_id: r.id,
            name: r.get("Candidate Name"),
            email: r.get("Email"),
            company: r.get("Current Company"),
            title: r.get("Current Role / Title"),
            status: r.get("Pipeline Stage"),
            nia_context_id: r.get("Notes"),
            agentmail_thread_id: r.get("Notes"),
        };
    }
    catch (e) {
        console.log(`Airtable find failed: ${e.message}`);
        return null;
    }
}
