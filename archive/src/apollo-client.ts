import axios from "axios";
import Airtable from "airtable";
import dotenv from "dotenv";
dotenv.config();

export async function searchCandidates(jobTitle: string, location = "San Francisco, CA", limit = 30): Promise<any[]> {
  try {
    const response = await axios.post("https://api.apollo.io/v1/mixed_people/search", {
      api_key: process.env.APOLLO_API_KEY,
      q_person_title: jobTitle,
      person_locations: [location],
      page: 1, per_page: limit,
      contact_email_status: ["verified", "guessed"],
    }, { timeout: 15000 });
    const people = response.data?.people || [];
    console.log(`Apollo: ${people.length} candidates found`);
    return people;
  } catch (err: any) {
    console.log("Apollo unavailable, loading from Airtable instead");
    return getRealCandidatesFromAirtable();
  }
}

export async function getRealCandidatesFromAirtable(): Promise<any[]> {
  if (!process.env.AIRTABLE_API_KEY) return getMockCandidates();
  try {
    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);
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
      skills: (r.get("Skills") || "").toString().split(",").map((s: string) => s.trim()),
      github_url: r.get("GitHub URL") || "",
      portfolio_url: r.get("Portfolio / Website") || "",
    }));
    console.log(`Loaded ${candidates.length} real candidates from Airtable`);
    return candidates;
  } catch (e: any) {
    console.log(`Airtable load failed: ${e.message}`);
    return getMockCandidates();
  }
}

export function getMockCandidates(): any[] {
  return [
    { id: "mock-1", name: "Priya Sharma", email: "priya.sharma@example.com", title: "Senior Product Designer", organization_name: "Figma", city: "San Francisco", state: "CA", skills: ["Figma", "Design Systems", "User Research"] },
    { id: "mock-2", name: "Marcus Chen", email: "marcus.chen@example.com", title: "Product Designer", organization_name: "Linear", city: "San Francisco", state: "CA", skills: ["B2B SaaS", "Figma", "Motion Design"] },
    { id: "mock-3", name: "Sofia Rodriguez", email: "sofia.r@example.com", title: "Lead Product Designer", organization_name: "Vercel", city: "San Francisco", state: "CA", skills: ["Design Leadership", "Developer Tools", "Figma"] },
  ];
}
