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
import { Shimmer } from "@/components/ai-elements/shimmer";

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
  const isStreaming = status === "streaming" || status === "submitted";

  // Detect if the agent hit the step limit (stream ended with tool calls, no final text)
  const hitStepLimit = (() => {
    if (status !== "ready" || messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return false;
    const parts = lastMsg.parts;
    if (parts.length === 0) return false;
    const lastPart = parts[parts.length - 1];
    // If the last part is a completed tool call (not text), the model was cut off
    return lastPart.type !== "text" && lastPart.type !== "reasoning" && lastPart.type !== "step-start";
  })();

  // Show a shimmer when the agent is working but hasn't produced text yet,
  // or when the last visible part is a completed tool call (agent is thinking about next step)
  const showThinkingIndicator = (() => {
    if (!isStreaming) return false;
    if (messages.length === 0) return true;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return true; // waiting for first response
    const parts = lastMsg.parts;
    if (parts.length === 0) return true;
    const lastPart = parts[parts.length - 1];
    // Show shimmer if the last part is a completed tool call (agent processing results)
    if (lastPart.type !== "text" && lastPart.type !== "reasoning") {
      const state = (lastPart as { state?: string }).state;
      return state === "output-available" || state === "output-error";
    }
    return false;
  })();

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

                case "step-start": {
                  // Only show divider if there's text content nearby (not between consecutive tool calls)
                  if (i === 0) return null;
                  const parts = message.parts;
                  // Check if there's a text part before or after this step-start
                  const hasTextBefore = parts.slice(0, i).some((p) => p.type === "text");
                  const hasTextAfter = parts.slice(i + 1).some((p) => p.type === "text");
                  if (!hasTextBefore && !hasTextAfter) return null;
                  return (
                    <div
                      key={i}
                      className="my-3 border-t border-[rgba(255,255,255,0.05)]"
                    />
                  );
                }

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

                    const toolState = (part as { state: string }).state;
                    const isRunning = toolState === "input-available" || toolState === "input-streaming";

                    return (
                      <div key={i}>
                        <Tool className={isRunning ? "border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]" : undefined}>
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

      {showThinkingIndicator && (
        <div className="flex items-center gap-2 px-1 py-2">
          <Shimmer className="text-sm text-muted-foreground" duration={1.5}>
            Working on it...
          </Shimmer>
        </div>
      )}

      {hitStepLimit && (
        <div className="mx-auto my-4 max-w-md rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-center text-sm text-yellow-200">
          The agent reached its processing limit for this turn. Type{" "}
          <span className="font-mono font-semibold">continue</span> to pick up
          where it left off.
        </div>
      )}
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
