import { loadChat } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import type { UIMessage } from "ai";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await loadChat(id);
  if (!conversation) notFound();

  return (
    <Chat id={id} initialMessages={conversation.messages as UIMessage[]} />
  );
}
