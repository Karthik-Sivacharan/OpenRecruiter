# Vercel AI SDK v6 + AI Elements: Complete Integration Reference

> Research compiled from official docs (ai-sdk.dev) and installed ai-elements source code.
> For OpenRecruiter -- autonomous AI recruiting agency (Next.js 16 App Router, `src/` directory).

---

## Table of Contents

1. [useChat Hook](#1-usechat-hook)
2. [streamText Server-Side](#2-streamtext-server-side)
3. [Tool Definition (Server)](#3-tool-definition-server)
4. [Message Parts (UIMessage)](#4-message-parts-uimessage)
5. [Tool UI Patterns](#5-tool-ui-patterns)
6. [Human-in-the-Loop / Tool Confirmation](#6-human-in-the-loop--tool-confirmation)
7. [Multi-Step Tool Calls (Agents)](#7-multi-step-tool-calls-agents)
8. [Streaming UX](#8-streaming-ux)
9. [File Attachments](#9-file-attachments)
10. [Suggestions](#10-suggestions)
11. [Plan and Task Components](#11-plan-and-task-components)
12. [Reasoning](#12-reasoning)
13. [Sources and Citations](#13-sources-and-citations)
14. [Error Handling](#14-error-handling)
15. [Customization and Theming](#15-customization-and-theming)
16. [Full Wiring Example](#16-full-wiring-example)

---

## 1. useChat Hook

Import: `import { useChat } from '@ai-sdk/react';`

### Basic Setup

```tsx
const { messages, sendMessage, status, stop, setMessages } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
  }),
});
```

### Key Return Values

| Return Value | Type | Purpose |
|---|---|---|
| `messages` | `UIMessage[]` | Conversation history (streaming-aware) |
| `sendMessage` | `(content, options?) => void` | Send user message |
| `status` | `'submitted' \| 'streaming' \| 'ready' \| 'error'` | Current hook state |
| `stop` | `() => void` | Abort streaming response |
| `setMessages` | `(messages) => void` | Directly manipulate message history |
| `error` | `Error \| null` | Current error |
| `addToolOutput` | `(opts) => void` | Provide client-side tool results |
| `addToolApprovalResponse` | `(opts) => void` | Approve/deny tool execution |

### Transport Configuration

```tsx
transport: new DefaultChatTransport({
  api: '/api/chat',
  headers: { Authorization: `Bearer ${token}` },  // static or () => ({...})
  body: { recruiterId: '123' },                     // merged into POST body
  credentials: 'same-origin',
})
```

### Sending Messages

```tsx
// Basic text
sendMessage({ text: 'Find me senior React developers in SF' });

// With files
sendMessage({ text: input, files: fileInputRef.current?.files });

// With request-level overrides
sendMessage(
  { text: input },
  {
    headers: { 'X-Custom': 'value' },
    body: { temperature: 0.7 },
    metadata: { userId: 'user123' },
  }
);
```

### Status States

| Status | Meaning | UI Action |
|---|---|---|
| `'submitted'` | Request sent, waiting for stream | Show spinner |
| `'streaming'` | Response actively streaming | Show stop button |
| `'ready'` | Idle, ready for input | Enable submit |
| `'error'` | Request failed | Show error + retry |

### Event Callbacks

```tsx
useChat({
  onFinish: ({ message, messages, isAbort, isDisconnect, isError }) => {
    // Persist to DB, analytics, etc.
  },
  onError: (error) => {
    console.error('Chat error:', error);
  },
  // Auto-submit after tool calls complete (critical for agentic flows)
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

### Client-Side Tool Handling

```tsx
const { addToolOutput, addToolApprovalResponse } = useChat({
  // Auto-execute client-side tools
  async onToolCall({ toolCall }) {
    if (toolCall.dynamic) return;
    if (toolCall.toolName === 'getLocation') {
      addToolOutput({
        tool: 'getLocation',
        toolCallId: toolCall.toolCallId,
        output: 'San Francisco',
      });
    }
  },
});
```

---

## 2. streamText Server-Side

### Route Handler (app/api/chat/route.ts)

```tsx
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: 'You are an expert AI recruiting assistant...',
    messages: await convertToModelMessages(messages),
    tools: { /* tool definitions */ },
    stopWhen: stepCountIs(5),          // max agent loop iterations
    onStepFinish: ({ stepNumber, text, toolCalls, toolResults }) => {
      console.log(`Step ${stepNumber} complete`);
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Response Methods

| Method | Use Case |
|---|---|
| `toUIMessageStreamResponse()` | Standard -- returns SSE stream for useChat |
| `toTextStreamResponse()` | Plain text stream (no tool/metadata support) |
| `pipeUIMessageStreamToResponse(res)` | Node.js response object (custom servers) |

### toUIMessageStreamResponse Options

```tsx
return result.toUIMessageStreamResponse({
  sendReasoning: true,    // Include thinking/reasoning parts
  sendSources: true,      // Include source citations
  messageMetadata: ({ part }) => {
    if (part.type === 'finish') {
      return { totalUsage: part.totalUsage };
    }
  },
  onError: (error) => {
    // Return sanitized error message (default masks errors)
    return error instanceof Error ? error.message : 'Unknown error';
  },
});
```

### Callbacks on streamText

```tsx
streamText({
  // Per-chunk callback
  onChunk({ chunk }) {
    // chunk.type: 'text' | 'reasoning' | 'source' | 'tool-call' |
    //             'tool-input-start' | 'tool-input-delta' | 'tool-result' | 'raw'
  },

  // On stream completion
  onFinish({ text, toolCalls, toolResults, finishReason, usage, totalUsage }) {},

  // Per-step callback (for multi-step agent loops)
  onStepFinish({ stepNumber, text, toolCalls, toolResults, finishReason, usage }) {},

  // Tool lifecycle
  experimental_onToolCallStart({ toolName, toolCallId, input }) {},
  experimental_onToolCallFinish({ toolName, toolCallId, output, error, durationMs }) {},
});
```

---

## 3. Tool Definition (Server)

### Basic Tool

```tsx
import { tool } from 'ai';
import { z } from 'zod';

const searchCandidates = tool({
  description: 'Search for candidates on Apollo matching criteria',
  inputSchema: z.object({
    title: z.string().describe('Job title to search for'),
    location: z.string().optional().describe('City or region'),
    skills: z.array(z.string()).optional().describe('Required skills'),
    limit: z.number().default(10).describe('Max results'),
  }),
  execute: async ({ title, location, skills, limit }, { toolCallId, abortSignal }) => {
    const results = await apolloSearch({ title, location, skills, limit }, abortSignal);
    return results;
  },
});
```

### Tool Requiring Approval

```tsx
const sendEmail = tool({
  description: 'Send outreach email to a candidate',
  inputSchema: z.object({
    candidateId: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: true,  // <-- Pauses for recruiter approval
  execute: async ({ candidateId, subject, body }) => {
    return await sendOutreachEmail(candidateId, subject, body);
  },
});
```

### Dynamic Approval (conditional)

```tsx
const spendCredits = tool({
  description: 'Spend Apollo credits to enrich a contact',
  inputSchema: z.object({
    contactId: z.string(),
    credits: z.number(),
  }),
  needsApproval: async ({ credits }) => credits > 5, // Only approve if > 5 credits
  execute: async ({ contactId }) => {
    return await enrichContact(contactId);
  },
});
```

### toolChoice

```tsx
streamText({
  toolChoice: 'auto',                              // default - model decides
  toolChoice: 'required',                           // must call a tool
  toolChoice: 'none',                               // no tools allowed
  toolChoice: { type: 'tool', toolName: 'search' }, // force specific tool
});
```

### activeTools (limit available tools per step)

```tsx
streamText({
  tools: allTools,
  activeTools: ['searchCandidates', 'enrichCandidate'], // subset
});
```

### prepareStep (dynamic per-step config)

```tsx
streamText({
  prepareStep: async ({ stepNumber, steps }) => {
    if (stepNumber === 0) {
      return { toolChoice: { type: 'tool', toolName: 'searchCandidates' } };
    }
    return {}; // use defaults
  },
});
```

### Tool execute context

The `execute` function receives a second argument with context:

```tsx
execute: async (args, { toolCallId, messages, abortSignal, experimental_context }) => {
  // toolCallId: unique ID for this call
  // messages: full conversation history
  // abortSignal: for cancellation
}
```

---

## 4. Message Parts (UIMessage)

### UIMessage Structure

```tsx
interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: UIPart[];
  metadata?: Record<string, any>;
}
```

### Part Types

| Part Type | Shape | Maps To Component |
|---|---|---|
| `'text'` | `{ type: 'text', text: string }` | `<MessageResponse>` (Streamdown) |
| `'tool-<toolName>'` | `{ type: 'tool-searchCandidates', toolCallId, input, output, state }` | `<Tool>` |
| `'dynamic-tool'` | `{ type: 'dynamic-tool', toolName, toolCallId, input, output, state }` | `<Tool>` |
| `'reasoning'` | `{ type: 'reasoning', text: string }` | `<Reasoning>` |
| `'source-url'` | `{ type: 'source-url', url, title, id }` | `<Sources>` + `<Source>` |
| `'source-document'` | `{ type: 'source-document', title, id }` | `<Sources>` + `<Source>` |
| `'file'` | `{ type: 'file', url, filename, mediaType }` | `<Attachments>` |
| `'step-start'` | `{ type: 'step-start' }` | Visual divider between agent steps |

### Tool Part States

Each tool part progresses through these states:

| State | Meaning |
|---|---|
| `'input-streaming'` | Model is generating tool arguments |
| `'input-available'` | Arguments complete, tool ready to execute |
| `'approval-requested'` | Tool has `needsApproval`, waiting for user |
| `'approval-responded'` | User approved/denied, processing |
| `'output-available'` | Tool executed successfully, result available |
| `'output-error'` | Tool execution failed |
| `'output-denied'` | User denied the tool call |

### Rendering Parts

```tsx
{message.parts.map((part, i) => {
  switch (part.type) {
    case 'text':
      return <MessageResponse key={i}>{part.text}</MessageResponse>;

    case 'reasoning':
      return (
        <Reasoning key={i} isStreaming={status === 'streaming'}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );

    case 'step-start':
      return i > 0 ? <div key={i} className="border-t my-2" /> : null;

    default:
      // Tool parts: type starts with 'tool-' or is 'dynamic-tool'
      if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
        return <ToolRenderer key={i} part={part} />;
      }
      // Source parts
      if (part.type === 'source-url') {
        return <Source key={i} href={part.url} title={part.title} />;
      }
  }
})}
```

---

## 5. Tool UI Patterns

### The Tool Component (from source: `src/components/ai-elements/tool.tsx`)

The Tool component wraps a Radix Collapsible and renders tool call data:

```tsx
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';

function ToolRenderer({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  return (
    <Tool>
      <ToolHeader
        type={part.type}
        state={part.state}
        toolName={part.type === 'dynamic-tool' ? part.toolName : undefined}
        title="Search Candidates"  // optional friendly name
      />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput output={part.output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  );
}
```

### Status Badges (built into ToolHeader)

The component has built-in status labels and icons:

| State | Label | Icon Color |
|---|---|---|
| `'input-streaming'` | "Pending" | neutral circle |
| `'input-available'` | "Running" | pulsing clock |
| `'approval-requested'` | "Awaiting Approval" | yellow clock |
| `'approval-responded'` | "Responded" | blue check |
| `'output-available'` | "Completed" | green check |
| `'output-denied'` | "Denied" | orange X |
| `'output-error'` | "Error" | red X |

### Conditional Tool Rendering by State

```tsx
switch (part.state) {
  case 'input-streaming':
    return <div>Preparing arguments...</div>;
  case 'input-available':
    return <div>Tool ready: {JSON.stringify(part.input)}</div>;
  case 'approval-requested':
    return <ConfirmationUI part={part} />;
  case 'output-available':
    return <div>Result: {JSON.stringify(part.output)}</div>;
  case 'output-error':
    return <div className="text-red-500">Error: {part.errorText}</div>;
}
```

---

## 6. Human-in-the-Loop / Tool Confirmation

### Server: Mark tool as needing approval

```tsx
const sendEmail = tool({
  description: 'Send outreach email',
  inputSchema: z.object({ candidateId: z.string(), subject: z.string(), body: z.string() }),
  needsApproval: true,
  execute: async (args) => { /* ... */ },
});
```

### Client: Detect approval-requested state and render Confirmation

The Confirmation component (from source: `src/components/ai-elements/confirmation.tsx`) uses context to show different states:

```tsx
import {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from '@/components/ai-elements/confirmation';

function ToolWithApproval({ part, addToolApprovalResponse }) {
  return (
    <>
      <Tool>
        <ToolHeader type={part.type} state={part.state} title="Send Email" />
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput output={part.output} errorText={part.errorText} />
        </ToolContent>
      </Tool>

      <Confirmation approval={part.approval} state={part.state}>
        <ConfirmationTitle>
          Send outreach email to {part.input?.candidateId}?
        </ConfirmationTitle>

        <ConfirmationRequest>
          {/* Only visible when state === 'approval-requested' */}
          <ConfirmationActions>
            <ConfirmationAction
              variant="outline"
              onClick={() =>
                addToolApprovalResponse({
                  id: part.approval.id,
                  approved: false,
                  reason: 'Recruiter declined',
                })
              }
            >
              Deny
            </ConfirmationAction>
            <ConfirmationAction
              onClick={() =>
                addToolApprovalResponse({
                  id: part.approval.id,
                  approved: true,
                })
              }
            >
              Approve
            </ConfirmationAction>
          </ConfirmationActions>
        </ConfirmationRequest>

        <ConfirmationAccepted>
          <p className="text-green-600">Approved -- sending email...</p>
        </ConfirmationAccepted>

        <ConfirmationRejected>
          <p className="text-orange-600">Email sending was denied.</p>
        </ConfirmationRejected>
      </Confirmation>
    </>
  );
}
```

### Confirmation Component Behavior

- `Confirmation` renders **nothing** if `approval` is undefined or state is `input-streaming`/`input-available`
- `ConfirmationRequest` only renders when `state === 'approval-requested'`
- `ConfirmationAccepted` only renders when `approval.approved === true` and state is `approval-responded`/`output-available`/`output-denied`
- `ConfirmationRejected` only renders when `approval.approved === false` and same states

### Auto-Submit After Approval

```tsx
useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

This ensures the agent loop continues after the recruiter approves/denies.

---

## 7. Multi-Step Tool Calls (Agents)

### Server: stopWhen / maxSteps

```tsx
import { stepCountIs } from 'ai';

streamText({
  model: anthropic('claude-sonnet-4-6'),
  tools: { searchCandidates, enrichCandidate, draftEmail, sendEmail },
  stopWhen: stepCountIs(5),  // Max 5 agent iterations
  // Alternative stopping conditions:
  // stopWhen: hasToolCall('sendEmail'),   // Stop when email is sent
  // stopWhen: isLoopFinished(),            // Run until model stops naturally
});
```

### Client: Auto-continue after tool results

```tsx
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';

useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

This is **critical** for agentic behavior. Without it, the agent stops after each tool call and waits for user to send another message.

### Step Boundaries in UI

The stream includes `step-start` parts to mark boundaries:

```tsx
case 'step-start':
  return index > 0 ? <Separator key={i} className="my-4" /> : null;
```

### Steps Array (server-side)

```tsx
const { text, steps } = await generateText({
  model,
  tools,
  stopWhen: stepCountIs(5),
  prompt: 'Find and email 3 React developers',
});

// steps: Array<{ text, toolCalls, toolResults, finishReason, usage }>
for (const step of steps) {
  console.log(step.toolCalls, step.toolResults);
}
```

---

## 8. Streaming UX

### Conversation Component (auto-scroll)

From source: `src/components/ai-elements/conversation.tsx`

Uses `use-stick-to-bottom` library for auto-scrolling:

```tsx
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from '@/components/ai-elements/conversation';

<Conversation>
  <ConversationContent>
    {messages.length === 0 ? (
      <ConversationEmptyState
        title="OpenRecruiter"
        description="Tell me about the role you're hiring for"
      />
    ) : (
      messages.map(message => <MessageBubble key={message.id} message={message} />)
    )}
  </ConversationContent>
  <ConversationScrollButton />
</Conversation>
```

**Behavior:**
- `Conversation` wraps `StickToBottom` with `initial="smooth"` and `resize="smooth"`
- `ConversationScrollButton` shows a floating arrow-down button when not at bottom
- Uses `useStickToBottomContext()` for `isAtBottom` and `scrollToBottom()`

### MessageResponse Streaming

The `MessageResponse` component uses `Streamdown` for incremental markdown rendering:

```tsx
<MessageResponse isAnimating={status === 'streaming'}>
  {part.text}
</MessageResponse>
```

**Key prop:** `isAnimating` -- when true, Streamdown renders partial markdown gracefully. The component memo compares `children` and `isAnimating` to avoid unnecessary re-renders.

### Throttling

```tsx
useChat({
  experimental_throttle: 50, // ms -- throttle UI updates during streaming
});
```

### smoothStream Transform

```tsx
streamText({
  model,
  prompt,
  experimental_transform: smoothStream(), // Smooth out chunky streams
});
```

---

## 9. File Attachments

### PromptInput Component (from source)

The `PromptInput` component handles:
- File selection via hidden `<input type="file">`
- Drag-and-drop (form-level by default, document-level with `globalDrop`)
- Clipboard paste (images)
- File validation (accept types, maxFiles, maxFileSize)
- Blob URL to data URL conversion on submit

```tsx
<PromptInput
  accept="image/*,application/pdf"
  multiple
  maxFiles={5}
  maxFileSize={10 * 1024 * 1024}  // 10MB
  globalDrop
  onSubmit={({ text, files }) => {
    sendMessage({ text, files });
  }}
  onError={({ code, message }) => toast.error(message)}
>
  <PromptInputHeader>
    <Attachments variant="inline">
      {/* render current attachments */}
    </Attachments>
  </PromptInputHeader>
  <PromptInputTextarea placeholder="Describe the role..." />
  <PromptInputFooter>
    <PromptInputTools>
      <PromptInputActionMenu>
        <PromptInputActionMenuTrigger />
        <PromptInputActionMenuContent>
          <PromptInputActionAddAttachments />
          <PromptInputActionAddScreenshot />
        </PromptInputActionMenuContent>
      </PromptInputActionMenu>
    </PromptInputTools>
    <PromptInputSubmit status={status} onStop={stop} />
  </PromptInputFooter>
</PromptInput>
```

### PromptInputProvider (lift state up)

If you need to access attachment state from outside PromptInput:

```tsx
<PromptInputProvider>
  {/* Attachment count badge in header */}
  <PromptInput onSubmit={handleSubmit}>
    {/* ... */}
  </PromptInput>
</PromptInputProvider>
```

### Sending Files with sendMessage

Files are sent as `FileUIPart[]`:

```tsx
sendMessage({
  text: 'Here is the job description',
  files: [{ type: 'file', url: dataUrl, filename: 'jd.pdf', mediaType: 'application/pdf' }],
});
```

### Attachments Display Component

```tsx
import {
  Attachments, Attachment, AttachmentPreview, AttachmentInfo, AttachmentRemove,
} from '@/components/ai-elements/attachments';

<Attachments variant="grid">  {/* or "inline" | "list" */}
  {files.map(file => (
    <Attachment key={file.id} data={file} onRemove={() => remove(file.id)}>
      <AttachmentPreview />
      <AttachmentInfo />
      <AttachmentRemove />
    </Attachment>
  ))}
</Attachments>
```

---

## 10. Suggestions

### Component (from source: `src/components/ai-elements/suggestion.tsx`)

```tsx
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';

<Suggestions>
  <Suggestion
    suggestion="Search for senior React developers in SF"
    onClick={(text) => sendMessage({ text })}
  />
  <Suggestion
    suggestion="Show my pipeline status"
    onClick={(text) => sendMessage({ text })}
  />
  <Suggestion
    suggestion="Draft outreach email for top candidate"
    onClick={(text) => sendMessage({ text })}
  />
</Suggestions>
```

**Behavior:**
- `Suggestions` is a horizontal `ScrollArea` with hidden scrollbar
- `Suggestion` is a pill-shaped Button (`variant="outline"`, `size="sm"`, rounded-full)
- Clicking calls `onClick(suggestion)` -- wire this to `sendMessage`

---

## 11. Plan and Task Components

### Plan Component (from source: `src/components/ai-elements/plan.tsx`)

The Plan wraps a Radix Collapsible inside a Card. It accepts `isStreaming` for shimmer effects:

```tsx
import {
  Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction,
  PlanTrigger, PlanContent, PlanFooter,
} from '@/components/ai-elements/plan';

<Plan isStreaming={status === 'streaming'} defaultOpen>
  <PlanHeader>
    <div>
      <PlanTitle>Recruiting Pipeline</PlanTitle>
      <PlanDescription>Finding senior React developers in SF Bay Area</PlanDescription>
    </div>
    <PlanAction>
      <PlanTrigger />
    </PlanAction>
  </PlanHeader>
  <PlanContent>
    {/* Task items go here */}
  </PlanContent>
  <PlanFooter>
    <span className="text-muted-foreground text-sm">3 of 5 steps complete</span>
  </PlanFooter>
</Plan>
```

**Key behavior:**
- When `isStreaming={true}`, `PlanTitle` and `PlanDescription` wrap their children in `<Shimmer>` for a loading animation effect
- Uses `data-slot` pattern: `data-slot="plan"`, `data-slot="plan-header"`, etc.
- `PlanContent` is a `CollapsibleContent` that can be toggled by `PlanTrigger`

### Task Component (from source: `src/components/ai-elements/task.tsx`)

```tsx
import { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from '@/components/ai-elements/task';

<Task defaultOpen>
  <TaskTrigger title="Searching Apollo for candidates" />
  <TaskContent>
    <TaskItem>Found 24 matching profiles</TaskItem>
    <TaskItem>
      Enriching top 5 candidates <TaskItemFile>enrichment.json</TaskItemFile>
    </TaskItem>
  </TaskContent>
</Task>
```

**Behavior:**
- `Task` wraps Collapsible (defaultOpen=true)
- `TaskTrigger` shows a search icon + title + chevron
- `TaskContent` renders children inside a left-bordered container

### Data Format for Plans

The AI SDK does not define a specific "plan" message part. Plans are typically implemented as:
1. A custom tool that returns plan data (e.g., `createPlan` tool)
2. Structured JSON in a tool result that you parse and render with Plan/Task components
3. A custom data stream part via `data-plan` type

---

## 12. Reasoning

### Component (from source: `src/components/ai-elements/reasoning.tsx`)

```tsx
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';

<Reasoning isStreaming={status === 'streaming'}>
  <ReasoningTrigger />
  <ReasoningContent>{part.text}</ReasoningContent>
</Reasoning>
```

**Key behavior:**
- Auto-opens when streaming starts (unless `defaultOpen={false}`)
- Auto-closes 1 second after streaming ends (once only)
- Shows "Thinking..." shimmer during streaming
- Shows "Thought for N seconds" after completion
- Duration is auto-calculated from stream start/end

### Server: Enable reasoning

```tsx
return result.toUIMessageStreamResponse({ sendReasoning: true });
```

---

## 13. Sources and Citations

### Component (from source: `src/components/ai-elements/sources.tsx`)

```tsx
import { Sources, SourcesTrigger, SourcesContent, Source } from '@/components/ai-elements/sources';

const sourceParts = message.parts.filter(p => p.type === 'source-url');

{sourceParts.length > 0 && (
  <Sources>
    <SourcesTrigger count={sourceParts.length} />
    <SourcesContent>
      {sourceParts.map(source => (
        <Source key={source.id} href={source.url} title={source.title} />
      ))}
    </SourcesContent>
  </Sources>
)}
```

### Server: Enable sources

```tsx
return result.toUIMessageStreamResponse({ sendSources: true });
```

### Stream Protocol for Sources

```json
{"type":"source-url","sourceId":"...","url":"https://...","title":"..."}
```

---

## 14. Error Handling

### Client-Side

```tsx
const { error, status } = useChat({
  onError: (error) => {
    toast.error('Something went wrong. Please try again.');
    console.error(error);
  },
});

// In UI
{status === 'error' && (
  <div className="text-destructive">
    {error?.message || 'An error occurred'}
    <Button onClick={() => reload()}>Retry</Button>
  </div>
)}
```

### Server-Side Error Masking

By default, errors are masked for security. Customize:

```tsx
return result.toUIMessageStreamResponse({
  onError: (error) => {
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred';
  },
});
```

### Tool Execution Errors

Client-side tools can report errors:

```tsx
addToolOutput({
  tool: 'enrichCandidate',
  toolCallId,
  state: 'output-error',
  errorText: 'Apollo API rate limit exceeded',
});
```

The Tool component's `ToolOutput` handles error display with red styling:

```tsx
<ToolOutput output={part.output} errorText={part.errorText} />
// When errorText is truthy: shows "Error" label with destructive styling
```

### Stream Protocol Error

```json
{"type":"error","errorText":"error message"}
```

---

## 15. Customization and Theming

### Architecture

AI Elements components:
- Are installed as source code into `src/components/ai-elements/`
- Build on shadcn/ui primitives (Button, Card, Collapsible, Badge, etc.)
- Use shadcn/ui CSS variables for theming
- Accept `className` props on every component
- Use Tailwind CSS classes that reference CSS variables

### Key CSS Variables (inherited from shadcn/ui)

```css
/* In your globals.css -- these control ai-elements components */
:root {
  --background: ...;
  --foreground: ...;
  --muted: ...;
  --muted-foreground: ...;
  --accent: ...;
  --accent-foreground: ...;
  --destructive: ...;
  --border: ...;
  --secondary: ...;
  --primary: ...;
}

.dark {
  /* Dark mode overrides -- ai-elements automatically picks these up */
}
```

### data-slot Pattern

Some components use `data-slot` attributes for targeted CSS:

```tsx
// In plan.tsx:
<Collapsible data-slot="plan" />
<CardHeader data-slot="plan-header" />
<CardTitle data-slot="plan-title" />
```

This enables CSS targeting like:
```css
[data-slot="plan"] { /* ... */ }
```

### Dark Mode

The components are dark-mode-native. Key patterns:
- Conversation scroll button: `dark:bg-background dark:hover:bg-muted`
- User messages: `group-[.is-user]:bg-secondary`
- Tool errors: `bg-destructive/10 text-destructive`

### Customizing Components

Since components are source code, you can directly edit them:

```tsx
// src/components/ai-elements/tool.tsx
// Change status icons, colors, labels, layout -- it's your code
```

### className Overrides

Every component accepts className:

```tsx
<Tool className="border-blue-500/20">
  <ToolHeader className="bg-blue-500/5" type={...} state={...} />
</Tool>
```

---

## 16. Full Wiring Example

### Route Handler: `src/app/api/chat/route.ts`

```tsx
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const tools = {
  searchCandidates: tool({
    description: 'Search for candidates matching job criteria',
    inputSchema: z.object({
      title: z.string(),
      location: z.string().optional(),
      skills: z.array(z.string()).optional(),
    }),
    execute: async ({ title, location, skills }) => {
      // Apollo API call
      return { candidates: [...] };
    },
  }),

  enrichCandidate: tool({
    description: 'Enrich candidate with full contact info (costs credits)',
    inputSchema: z.object({ candidateId: z.string() }),
    needsApproval: true,
    execute: async ({ candidateId }) => {
      return { email: '...', phone: '...' };
    },
  }),

  sendEmail: tool({
    description: 'Send outreach email to candidate',
    inputSchema: z.object({
      candidateId: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
    needsApproval: true,
    execute: async ({ candidateId, subject, body }) => {
      return { messageId: '...', status: 'sent' };
    },
  }),
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `You are OpenRecruiter, an expert AI recruiting assistant...`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
  });
}
```

### Page Component: `src/app/page.tsx`

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls,
         lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

import { Conversation, ConversationContent, ConversationScrollButton, ConversationEmptyState } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Confirmation, ConfirmationTitle, ConfirmationRequest, ConfirmationAccepted, ConfirmationRejected, ConfirmationActions, ConfirmationAction } from '@/components/ai-elements/confirmation';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { Sources, SourcesTrigger, SourcesContent, Source } from '@/components/ai-elements/sources';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputSubmit, PromptInputActionMenu, PromptInputActionMenuTrigger, PromptInputActionMenuContent, PromptInputActionAddAttachments } from '@/components/ai-elements/prompt-input';

export default function ChatPage() {
  const { messages, sendMessage, status, stop, addToolApprovalResponse } = useChat({
    sendAutomaticallyWhen: (messages) =>
      lastAssistantMessageIsCompleteWithToolCalls(messages) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(messages),
  });

  return (
    <div className="flex h-dvh flex-col">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState title="OpenRecruiter" description="Tell me about the role..." />
          ) : (
            messages.map(message => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <MessageResponse
                            key={i}
                            isAnimating={status === 'streaming'}
                          >
                            {part.text}
                          </MessageResponse>
                        );

                      case 'reasoning':
                        return (
                          <Reasoning key={i} isStreaming={status === 'streaming'}>
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );

                      case 'step-start':
                        return i > 0 ? <div key={i} className="border-t border-border my-4" /> : null;

                      default:
                        // Tool parts
                        if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                          const toolName = part.type === 'dynamic-tool'
                            ? part.toolName
                            : part.type.replace('tool-', '');

                          return (
                            <div key={i}>
                              <Tool>
                                <ToolHeader type={part.type} state={part.state}
                                  toolName={part.type === 'dynamic-tool' ? part.toolName : undefined} />
                                <ToolContent>
                                  <ToolInput input={part.input} />
                                  <ToolOutput output={part.output} errorText={part.errorText} />
                                </ToolContent>
                              </Tool>

                              <Confirmation approval={part.approval} state={part.state}>
                                <ConfirmationTitle>
                                  Approve {toolName}?
                                </ConfirmationTitle>
                                <ConfirmationRequest>
                                  <ConfirmationActions>
                                    <ConfirmationAction variant="outline"
                                      onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: false })}>
                                      Deny
                                    </ConfirmationAction>
                                    <ConfirmationAction
                                      onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: true })}>
                                      Approve
                                    </ConfirmationAction>
                                  </ConfirmationActions>
                                </ConfirmationRequest>
                                <ConfirmationAccepted>Approved</ConfirmationAccepted>
                                <ConfirmationRejected>Denied</ConfirmationRejected>
                              </Confirmation>
                            </div>
                          );
                        }

                        // Source parts
                        if (part.type === 'source-url') {
                          return <Source key={i} href={part.url} title={part.title} />;
                        }

                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {messages.length === 0 && (
        <Suggestions>
          <Suggestion suggestion="Find senior React developers in SF" onClick={t => sendMessage({ text: t })} />
          <Suggestion suggestion="Show pipeline for Engineering Manager role" onClick={t => sendMessage({ text: t })} />
        </Suggestions>
      )}

      <PromptInput onSubmit={({ text, files }) => sendMessage({ text, files })}>
        <PromptInputTextarea placeholder="Tell me about the role..." />
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="Attach job description" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
```

---

## Stream Protocol Wire Format

The data stream uses SSE with header `x-vercel-ai-ui-message-stream: v1`:

```
data: {"type":"start","messageId":"msg_123"}
data: {"type":"text-start","id":"text_1"}
data: {"type":"text-delta","id":"text_1","delta":"Hello"}
data: {"type":"text-delta","id":"text_1","delta":", I found"}
data: {"type":"text-end","id":"text_1"}
data: {"type":"tool-input-start","toolCallId":"call_1","toolName":"searchCandidates"}
data: {"type":"tool-input-delta","toolCallId":"call_1","inputTextDelta":"{\"title\":\"React\"}"}
data: {"type":"tool-input-available","toolCallId":"call_1","toolName":"searchCandidates","input":{"title":"React"}}
data: {"type":"tool-output-available","toolCallId":"call_1","output":{"candidates":[...]}}
data: {"type":"reasoning-start","id":"reasoning_1"}
data: {"type":"reasoning-delta","id":"reasoning_1","delta":"Let me think..."}
data: {"type":"reasoning-end","id":"reasoning_1"}
data: {"type":"source-url","sourceId":"src_1","url":"https://...","title":"..."}
data: {"type":"start-step"}
data: {"type":"finish-step"}
data: {"type":"finish"}
data: [DONE]
```

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `ai` | Core SDK -- useChat, streamText, tool, UIMessage types |
| `@ai-sdk/react` | React hooks -- useChat, useCompletion |
| `@ai-sdk/anthropic` | Anthropic provider |
| `zod` | Tool input schema definitions |
| `use-stick-to-bottom` | Auto-scroll in Conversation |
| `streamdown` | Streaming markdown renderer in MessageResponse |
| `@streamdown/code`, `@streamdown/math`, `@streamdown/mermaid`, `@streamdown/cjk` | Streamdown plugins |

---

## Key Imports Cheat Sheet

```tsx
// Core SDK
import { streamText, generateText, UIMessage, convertToModelMessages, tool, stepCountIs, hasToolCall, isLoopFinished } from 'ai';
import { lastAssistantMessageIsCompleteWithToolCalls, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

// React hooks
import { useChat } from '@ai-sdk/react';

// Provider
import { anthropic } from '@ai-sdk/anthropic';

// Types
import type { UIMessage, ChatStatus, ToolUIPart, DynamicToolUIPart, FileUIPart, SourceDocumentUIPart } from 'ai';
```
