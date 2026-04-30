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

import { motion, useReducedMotion } from "motion/react";
import { UsersIcon } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
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
  const prefersReducedMotion = useReducedMotion();

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

  // Update URL from / to /chat/{id} after first message without remounting
  // (router.replace would kill the active stream by remounting the component)
  useEffect(() => {
    if (
      pathname === "/" &&
      messages.length > 0 &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      window.history.replaceState(null, "", `/chat/${id}`);
    }
  }, [pathname, messages.length, id, router]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl gap-4 px-4 md:px-6">
          {isEmpty ? (
            <div className="flex size-full flex-col items-center justify-center gap-4 p-8 text-center">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              >
                <UsersIcon className="size-10 text-primary/30" />
              </motion.div>
              <motion.h2
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.08, ease: [0.25, 1, 0.5, 1] }}
                className="text-2xl font-signature tracking-tight text-foreground"
              >
                What role are you hiring for?
              </motion.h2>
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.15, ease: [0.25, 1, 0.5, 1] }}
                className="text-sm text-muted-foreground"
              >
                Describe the role, paste a job description URL, or pick a suggestion below.
              </motion.p>
            </div>
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
            {SUGGESTIONS.map((s, index) => (
              <motion.div
                key={s}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, delay: 0.2 + index * 0.06, ease: [0.25, 1, 0.5, 1] }}
              >
                <Suggestion
                  suggestion={s}
                  onClick={(text) => sendMessage({ text })}
                  className="border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                />
              </motion.div>
            ))}
          </Suggestions>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2 md:px-6">
        <PromptInput
          onSubmit={({ text, files }) => sendMessage({ text, files })}
          className="rounded-xl border border-input bg-card"
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
