"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

import { ChatMessages } from "@/components/chat-messages";

const SUGGESTIONS = [
  "Source ML engineers in SF",
  "Find backend devs with Go experience",
  "Source designers for a Series A startup",
];

interface ChatProps {
  id: string;
  initialMessages?: UIMessage[];
}

export function Chat({ id, initialMessages }: ChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: {
        chatId: id,
        messages,
      },
    }),
  });

  const {
    messages,
    sendMessage,
    status,
    stop,
    addToolApprovalResponse,
  } = useChat({
    id,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: ({ messages: msgs }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages: msgs }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages: msgs }),
  });

  // Redirect from / to /chat/{id} after first message so the sidebar refetches
  useEffect(() => {
    if (
      pathname === "/" &&
      messages.length > 0 &&
      status !== "streaming" &&
      status !== "submitted" &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      router.replace(`/chat/${id}`);
    }
  }, [pathname, messages.length, status, id, router]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl gap-4 px-4 md:px-6">
          {isEmpty ? (
            <ConversationEmptyState
              title="What role are you hiring for?"
              description="Describe the role, paste a job description URL, or pick a suggestion below."
              className="text-foreground"
            />
          ) : (
            <ChatMessages
              messages={messages}
              status={status}
              addToolApprovalResponse={addToolApprovalResponse}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {isEmpty && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2 md:px-6">
          <Suggestions className="justify-center">
            {SUGGESTIONS.map((s) => (
              <Suggestion
                key={s}
                suggestion={s}
                onClick={(text) => sendMessage({ text })}
                className="border-[rgba(255,255,255,0.08)] text-[#d0d6e0] hover:bg-[#28282c] hover:text-[#f7f8f8]"
              />
            ))}
          </Suggestions>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2 md:px-6">
        <PromptInput
          onSubmit={({ text, files }) => sendMessage({ text, files })}
          className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1011]"
        >
          <PromptInputTextarea placeholder="Describe the role you're hiring for..." />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
