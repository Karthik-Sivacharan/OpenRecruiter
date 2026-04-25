import dotenv from "dotenv";
dotenv.config();

const BASE = "https://api.agentmail.to/v0";
const h = () => ({ Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`, "Content-Type": "application/json" });
const INBOX = () => process.env.AGENTMAIL_INBOX_ID!;

export async function sendOutreachEmail(to: string, subject: string, body: string): Promise<{messageId:string,threadId:string}> {
  const res = await fetch(`${BASE}/inboxes/${INBOX()}/messages`, { method: "POST", headers: h(), body: JSON.stringify({ to: [to], subject, body }) });
  const data = await res.json();
  console.log(`Sent to ${to}: "${subject}"`);
  return { messageId: data.id, threadId: data.thread_id || data.id };
}

export async function replyInThread(threadId: string, to: string, body: string): Promise<void> {
  await fetch(`${BASE}/inboxes/${INBOX()}/messages`, { method: "POST", headers: h(), body: JSON.stringify({ to: [to], thread_id: threadId, body }) });
  console.log(`Replied to ${to}`);
}

export function startReplyListener(onReply: (msg: any) => Promise<void>): void {
  if (!process.env.AGENTMAIL_API_KEY) { console.log("No AgentMail key — reply listener skipped"); return; }
  import("ws").then(({ default: WebSocket }) => {
    const ws = new WebSocket(`wss://api.agentmail.to/v0/inboxes/${INBOX()}/ws`, { headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` } });
    ws.on("open", () => console.log("🔌 AgentMail WebSocket connected"));
    ws.on("message", async (data: any) => {
      const event = JSON.parse(data.toString());
      if (event.type === "message_received" || event.event === "message.received") await onReply(event.message || event);
    });
    ws.on("error", () => { console.log("WebSocket failed, polling every 10s"); startPolling(onReply); });
    ws.on("close", () => setTimeout(() => startReplyListener(onReply), 5000));
  }).catch(() => console.log("ws not available"));
}

let lastId: string | null = null;
async function startPolling(onReply: (msg: any) => Promise<void>) {
  setInterval(async () => {
    const res = await fetch(`${BASE}/inboxes/${INBOX()}/messages?limit=5`, { headers: h() });
    const data = await res.json();
    for (const msg of (data.messages || [])) {
      if (msg.id !== lastId) { lastId = msg.id; await onReply(msg); }
    }
  }, 10000);
}
