/**
 * Fix chat titles for conversations that don't have a roleName set.
 * Scans all user messages and picks the most descriptive one as the title.
 *
 * Run: npx tsx scripts/fix-chat-titles.ts
 */
import { db } from '../src/lib/db/index';
import { conversations } from '../src/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

interface MessagePart {
  type?: string;
  text?: string;
  content?: string;
}

interface StoredMessage {
  role: string;
  content?: string | MessagePart[];
  parts?: MessagePart[];
}

/** Extract plain text from a message (handles both string content and parts array) */
function extractText(msg: StoredMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  const parts = msg.parts || (Array.isArray(msg.content) ? msg.content : []);
  return parts
    .map((p) => p.text || p.content || '')
    .filter(Boolean)
    .join(' ');
}

/** Score a message for how likely it describes a role/search */
function scoreMessage(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // URLs (likely JD links) score highest
  if (/https?:\/\//.test(text)) score += 10;

  // Role-related keywords
  const roleWords = ['engineer', 'designer', 'manager', 'developer', 'analyst',
    'recruiter', 'director', 'lead', 'senior', 'junior', 'staff', 'principal',
    'source', 'find', 'hire', 'search', 'looking for', 'candidates'];
  for (const word of roleWords) {
    if (lower.includes(word)) score += 2;
  }

  // Location keywords
  const locations = ['sf', 'nyc', 'remote', 'san francisco', 'new york', 'london',
    'austin', 'seattle', 'boston', 'la', 'los angeles', 'chicago'];
  for (const loc of locations) {
    if (lower.includes(loc)) score += 1;
  }

  // Penalize very short messages (greetings)
  if (text.length < 15) score -= 5;
  // Penalize yes/no
  if (/^(yes|no|ok|sure|yep|nope|yeah)\b/i.test(text.trim())) score -= 10;

  return score;
}

/** Derive a title from the best user message (max 100 chars) */
function deriveTitle(messages: StoredMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => extractText(m))
    .filter((t) => t.length > 0);

  if (userMessages.length === 0) return 'Untitled Search';

  // Score each message and pick the best
  const scored = userMessages.map((text) => ({ text, score: scoreMessage(text) }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0].text;

  // If it's a URL, try to make it readable
  if (/^https?:\/\//.test(best.trim())) {
    // Combine with the next best non-URL message if available
    const nonUrl = scored.find((s) => !/^https?:\/\//.test(s.text.trim()) && s.score > 0);
    if (nonUrl) return nonUrl.text.slice(0, 100);
    // Otherwise just use the URL domain
    try {
      const url = new URL(best.trim().split(/\s/)[0]);
      return `Search — ${url.hostname}`;
    } catch {
      return best.slice(0, 100);
    }
  }

  return best.slice(0, 100);
}

async function main() {
  // Find chats without a roleName
  const chats = await db
    .select()
    .from(conversations)
    .where(isNull(conversations.roleName));

  console.log(`Found ${chats.length} chats without roleName\n`);

  for (const chat of chats) {
    const messages = (chat.messages ?? []) as StoredMessage[];
    const title = deriveTitle(messages);

    console.log(`Chat: ${chat.id}`);
    console.log(`  Old title: ${chat.title}`);
    console.log(`  New title: ${title}`);

    await db
      .update(conversations)
      .set({ roleName: title, title })
      .where(eq(conversations.id, chat.id));

    console.log('  Updated.\n');
  }

  console.log('Done.');
}

main().catch(console.error);
