import Airtable from "airtable";
import dotenv from "dotenv";
dotenv.config();

let base: any;
function getBase() {
  if (!base) {
    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY! });
    base = Airtable.base(process.env.AIRTABLE_BASE_ID!);
  }
  return base;
}

const TABLE = () => process.env.AIRTABLE_CANDIDATES_TABLE || "Candidates";

export async function createCandidateRecord(c: any): Promise<string> {
  if (!process.env.AIRTABLE_API_KEY) { console.log("No Airtable key — skipping CRM"); return "no-airtable"; }
  try {
    const existing = await findCandidateByEmail(c.email);
    if (existing?.airtable_id) {
      console.log(`Airtable: ${c.name} already exists — updating score`);
      await getBase()(TABLE()).update(existing.airtable_id, {
        "Pipeline Stage": c.status || "Sourced",
        "Nia Score": c.fit_score || 0,
        "Nia Analysis": c.fit_notes || "",
        "GitHub URL": c.github_url || "",
        "Skills": c.key_skills?.join(", ") || "",
      });
      console.log(`Airtable: ${c.name} Nia Score updated to ${c.fit_score}/10`);
      return existing.airtable_id;
    }
    const record = await getBase()(TABLE()).create({
      "Candidate Name": c.name,
      "Email": c.email,
      "Current Company": c.company,
      "Current Role / Title": c.title,
      "LinkedIn": c.linkedin || "",
      "Pipeline Stage": c.status || "Sourced",
      "Nia Score": c.fit_score || 0,
      "Nia Analysis": c.fit_notes || "",
      "GitHub URL": c.github_url || "",
      "Skills": c.key_skills?.join(", ") || "",
      "Notes": c.nia_context_id || "",
    });
    console.log(`Airtable: ${c.name} added — Nia Score: ${c.fit_score}/10`);
    return record.id;
  } catch (e: any) {
    console.log(`Airtable create failed: ${e.message}`);
    return "no-airtable";
  }
}

export async function updateCandidateStatus(id: string, status: string, extra?: any): Promise<void> {
  if (!process.env.AIRTABLE_API_KEY || id === "no-airtable") return;
  try {
    await getBase()(TABLE()).update(id, { "Pipeline Stage": status, ...extra });
    console.log(`Airtable: ${id} updated to ${status}`);
  } catch (e: any) {
    console.log(`Airtable update failed: ${e.message}`);
  }
}

export async function findCandidateByEmail(email: string): Promise<any> {
  if (!process.env.AIRTABLE_API_KEY || !email) return null;
  try {
    const records = await getBase()(TABLE())
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .firstPage();
    if (!records.length) return null;
    const r = records[0];
    return {
      airtable_id: r.id,
      name: r.get("Candidate Name"),
      email: r.get("Email"),
      company: r.get("Current Company"),
      title: r.get("Current Role / Title"),
      status: r.get("Pipeline Stage"),
      nia_context_id: r.get("Notes"),
      agentmail_thread_id: r.get("AgentMail Thread ID"),
    };
  } catch (e: any) {
    console.log(`Airtable find failed: ${e.message}`);
    return null;
  }
}
