"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOutreachEmail = sendOutreachEmail;
exports.replyInThread = replyInThread;
exports.startReplyListener = startReplyListener;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const BASE = "https://api.agentmail.to/v0";
const h = () => ({ Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`, "Content-Type": "application/json" });
const INBOX = () => process.env.AGENTMAIL_INBOX_ID;
async function sendOutreachEmail(to, subject, body) {
    const res = await fetch(`${BASE}/inboxes/${INBOX()}/messages`, { method: "POST", headers: h(), body: JSON.stringify({ to: [to], subject, body }) });
    const data = await res.json();
    console.log(`Sent to ${to}: "${subject}"`);
    return { messageId: data.id, threadId: data.thread_id || data.id };
}
async function replyInThread(threadId, to, body) {
    await fetch(`${BASE}/inboxes/${INBOX()}/messages`, { method: "POST", headers: h(), body: JSON.stringify({ to: [to], thread_id: threadId, body }) });
    console.log(`Replied to ${to}`);
}
function startReplyListener(onReply) {
    if (!process.env.AGENTMAIL_API_KEY) {
        console.log("No AgentMail key — reply listener skipped");
        return;
    }
    Promise.resolve().then(() => __importStar(require("ws"))).then(({ default: WebSocket }) => {
        const ws = new WebSocket(`wss://api.agentmail.to/v0/inboxes/${INBOX()}/ws`, { headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` } });
        ws.on("open", () => console.log("🔌 AgentMail WebSocket connected"));
        ws.on("message", async (data) => {
            const event = JSON.parse(data.toString());
            if (event.type === "message_received" || event.event === "message.received")
                await onReply(event.message || event);
        });
        ws.on("error", () => { console.log("WebSocket failed, polling every 10s"); startPolling(onReply); });
        ws.on("close", () => setTimeout(() => startReplyListener(onReply), 5000));
    }).catch(() => console.log("ws not available"));
}
let lastId = null;
async function startPolling(onReply) {
    setInterval(async () => {
        const res = await fetch(`${BASE}/inboxes/${INBOX()}/messages?limit=5`, { headers: h() });
        const data = await res.json();
        for (const msg of (data.messages || [])) {
            if (msg.id !== lastId) {
                lastId = msg.id;
                await onReply(msg);
            }
        }
    }, 10000);
}
