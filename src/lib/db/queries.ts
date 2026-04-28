import { eq, desc, sql } from 'drizzle-orm';
import { db } from './index';
import { conversations, type Conversation } from './schema';

/** Create a new chat with empty messages */
export async function createChat(id: string, title: string): Promise<void> {
  await db.insert(conversations).values({ id, title });
}

/** Load a single chat by ID */
export async function loadChat(id: string): Promise<Conversation | undefined> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return rows[0];
}

/** Save messages to an existing chat. Creates the row if it doesn't exist. Auto-sets title from first user message. */
export async function saveChat(id: string, messages: unknown[]): Promise<void> {
  // Derive title from first user message if available
  const firstUserMsg = messages.find(
    (m): m is { role: string; content: string } =>
      typeof m === 'object' &&
      m !== null &&
      'role' in m &&
      (m as { role: string }).role === 'user' &&
      'content' in m &&
      typeof (m as { content: unknown }).content === 'string',
  );
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 100)
    : 'New Search';

  await db
    .insert(conversations)
    .values({ id, title, messages })
    .onConflictDoUpdate({
      target: conversations.id,
      set: {
        messages,
        updatedAt: sql`now()`,
        // Only set title if it was null (don't overwrite user-set titles)
        title: sql`COALESCE(${conversations.title}, ${title})`,
      },
    });
}

/** List all chats, most recent first. Does NOT include messages (too large). */
export async function listChats(): Promise<
  Pick<Conversation, 'id' | 'title' | 'roleName' | 'updatedAt'>[]
> {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      roleName: conversations.roleName,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .orderBy(desc(conversations.updatedAt));
}

/** Update conversation metadata (role name, Airtable table ID) */
export async function updateChatMeta(
  id: string,
  fields: { roleName?: string; airtableTableId?: string },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: sql`now()` };
  if (fields.roleName !== undefined) set.roleName = fields.roleName;
  if (fields.airtableTableId !== undefined)
    set.airtableTableId = fields.airtableTableId;

  await db.update(conversations).set(set).where(eq(conversations.id, id));
}
