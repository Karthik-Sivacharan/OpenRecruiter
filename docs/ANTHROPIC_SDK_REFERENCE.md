# Anthropic SDK & API Reference for OpenRecruiter

Research compiled from official Anthropic documentation and Vercel AI SDK docs (April 2026).

---

## Table of Contents

1. [Model Selection & Capabilities](#1-model-selection--capabilities)
2. [Tool Use / Function Calling](#2-tool-use--function-calling)
3. [Defining Tools](#3-defining-tools)
4. [Handling Tool Calls & The Agentic Loop](#4-handling-tool-calls--the-agentic-loop)
5. [Parallel Tool Use](#5-parallel-tool-use)
6. [Strict Tool Use](#6-strict-tool-use)
7. [Extended & Adaptive Thinking](#7-extended--adaptive-thinking)
8. [Streaming with Tools](#8-streaming-with-tools)
9. [Token Management & Context Windows](#9-token-management--context-windows)
10. [Error Handling & Rate Limits](#10-error-handling--rate-limits)
11. [Vercel AI SDK (@ai-sdk/anthropic)](#11-vercel-ai-sdk-ai-sdkanthropic)
12. [Prompt Engineering Best Practices](#12-prompt-engineering-best-practices)
13. [Agentic System Patterns](#13-agentic-system-patterns)
14. [OpenRecruiter-Specific Recommendations](#14-openrecruiter-specific-recommendations)

---

## 1. Model Selection & Capabilities

### Latest Models (as of April 2026)

| Feature | Claude Opus 4.7 | Claude Sonnet 4.6 | Claude Haiku 4.5 |
|:--------|:----------------|:-------------------|:-----------------|
| **API ID** | `claude-opus-4-7` | `claude-sonnet-4-6` | `claude-haiku-4-5` |
| **Context Window** | 1M tokens (~555k words) | 1M tokens (~750k words) | 200k tokens |
| **Max Output** | 128k tokens | 64k tokens | 64k tokens |
| **Pricing (input/output per MTok)** | $5 / $25 | $3 / $15 | $1 / $5 |
| **Extended Thinking** | No | Yes | Yes |
| **Adaptive Thinking** | Yes | Yes | No |
| **Latency** | Moderate | Fast | Fastest |
| **Knowledge Cutoff** | Jan 2026 | Aug 2025 | Feb 2025 |

### Legacy Models Still Available

| Feature | Claude Opus 4.6 | Claude Sonnet 4.5 |
|:--------|:----------------|:-------------------|
| **API ID** | `claude-opus-4-6` | `claude-sonnet-4-5` |
| **Context Window** | 1M tokens | 200k tokens |
| **Max Output** | 128k tokens | 64k tokens |
| **Pricing** | $5 / $25 | $3 / $15 |
| **Extended Thinking** | Yes | Yes |

### Model Selection for OpenRecruiter

- **Claude Sonnet 4.6** -- Use for most pipeline tasks: sourcing, enrichment dispatch, email drafting, CRM updates. Best speed/intelligence ratio. 1M context window is more than sufficient for our tool-heavy workflows.
- **Claude Opus 4.7** -- Use for complex scoring/analysis tasks, candidate deep evaluation, and long-horizon agentic orchestration. Best at handling many tools, more likely to ask clarifying questions vs guessing. Step-change improvement in agentic coding.
- **Claude Opus 4.6** -- Viable alternative for scoring. Supports extended thinking with budget_tokens (deprecated but functional).
- **Claude Haiku 4.5** -- Use for lightweight tasks only (e.g., simple classification, quick reformatting). May infer missing parameters rather than asking.

### Key Behavioral Differences

- **Opus 4.7** is more literal in instruction following, especially at lower effort levels. It uses tools less often than Opus 4.6, preferring reasoning. Increase `effort` to `high` or `xhigh` to increase tool usage.
- **Opus models** are far more likely to recognize missing parameters and ask clarifying questions. Sonnet models may guess values.
- **Opus 4.7** does NOT support extended thinking (returns 400). Use adaptive thinking instead.
- **Prefilled assistant messages** are NOT supported on Opus 4.7, Opus 4.6, and Sonnet 4.6.

---

## 2. Tool Use / Function Calling

### How It Works

Tool use is a contract: you define available operations and their schemas; Claude decides when and how to call them. The model never executes anything -- it emits structured requests, your code runs the operation, and results flow back into the conversation.

### Three Types of Tools

| Type | Execution | Description |
|:-----|:----------|:------------|
| **User-defined (client)** | Your code | You write schema + execute. This is what OpenRecruiter uses for Apollo, enrichment, email, etc. |
| **Anthropic-schema (client)** | Your code | Anthropic publishes schema (bash, text_editor, computer, memory). Trained-in for reliability. |
| **Server-executed** | Anthropic's servers | web_search, web_fetch, code_execution, tool_search. No `tool_result` needed from you. |

### The Agentic Loop (Client Tools)

```
1. Send request with `tools` array + user message
2. Claude responds with stop_reason: "tool_use" and tool_use blocks
3. Execute each tool. Format outputs as tool_result blocks.
4. Send new request with original messages + assistant response + tool_results
5. Repeat from step 2 while stop_reason == "tool_use"
6. Loop exits on "end_turn", "max_tokens", "stop_sequence", or "refusal"
```

### Stop Reasons

- `"end_turn"` -- Claude produced a final answer
- `"tool_use"` -- Claude wants to call one or more tools
- `"max_tokens"` -- Output limit reached
- `"stop_sequence"` -- Custom stop sequence hit
- `"refusal"` -- Claude refused the request
- `"pause_turn"` -- Server-side tool loop hit iteration limit (re-send to continue)

---

## 3. Defining Tools

### Tool Definition Schema

Each tool requires:

```json
{
  "name": "tool_name",           // Must match ^[a-zA-Z0-9_-]{1,64}$
  "description": "Detailed...",   // Critical for performance. 3-4+ sentences.
  "input_schema": {               // Standard JSON Schema
    "type": "object",
    "properties": { ... },
    "required": ["..."]
  },
  "input_examples": [...]         // Optional. Schema-validated examples.
}
```

Optional properties: `cache_control`, `strict`, `defer_loading`, `allowed_callers`.

### Tool Definition Best Practices (from Anthropic docs)

1. **Provide extremely detailed descriptions.** This is the single most important factor. Explain what the tool does, when to use it (and when NOT to), what each parameter means, any caveats. Aim for 3-4+ sentences.

2. **Consolidate related operations into fewer tools.** Rather than `create_pr`, `review_pr`, `merge_pr` -- use one tool with an `action` parameter. Fewer, more capable tools reduce ambiguity.

3. **Use meaningful namespacing.** Prefix names with service: `apollo_search_people`, `enrichlayer_enrich`, `agentmail_send`. Critical when using tool search.

4. **Return only high-signal information.** Return semantic identifiers (slugs, UUIDs), not opaque internal references. Include only fields Claude needs for next step. Bloated responses waste context.

5. **Use `input_examples` for complex tools.** 20-50 tokens for simple examples, 100-200 for complex nested objects.

### tool_choice Parameter

```typescript
tool_choice: { type: "auto" }    // Default. Claude decides.
tool_choice: { type: "any" }     // Must use one of the provided tools.
tool_choice: { type: "tool", name: "get_weather" }  // Force specific tool.
tool_choice: { type: "none" }    // No tools allowed.
```

**Important**: With `any` or `tool`, the API prefills assistant message, so Claude will NOT emit natural language before the tool call. With extended thinking, only `auto` and `none` are supported.

### Token Cost of Tool Schemas

When tools are provided, Anthropic injects a special system prompt:

| Model | tool_choice auto/none | tool_choice any/tool |
|:------|:---------------------|:--------------------|
| Opus 4.7 / 4.6 / Sonnet 4.6 | 346 tokens | 313 tokens |
| Haiku 4.5 | 346 tokens | 313 tokens |
| Haiku 3.5 | 264 tokens | 340 tokens |

These are base overhead tokens. Individual tool schemas add more tokens based on their size.

---

## 4. Handling Tool Calls & The Agentic Loop

### Response Structure (tool_use block)

```json
{
  "id": "msg_01Aq9w938a90dw8q",
  "model": "claude-opus-4-7",
  "stop_reason": "tool_use",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'll search for candidates matching your criteria."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "apollo_search_people",
      "input": { "job_titles": ["Senior Engineer"], "location": "SF Bay Area" }
    }
  ]
}
```

### Sending Tool Results Back

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "Found 47 candidates matching criteria..."
    }
  ]
}
```

### Critical Formatting Rules

1. **Tool result blocks MUST immediately follow** their corresponding tool_use blocks in message history. No messages between assistant's tool_use and user's tool_result.

2. **In the user message containing tool results, `tool_result` blocks MUST come FIRST** in the content array. Any text MUST come AFTER all tool results.

```json
// WRONG - will cause 400 error:
{ "role": "user", "content": [
    { "type": "text", "text": "Here are results:" },
    { "type": "tool_result", "tool_use_id": "toolu_01" }
]}

// CORRECT:
{ "role": "user", "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "..." },
    { "type": "text", "text": "What should I do next?" }
]}
```

### Error Handling in Tool Results

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
  "content": "Rate limit exceeded on Apollo API. Retry after 60 seconds.",
  "is_error": true
}
```

Write instructive error messages. Instead of `"failed"`, include what went wrong and what Claude should try next. Claude will retry 2-3 times with corrections for invalid tool calls.

### Tool Result Content Types

Results can be:
- Simple string: `"content": "15 degrees"`
- Array of content blocks: `"content": [{"type": "text", "text": "..."}, {"type": "image", ...}]`
- Document blocks: `"content": [{"type": "document", "source": {...}}]`
- Empty (for side-effect-only tools): just omit `content`

---

## 5. Parallel Tool Use

Claude can call multiple tools simultaneously in a single response. This is enabled by default.

### How It Works

Claude returns multiple `tool_use` blocks in a single response. You must return ALL tool results in a SINGLE user message.

```json
// Claude's response with parallel tool calls:
{ "role": "assistant", "content": [
    { "type": "tool_use", "id": "toolu_01", "name": "apollo_search", "input": {...} },
    { "type": "tool_use", "id": "toolu_02", "name": "enrichlayer_enrich", "input": {...} }
]}

// Your response - ALL results in ONE message:
{ "role": "user", "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "..." },
    { "type": "tool_result", "tool_use_id": "toolu_02", "content": "..." }
]}
```

### Disabling Parallel Tool Use

```typescript
tool_choice: { type: "auto", disable_parallel_tool_use: true }
// Ensures at most one tool per response
```

In Vercel AI SDK:
```typescript
providerOptions: {
  anthropic: { disableParallelToolUse: true }
}
```

### Maximizing Parallel Tool Use (System Prompt)

```text
<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls,
make all of the independent tool calls in parallel. Prioritize calling tools simultaneously
whenever the actions can be done in parallel rather than sequentially. For example, when
enriching 3 candidates, run 3 tool calls in parallel. However, if some tool calls depend
on previous calls to inform dependent values, do NOT call these tools in parallel.
</use_parallel_tool_calls>
```

### Common Pitfall

Sending separate user messages for each tool result "teaches" Claude to avoid parallel calls:

```json
// WRONG - breaks parallel tool use:
[
  {"role": "assistant", "content": [tool_use_1, tool_use_2]},
  {"role": "user", "content": [tool_result_1]},
  {"role": "user", "content": [tool_result_2]}
]

// CORRECT - maintains parallel tool use:
[
  {"role": "assistant", "content": [tool_use_1, tool_use_2]},
  {"role": "user", "content": [tool_result_1, tool_result_2]}
]
```

---

## 6. Strict Tool Use

Adding `strict: true` to a tool definition uses grammar-constrained sampling to guarantee Claude's tool inputs match your JSON Schema exactly.

### Why Use It

- Functions receive correctly-typed arguments every time
- No need to validate and retry tool calls
- Eliminates `"2"` instead of `2` type mismatches
- Eliminates missing required fields

### How to Enable

```json
{
  "name": "apollo_search_people",
  "description": "...",
  "strict": true,
  "input_schema": {
    "type": "object",
    "properties": { ... },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

### Guarantees

- Tool `input` strictly follows the `input_schema`
- Tool `name` is always valid (from provided tools)

### Limitations

- Must use the supported JSON Schema subset (see Anthropic structured outputs docs)
- Schema compilation has up to 24-hour cache
- PHI must NOT be included in schema definitions (property names, enums, etc.)

---

## 7. Extended & Adaptive Thinking

### Adaptive Thinking (Recommended for Opus 4.7 + Sonnet 4.6)

Adaptive thinking lets Claude dynamically decide when and how much to think. It calibrates based on the `effort` parameter and query complexity.

```python
# Anthropic API directly:
client.messages.create(
    model="claude-opus-4-7",
    max_tokens=64000,
    thinking={"type": "adaptive"},
    output_config={"effort": "xhigh"},  # "low"|"medium"|"high"|"xhigh"|"max"
    messages=[...]
)
```

```typescript
// Vercel AI SDK:
providerOptions: {
  anthropic: {
    thinking: { type: 'adaptive' },
    effort: 'xhigh'
  }
}
```

### Effort Levels

| Level | Use Case |
|:------|:---------|
| `max` | Intelligence-demanding tasks. May show diminishing returns. |
| `xhigh` | Best for coding and agentic use cases. |
| `high` | Balances token usage and intelligence. Minimum for most intelligence-sensitive tasks. |
| `medium` | Cost-sensitive use cases trading off intelligence. |
| `low` | Short, scoped tasks and latency-sensitive workloads. |

### Extended Thinking (Legacy, for Sonnet 4.6 / Opus 4.6)

```python
# Still functional but deprecated on Sonnet 4.6 / Opus 4.6:
client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    messages=[...]
)
```

- `budget_tokens` must be less than `max_tokens`
- Budget beyond 32k usually not beneficial
- NOT supported on Opus 4.7 (returns 400 error)

### Extended Thinking + Tool Use

**Critical**: When using extended thinking with tool use, you MUST pass back thinking blocks from the assistant's previous response:

```python
# After getting response with thinking + tool_use blocks:
thinking_block = next(b for b in response.content if b.type == "thinking")
tool_use_block = next(b for b in response.content if b.type == "tool_use")

# Send BOTH back:
messages=[
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": [thinking_block, tool_use_block]},
    {"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": tool_use_block.id, "content": "..."}
    ]}
]
```

### Interleaved Thinking

Allows Claude to reason BETWEEN tool calls (not just before the first one). Available automatically with adaptive thinking on Opus 4.7 and Opus 4.6.

Without interleaved thinking:
```
[thinking] -> [tool_use] -> tool_result -> [tool_use] -> tool_result -> [text]
```

With interleaved thinking:
```
[thinking] -> [tool_use] -> tool_result -> [thinking] -> [tool_use] -> tool_result -> [thinking] -> [text]
```

### Constraints

- `tool_choice: "any"` and `tool_choice: "tool"` are NOT supported with extended thinking (only `auto` and `none`)
- Cannot toggle thinking mid-turn (tool use loops are part of one continuous assistant turn)

### Thinking Display Options

- `"summarized"` -- Returns condensed summary. Charged for full thinking tokens.
- `"omitted"` -- Returns empty thinking with signature only. Faster time-to-first-token.

```typescript
// Vercel AI SDK:
providerOptions: {
  anthropic: {
    thinking: { type: 'adaptive', display: 'summarized' }
  }
}
```

---

## 8. Streaming with Tools

### Vercel AI SDK Stream Events

When using `streamText` with tools, the `fullStream` provides these events:

| Event | Description |
|:------|:------------|
| `tool-call` | A tool was invoked (name + args) |
| `tool-input-start` | Tool input streaming begins |
| `tool-input-delta` | Incremental tool input JSON |
| `tool-input-end` | Tool input streaming complete |
| `tool-result` | Result returned from tool execution |
| `tool-error` | Error during tool execution |

### Streaming with Anthropic Directly

When streaming, thinking content arrives via `thinking_delta` events. Tool use blocks appear as `content_block_start` / `content_block_delta` events.

### Key Streaming Consideration

Streaming chunks may arrive in "chunky" alternating patterns (larger then smaller). This is expected behavior with thinking enabled.

### Vercel AI SDK Tool Streaming

Tool streaming is enabled by default in `@ai-sdk/anthropic`. Disable with:

```typescript
providerOptions: {
  anthropic: { toolStreaming: false }
}
```

---

## 9. Token Management & Context Windows

### Context Window Sizes

- **Opus 4.7**: 1M tokens (~555k words, new tokenizer)
- **Sonnet 4.6**: 1M tokens (~750k words)
- **Opus 4.6**: 1M tokens (~750k words)
- **Haiku 4.5**: 200k tokens

### What Counts Against the Context

1. System prompt tokens
2. Tool use system prompt overhead (313-346 tokens base)
3. All tool definitions (names, descriptions, schemas)
4. All messages in the conversation (user + assistant)
5. All tool_use and tool_result blocks
6. Thinking tokens (if using extended/adaptive thinking)

### Max Request Size

- Messages API: 32 MB
- Batch API: 256 MB

### Prompt Caching

Mark content for caching to reduce costs on repeated requests:

```typescript
// Vercel AI SDK:
content: [{
  type: 'text',
  text: 'your large context here',
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } }
  }
}]
```

With TTL: `{ type: 'ephemeral', ttl: '1h' }`

Minimum cacheable lengths:
- 4096 tokens: Opus 4.5, Haiku 4.5
- 1024 tokens: Sonnet 4.5, Opus 4.1, Haiku 3.5

### Context Management (Vercel AI SDK)

The Vercel AI SDK provides automatic context management:

```typescript
// Clear old tool uses when context gets large:
contextManagement: {
  edits: [{
    type: 'clear_tool_uses_20250919',
    trigger: { type: 'input_tokens', value: 10000 },
    keep: { type: 'tool_uses', value: 5 },
    clearAtLeast: { type: 'input_tokens', value: 1000 },
    clearToolInputs: true,
    excludeTools: ['important_tool']
  }]
}

// Auto-compaction (summarize long conversations):
{
  type: 'compact_20260112',
  trigger: { type: 'input_tokens', value: 50000 },
  instructions: 'Summarize concisely...',
}
```

---

## 10. Error Handling & Rate Limits

### HTTP Error Codes

| Code | Type | Description |
|:-----|:-----|:------------|
| 400 | `invalid_request_error` | Bad request format. Also covers other 4XX not listed. |
| 401 | `authentication_error` | Bad API key. |
| 402 | `billing_error` | Payment issue. |
| 403 | `permission_error` | API key lacks permission. |
| 404 | `not_found_error` | Resource not found. |
| 413 | `request_too_large` | Exceeds 32 MB limit. |
| 429 | `rate_limit_error` | Rate limit hit. Also: acceleration limits on sharp traffic spikes. |
| 500 | `api_error` | Internal Anthropic error. |
| 504 | `timeout_error` | Request timed out. Use streaming for long requests. |
| 529 | `overloaded_error` | API temporarily overloaded. |

### Error Response Format

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "You have exceeded your rate limit."
  },
  "request_id": "req_011CSHoEeqs5C35K2UUqR7Fy"
}
```

### Retry Strategy

- **429**: Back off exponentially. Check for acceleration limits (ramp traffic gradually).
- **529**: Retry with backoff. This is a temporary overload across all users.
- **500**: Retry with backoff.
- **504**: Switch to streaming for long-running requests.

### Streaming Error Caveat

When receiving streaming responses via SSE, errors can occur AFTER returning a 200 response, so standard HTTP error handling won't catch them. Handle errors in the stream event handler.

### Long Requests

For requests over 10 minutes, use streaming or the Batch API. Set TCP socket keep-alive to reduce idle connection timeouts. The SDKs validate non-streaming requests won't exceed 10-minute timeout.

---

## 11. Vercel AI SDK (@ai-sdk/anthropic)

### Installation & Setup

```bash
pnpm add @ai-sdk/anthropic
```

```typescript
import { anthropic } from '@ai-sdk/anthropic';
// Or custom:
import { createAnthropic } from '@ai-sdk/anthropic';
const anthropic = createAnthropic({ apiKey: '...' });
```

Authentication: defaults to `ANTHROPIC_API_KEY` env var.

### Model Creation

```typescript
const model = anthropic('claude-sonnet-4-6');
// Aliases:
anthropic.languageModel('claude-opus-4-7');
anthropic.chat('claude-opus-4-7');
```

### Provider-Specific Options

```typescript
providerOptions: {
  anthropic: {
    // Tool behavior
    disableParallelToolUse: false,
    toolStreaming: true,

    // Thinking
    thinking: { type: 'adaptive' },
    effort: 'xhigh',

    // Reasoning display
    sendReasoning: true,

    // Performance
    speed: 'fast',                    // "fast" | "standard"

    // Data residency
    inferenceGeo: 'us',              // "us" | "global"

    // Metadata
    metadata: { userId: 'user_123' },
  }
}
```

### Tool Definition (Vercel AI SDK way)

```typescript
import { z } from 'zod';
import { tool, streamText } from 'ai';

const apolloSearch = tool({
  description: 'Search Apollo.io for potential candidates matching criteria',
  inputSchema: z.object({
    job_titles: z.array(z.string()).describe('Target job titles'),
    location: z.string().describe('Geographic location filter'),
    skills: z.array(z.string()).optional().describe('Required skills'),
  }),
  execute: async ({ job_titles, location, skills }) => {
    // Call Apollo API
    return { candidates: [...], total: 47 };
  },
});
```

### Multi-Step Tool Use (Agentic Loop)

```typescript
import { streamText, stepCountIs } from 'ai';

const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  tools: {
    apollo_search: apolloSearch,
    enrich_candidate: enrichTool,
    send_email: emailTool,
  },
  stopWhen: stepCountIs(10),  // Max 10 tool-call rounds
  onStepFinish({ stepNumber, toolCalls, toolResults, finishReason }) {
    console.log(`Step ${stepNumber}: ${finishReason}`);
  },
  prompt: 'Find senior engineers in SF and enrich their profiles',
});
```

Built-in stop conditions:
- `stepCountIs(count)` -- stops after N steps (default limit: 20)
- `hasToolCall(toolName)` -- stops when specific tool is called
- `isLoopFinished()` -- never triggers (infinite loop until model stops)

### Human-in-the-Loop (Tool Approval)

```typescript
const sendEmail = tool({
  description: 'Send outreach email to candidate',
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: true,  // Always require approval
  execute: async ({ to, subject, body }) => {
    // Send via AgentMail
  },
});

// Dynamic approval based on inputs:
const spendCredits = tool({
  description: 'Spend enrichment credits',
  inputSchema: z.object({
    credits: z.number(),
    service: z.string(),
  }),
  needsApproval: async ({ credits }) => credits > 10,
  execute: async ({ credits, service }) => { ... },
});
```

Approval flow:
1. First call returns `tool-approval-request` parts
2. Frontend shows approval UI
3. User approves/denies
4. Add `tool-approval-response` to messages
5. Second call executes (if approved) or skips

### Tool Execution Lifecycle

```typescript
const result = streamText({
  // ...
  experimental_onToolCallStart({ toolName, toolCallId, input }) {
    // Show "Searching Apollo..." in UI
  },
  experimental_onToolCallFinish({ toolName, durationMs, output, error }) {
    // Log tool performance metrics
  },
});
```

### Tool Input Streaming

```typescript
const myTool = tool({
  // ...
  onInputStart: () => { /* Show tool call starting */ },
  onInputDelta: ({ inputTextDelta }) => { /* Stream partial JSON */ },
  onInputAvailable: ({ input }) => { /* Full input ready */ },
});
```

### Tool Choice

```typescript
toolChoice: 'auto'     // Model decides (default)
toolChoice: 'required' // Must call a tool
toolChoice: 'none'     // No tools
toolChoice: { type: 'tool', toolName: 'apollo_search' }  // Force specific
```

### Active Tools (Limit Available Tools)

```typescript
const result = await generateText({
  tools: allTools,
  activeTools: ['apollo_search', 'enrich_candidate'],  // Only expose subset
});
```

### Provider-Defined Tools

```typescript
// Web search:
anthropic.tools.webSearch_20250305({
  maxUses: 5,
  allowedDomains: ['linkedin.com', 'github.com'],
})

// Code execution sandbox:
anthropic.tools.codeExecution_20260120()

// Web fetch:
anthropic.tools.webFetch_20250910({ maxUses: 1 })
```

### Prompt Caching in Vercel AI SDK

```typescript
const result = await streamText({
  model: anthropic('claude-sonnet-4-6'),
  system: [{
    type: 'text',
    text: largeSystemPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } }
    }
  }],
  messages: [...],
});

// Check cache usage:
result.providerMetadata?.anthropic?.cacheCreationInputTokens
```

### PDF Support

```typescript
messages: [{
  role: 'user',
  content: [
    { type: 'text', text: 'Analyze this resume...' },
    { type: 'file', data: pdfBuffer, mediaType: 'application/pdf' }
  ]
}]
```

---

## 12. Prompt Engineering Best Practices

### General Principles

1. **Be clear and direct.** Show your prompt to a colleague; if they'd be confused, Claude will be too.
2. **Add context/motivation.** Explain WHY something is important, not just what to do.
3. **Use examples.** 3-5 diverse, relevant examples wrapped in `<example>` tags.
4. **Structure with XML tags.** `<instructions>`, `<context>`, `<input>`, `<documents>`.
5. **Give Claude a role** in the system prompt.

### Tool Use Prompting

Claude's latest models benefit from explicit direction to use specific tools:

```text
// Less effective (Claude may just suggest):
"Can you suggest some candidates?"

// More effective (Claude will use tools):
"Search Apollo for candidates matching these criteria and enrich the top 10."
```

To make Claude proactive about using tools:

```text
<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent
is unclear, infer the most useful likely action and proceed, using tools to discover
any missing details instead of guessing.
</default_to_action>
```

### Parallel Tool Calling Prompt

```text
<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls,
make all of the independent tool calls in parallel. For example, when enriching 3 candidates,
run 3 enrichment calls in parallel. However, if some tool calls depend on previous calls,
do NOT call these tools in parallel. Never use placeholders or guess missing parameters.
</use_parallel_tool_calls>
```

### Thinking Guidance

```text
After receiving tool results, carefully reflect on their quality and determine optimal
next steps before proceeding. Use your thinking to plan and iterate based on this new
information, and then take the best next action.
```

To reduce overthinking:

```text
Thinking adds latency and should only be used when it will meaningfully improve answer
quality -- typically for problems that require multi-step reasoning. When in doubt,
respond directly.
```

### Communication Style

Claude may skip verbal summaries after tool calls. If you want progress updates:

```text
After completing a task that involves tool use, provide a quick summary of the work you've done.
```

### Long Context Best Practices

- Put longform data at the TOP of the prompt, above queries/instructions
- Structure documents with XML tags (`<document>`, `<document_content>`, `<source>`)
- Ask Claude to quote relevant parts before answering
- Queries at the end improve quality by up to 30%

---

## 13. Agentic System Patterns

### Balancing Autonomy and Safety

```text
Consider the reversibility and potential impact of your actions. You are encouraged
to take local, reversible actions like searching and enriching, but for actions that
are hard to reverse or affect external systems (sending emails, spending credits),
ask the user before proceeding.

Examples of actions that warrant confirmation:
- Sending outreach emails to candidates
- Spending enrichment credits (over 10 per batch)
- Updating CRM records
- Creating email campaigns
```

### Subagent Orchestration

Claude 4.6+ can recognize when to delegate to specialized subagents:

```text
Use subagents when tasks can run in parallel, require isolated context, or involve
independent workstreams. For simple tasks, sequential operations, or tasks where you
need to maintain context across steps, work directly rather than delegating.
```

### State Management

- Use structured JSON for state data (progress tracking, candidate scores)
- Use freeform text for progress notes
- Save progress before context window limits

### Context Window Management

```text
Your context window will be automatically compacted as it approaches its limit,
allowing you to continue working indefinitely from where you left off. Do not stop
tasks early due to token budget concerns.
```

### Minimizing Hallucinations

```text
<investigate_before_answering>
Never speculate about data you have not retrieved. If the user references a specific
candidate or company, you MUST use the appropriate tool to look up the data before
answering. Give grounded, hallucination-free answers based on actual tool results.
</investigate_before_answering>
```

---

## 14. OpenRecruiter-Specific Recommendations

### Model Routing Strategy

| Task | Model | Effort | Thinking |
|:-----|:------|:-------|:---------|
| Chat orchestration / routing | Sonnet 4.6 | medium | adaptive |
| Apollo search + enrichment dispatch | Sonnet 4.6 | medium | adaptive |
| Candidate scoring/ranking | Opus 4.7 | high/xhigh | adaptive |
| Deep analysis (Nia Tracer) | Opus 4.7 | xhigh | adaptive |
| Email drafting | Sonnet 4.6 | medium | adaptive |
| Campaign management | Sonnet 4.6 | medium | adaptive |

### Tool Naming Convention

Use namespaced tool names for clarity:
- `apollo_search_people`
- `apollo_enrich_person`
- `enrichlayer_enrich`
- `pdl_enrich`
- `nia_trace_candidate`
- `agentmail_send_email`
- `agentmail_create_campaign`
- `attio_create_record`
- `attio_update_record`
- `graphiti_query`
- `mem0_search`

### Human-in-the-Loop Gates

Use `needsApproval` for:
- Sending any email (`agentmail_send_email`)
- Creating campaigns (`agentmail_create_campaign`)
- Spending enrichment credits above threshold
- Updating CRM records

Use dynamic approval:
```typescript
needsApproval: async ({ credits }) => credits > 5
```

### Token Optimization

1. **Cache the system prompt** -- it's large with 10+ tool definitions.
2. **Use context management** -- auto-clear old tool results as context grows.
3. **Return minimal data from tools** -- don't send full Apollo API responses; extract relevant fields.
4. **Use `strict: true`** on all tools -- eliminates retry round-trips from schema violations.
5. **Use parallel tool calls** -- reduces number of round-trips.

### Error Recovery Pattern

```typescript
// In tool execute functions:
execute: async (input) => {
  try {
    const result = await apolloApi.search(input);
    return { success: true, data: result };
  } catch (error) {
    if (error.status === 429) {
      return { success: false, error: "Apollo rate limit. Retry in 60s.", retryable: true };
    }
    return { success: false, error: `Apollo API error: ${error.message}`, retryable: false };
  }
}
```

Claude will naturally retry or find alternatives when given informative error messages.

### Recommended System Prompt Structure

```text
<role>
You are an AI recruiting assistant for OpenRecruiter. Your job is to help recruiters
find, evaluate, and reach out to candidates efficiently.
</role>

<tools_guidance>
<default_to_action>
Use your tools proactively. When the recruiter describes a role, immediately search
for candidates rather than asking clarifying questions -- unless critical information
is missing (e.g., no job title or location specified).
</default_to_action>

<use_parallel_tool_calls>
When enriching multiple candidates or performing independent searches, use parallel
tool calls for maximum efficiency.
</use_parallel_tool_calls>

<approval_required>
Always ask for approval before: sending emails, creating campaigns, or spending more
than 10 enrichment credits in a single batch.
</approval_required>
</tools_guidance>

<output_format>
After each major step, provide a brief progress update. Present candidate information
in a clear, scannable format. When scoring candidates, explain your reasoning.
</output_format>
```
