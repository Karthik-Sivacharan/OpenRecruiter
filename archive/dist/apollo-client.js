"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCandidates = searchCandidates;
exports.getRealCandidatesFromAirtable = getRealCandidatesFromAirtable;
exports.getMockCandidates = getMockCandidates;
const axios_1 = __importDefault(require("axios"));
const airtable_1 = __importDefault(require("airtable"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function searchCandidates(jobTitle, location = "San Francisco, CA", limit = 30) {
    try {
        const response = await axios_1.default.post("https://api.apollo.io/v1/mixed_people/api_search", {
            api_key: process.env.APOLLO_API_KEY,
            q_person_title: jobTitle,
            person_locations: [location],
            page: 1, per_page: limit,
            contact_email_status: ["verified", "guessed"],
        }, { timeout: 15000 });
        const people = response.data?.people || [];
        console.log(`Apollo: ${people.length} candidates found`);
        return people;
    }
    catch (err) {
        console.log("Apollo unavailable, loading from Airtable instead");
        return getRealCandidatesFromAirtable();
    }
}
async function getRealCandidatesFromAirtable() {
    if (!process.env.AIRTABLE_API_KEY)
        return getMockCandidates();
    try {
        airtable_1.default.configure({ apiKey: process.env.AIRTABLE_API_KEY });
        const base = airtable_1.default.base(process.env.AIRTABLE_BASE_ID);
        const records = await base("Candidates").select({ maxRecords: 25 }).all();
        const candidates = records.map(r => ({
            id: r.id,
            name: r.get("Candidate Name"),
            email: r.get("Email"),
            linkedin_url: r.get("LinkedIn"),
            title: r.get("Current Role / Title") || "",
            organization_name: r.get("Current Company") || "",
            city: "San Francisco",
            state: "CA",
            skills: (r.get("Skills") || "").toString().split(",").map((s) => s.trim()),
            github_url: r.get("GitHub URL") || "",
            portfolio_url: r.get("Portfolio / Website") || "",
        }));
        console.log(`Loaded ${candidates.length} real candidates from Airtable`);
        return candidates;
    }
    catch (e) {
        console.log(`Airtable load failed: ${e.message}`);
        return getMockCandidates();
    }
}
function getMockCandidates() {
    return [
        { id: "mock-1", name: "Priya Sharma", email: "priya.sharma@example.com", title: "Senior Product Designer", organization_name: "Figma", city: "San Francisco", state: "CA", skills: ["Figma", "Design Systems", "User Research"] },
        { id: "mock-2", name: "Marcus Chen", email: "marcus.chen@example.com", title: "Product Designer", organization_name: "Linear", city: "San Francisco", state: "CA", skills: ["B2B SaaS", "Figma", "Motion Design"] },
        { id: "mock-3", name: "Sofia Rodriguez", email: "sofia.r@example.com", title: "Lead Product Designer", organization_name: "Vercel", city: "San Francisco", state: "CA", skills: ["Design Leadership", "Developer Tools", "Figma"] },
    ];
}
