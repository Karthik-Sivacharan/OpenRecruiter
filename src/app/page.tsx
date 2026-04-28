"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Chat } from "@/components/chat";

export default function NewChatPage() {
  // Stable ID for this new chat session — generated once on mount
  const [chatId] = useState(() => nanoid());
  return <Chat id={chatId} />;
}
