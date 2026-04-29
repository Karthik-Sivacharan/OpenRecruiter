"use client";

import type { ChatStatus, UIMessage } from "ai";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from "@/components/ai-elements/confirmation";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";

interface ChatMessagesProps {
  messages: UIMessage[];
  status: ChatStatus;
  addToolApprovalResponse: (opts: {
    id: string;
    approved: boolean;
    reason?: string;
    options?: Record<string, unknown>;
  }) => void;
}

export function ChatMessages({
  messages,
  status,
  addToolApprovalResponse,
}: ChatMessagesProps) {
  return (
    <>
      {messages.map((message, idx) => (
        <Message key={message.id || `msg-${idx}`} from={message.role}>
          <MessageContent>
            {message.parts.map((part, i) => {
              switch (part.type) {
                case "text":
                  return (
                    <MessageResponse
                      key={i}
                      isAnimating={
                        message.role === "assistant" && status === "streaming"
                      }
                    >
                      {part.text}
                    </MessageResponse>
                  );

                case "reasoning":
                  return (
                    <Reasoning key={i} isStreaming={status === "streaming"}>
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  );

                case "step-start":
                  return i > 0 ? (
                    <div
                      key={i}
                      className="my-3 border-t border-[rgba(255,255,255,0.05)]"
                    />
                  ) : null;

                default: {
                  // Tool parts: type starts with "tool-" or is "dynamic-tool"
                  if (
                    part.type.startsWith("tool-") ||
                    part.type === "dynamic-tool"
                  ) {
                    const toolName =
                      part.type === "dynamic-tool"
                        ? (part as { toolName: string }).toolName
                        : part.type.replace("tool-", "");

                    if (HIDDEN_TOOLS.has(toolName)) return null;

                    return (
                      <div key={i}>
                        <Tool>
                          <ToolHeader
                            type={part.type as "dynamic-tool"}
                            state={(part as { state: string }).state as never}
                            toolName={toolName}
                            title={formatToolName(toolName)}
                          />
                          <ToolContent>
                            <ToolInput
                              input={(part as { input: unknown }).input}
                            />
                            <ToolOutput
                              output={(part as { output: unknown }).output}
                              errorText={
                                (part as { errorText?: string }).errorText
                              }
                            />
                          </ToolContent>
                        </Tool>

                        {/* Approval flow for tools with needsApproval */}
                        <Confirmation
                          approval={
                            (part as { approval?: { id: string } }).approval
                          }
                          state={(part as { state: string }).state as never}
                        >
                          <ConfirmationTitle>
                            Approve <strong>{formatToolName(toolName)}</strong>?
                          </ConfirmationTitle>
                          <ConfirmationRequest>
                            <ConfirmationActions>
                              <ConfirmationAction
                                variant="outline"
                                onClick={() =>
                                  addToolApprovalResponse({
                                    id: (
                                      part as {
                                        approval: { id: string };
                                      }
                                    ).approval.id,
                                    approved: false,
                                  })
                                }
                              >
                                Deny
                              </ConfirmationAction>
                              <ConfirmationAction
                                onClick={() =>
                                  addToolApprovalResponse({
                                    id: (
                                      part as {
                                        approval: { id: string };
                                      }
                                    ).approval.id,
                                    approved: true,
                                  })
                                }
                              >
                                Approve
                              </ConfirmationAction>
                            </ConfirmationActions>
                          </ConfirmationRequest>
                          <ConfirmationAccepted>
                            <p className="text-sm text-green-500">
                              Approved -- executing...
                            </p>
                          </ConfirmationAccepted>
                          <ConfirmationRejected>
                            <p className="text-sm text-orange-500">
                              Denied by recruiter.
                            </p>
                          </ConfirmationRejected>
                        </Confirmation>
                      </div>
                    );
                  }

                  return null;
                }
              }
            })}
          </MessageContent>
        </Message>
      ))}
    </>
  );
}

/** Internal tools that should not be shown in the chat UI */
const HIDDEN_TOOLS = new Set(["setChatTitle"]);

/** Convert camelCase tool names to human-readable labels */
function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
