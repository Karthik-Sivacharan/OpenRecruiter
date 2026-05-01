import { z } from 'zod';
import { updateChatMeta, getChatTalentPoolFlag } from '@/lib/db/queries';

const bodySchema = z.object({
  chatId: z.string().min(1),
  useTalentPool: z.boolean(),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { chatId, useTalentPool } = parsed.data;
  await updateChatMeta(chatId, { useTalentPool });

  return Response.json({ ok: true, chatId, useTalentPool });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get('chatId');
  if (!chatId) {
    return Response.json({ error: 'chatId is required' }, { status: 400 });
  }

  const useTalentPool = await getChatTalentPoolFlag(chatId);
  return Response.json({ chatId, useTalentPool });
}
