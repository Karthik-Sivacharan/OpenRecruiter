import { nanoid } from 'nanoid';
import { createChat, listChats } from '@/lib/db/queries';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = (body.title as string) || 'New Search';
  const id = nanoid();

  await createChat(id, title);

  return Response.json({ id }, { status: 201 });
}

export async function GET() {
  const conversations = await listChats();
  return Response.json({ conversations });
}
