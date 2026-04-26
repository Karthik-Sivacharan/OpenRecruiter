import dotenv from "dotenv";
dotenv.config();

const NIA_BASE = "https://apigcp.trynia.ai";
const niaHeaders = () => ({
  Authorization: `Bearer ${process.env.NIA_API_KEY}`,
  "Content-Type": "application/json",
});

export async function findGitHubUrl(name: string, company: string, existingUrl?: string): Promise<string | null> {
  if (existingUrl) return existingUrl;
  try {
    const res = await fetch(`${NIA_BASE}/v2/search/web`, {
      method: "POST",
      headers: niaHeaders(),
      body: JSON.stringify({ query: `${name} ${company} github.com`, limit: 5 })
    });
    const data = await res.json();
    const all = [...(data.github_repos || []), ...(data.other_content || []), ...(data.results || [])];
    return all.map((r: any) => r.url || r.link || "").find((url: string) =>
      url.includes("github.com/") && !url.includes("github.com/search")
    ) || null;
  } catch (err) {
    console.log("findGitHubUrl error:", err);
    return null;
  }
}

// Fast fallback: Nia web search summary (~2s)
async function quickGitHubScan(username: string): Promise<string> {
  try {
    const res = await fetch(`${NIA_BASE}/v2/search/web`, {
      method: "POST",
      headers: niaHeaders(),
      body: JSON.stringify({ query: `github.com/${username} repositories projects`, limit: 5 })
    });
    const data = await res.json();
    const results = [...(data.github_repos || []), ...(data.other_content || []), ...(data.results || [])];
    return results.slice(0, 3)
      .map((r: any) => r.snippet || r.description || r.title || "")
      .filter(Boolean)
      .join(" | ");
  } catch {
    return "";
  }
}

// Deep Tracer with timeout — if it finishes in time it impacts score, otherwise falls back
async function deepTracerWithTimeout(username: string, githubUrl: string, jobDescription: string, timeoutMs = 25000): Promise<string> {
  try {
    const createRes = await fetch(`${NIA_BASE}/v2/github/tracer`, {
      method: "POST",
      headers: niaHeaders(),
      body: JSON.stringify({
        github_username: username,
        github_url: githubUrl,
        query: `What kind of work has ${username} done? What are their main skills and project quality?`,
        context: `Evaluating for: ${jobDescription.substring(0, 200)}`,
        mode: "tracer-fast",
      }),
    });

    const createBody = await createRes.json();
    const job_id = createBody.job_id || createBody.id;
    if (!job_id) return "";

    // Race the stream against the timeout
    const streamPromise = new Promise<string>(async (resolve) => {
      try {
        const streamRes = await fetch(`${NIA_BASE}/v2/github/tracer/${job_id}/stream`, {
          headers: { Authorization: `Bearer ${process.env.NIA_API_KEY}` },
        });
        if (!streamRes.ok || !streamRes.body) return resolve("");

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value);
        }

        // Parse SSE for best result
        let bestResult = "";
        for (const line of fullText.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const content = parsed.report || parsed.result || parsed.summary || parsed.content || "";
            if (content && content.length > bestResult.length) bestResult = content;
          } catch {}
        }
        resolve(bestResult);
      } catch {
        resolve("");
      }
    });

    const timeoutPromise = new Promise<string>((resolve) => setTimeout(() => resolve(""), timeoutMs));

    return await Promise.race([streamPromise, timeoutPromise]);
  } catch {
    return "";
  }
}

export async function traceGitHub(githubUrl: string, jobDescription: string): Promise<string> {
  const match = githubUrl.match(/github\.com\/([a-zA-Z0-9_-]+)/);
  if (!match) return "";
  const username = match[1];
  console.log(`Researching GitHub for: ${username}`);

  // Run both in parallel — fast scan always works, deep tracer wins if it finishes in time
  const [quickResult, deepResult] = await Promise.all([
    quickGitHubScan(username),
    deepTracerWithTimeout(username, githubUrl, jobDescription, 25000),
  ]);

  if (deepResult) {
    console.log(`✅ Deep Tracer result for ${username} (${deepResult.length} chars)`);
    return deepResult;
  }

  if (quickResult) {
    console.log(`⚡ Quick scan result for ${username}`);
    return quickResult;
  }

  return "";
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
