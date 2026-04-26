# OpenRecruiter Design System

## 1. Visual Theme & Atmosphere

A warm, professional recruiting workspace. Feels like a smart assistant sitting next to you -- not a cold SaaS dashboard. Inspired by Intercom's warm chat surfaces, Claude's approachable AI aesthetic, and Linear's sharp status indicators.

Key characteristics:
- Warm neutrals (never pure black or pure white)
- Information-dense but not cluttered
- Chat-first: the conversation IS the interface
- Status indicators are glanceable and color-coded

## 2. Color Palette & Roles

Map directly to shadcn CSS variables:

### Surfaces
| Role | Light Mode | Dark Mode | CSS Variable |
|------|-----------|-----------|-------------|
| Page background | `hsl(40, 20%, 97%)` | `hsl(30, 10%, 10%)` | `--background` |
| Card/message surface | `hsl(40, 20%, 99%)` | `hsl(30, 10%, 13%)` | `--card` |
| Muted surface | `hsl(40, 15%, 94%)` | `hsl(30, 10%, 16%)` | `--muted` |

### Text
| Role | Light Mode | Dark Mode | CSS Variable |
|------|-----------|-----------|-------------|
| Primary text | `hsl(30, 10%, 12%)` | `hsl(40, 15%, 93%)` | `--foreground` |
| Secondary text | `hsl(30, 5%, 40%)` | `hsl(30, 5%, 60%)` | `--muted-foreground` |

### Brand
| Role | Light Mode | Dark Mode | CSS Variable |
|------|-----------|-----------|-------------|
| Primary (CTA, links) | `hsl(15, 55%, 52%)` | `hsl(15, 55%, 58%)` | `--primary` |
| Primary foreground | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | `--primary-foreground` |
| Accent (hover, active) | `hsl(15, 40%, 95%)` | `hsl(15, 40%, 18%)` | `--accent` |

### Borders
| Role | Light Mode | Dark Mode | CSS Variable |
|------|-----------|-----------|-------------|
| Default border | `hsl(30, 10%, 88%)` | `hsl(30, 10%, 20%)` | `--border` |
| Input border | `hsl(30, 10%, 82%)` | `hsl(30, 10%, 25%)` | `--input` |
| Focus ring | `hsl(15, 55%, 52%)` | `hsl(15, 55%, 58%)` | `--ring` |

### Semantic (Pipeline Status)
| Status | Color | Use |
|--------|-------|-----|
| Sourced | `hsl(220, 60%, 55%)` | Blue badge |
| Enriched | `hsl(260, 50%, 55%)` | Purple badge |
| Analyzed | `hsl(35, 80%, 50%)` | Amber badge |
| Scored | `hsl(160, 60%, 40%)` | Teal badge |
| Contacted | `hsl(15, 55%, 52%)` | Brand/terracotta badge |
| Replied | `hsl(145, 60%, 40%)` | Green badge |
| Screened | `hsl(200, 70%, 50%)` | Cyan badge |

## 3. Typography Rules

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|---------------|
| Display | System sans | 36px | 700 | 1.1 | -0.5px |
| Heading 1 | System sans | 24px | 600 | 1.2 | -0.3px |
| Heading 2 | System sans | 20px | 600 | 1.3 | -0.2px |
| Heading 3 | System sans | 16px | 600 | 1.4 | 0 |
| Body | System sans | 14px | 400 | 1.6 | 0 |
| Body small | System sans | 13px | 400 | 1.5 | 0 |
| Label | System sans | 12px | 500 | 1.4 | 0.2px |
| Mono (code, data) | System mono | 13px | 400 | 1.5 | 0 |

System sans = `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
System mono = `"SF Mono", "Fira Code", "Fira Mono", monospace`

Principles:
- Negative letter-spacing on headings (tighten as size increases)
- 14px body text for information density
- System fonts only (product register -- speed over brand)

## 4. Component Stylings

### Chat Messages
- **User message:** Right-aligned, `--muted` background, `border-radius: 16px 16px 4px 16px`
- **Assistant message:** Left-aligned, `--card` background, `border-radius: 16px 16px 16px 4px`
- **Tool call:** Collapsible, muted surface, wrench icon + status badge
- **Approval request:** Bordered card with Accept/Reject buttons, slight amber tint

### Buttons
- **Primary:** `--primary` bg, white text, `radius: 8px`, `padding: 8px 16px`
- **Secondary:** `--muted` bg, `--foreground` text, `radius: 8px`
- **Ghost:** transparent bg, `--muted-foreground` text, hover: `--accent` bg
- **Destructive:** `hsl(0, 60%, 50%)` bg, white text

### Cards (Candidate Cards)
- Background: `--card`
- Border: `1px solid var(--border)`
- Radius: `12px`
- Shadow: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)`
- Hover shadow: `0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)`

### Status Badges
- Radius: `9999px` (pill)
- Padding: `2px 10px`
- Font: Label size (12px, weight 500)
- Background: status color at 10% opacity
- Text: status color at full

### Inputs
- Background: `--background`
- Border: `1px solid var(--input)`
- Radius: `8px`
- Focus: `ring-2 ring-offset-2` using `--ring`

## 5. Layout Principles

### Spacing Scale (8px base)
`4 | 8 | 12 | 16 | 20 | 24 | 32 | 48 | 64 | 80`

### Grid
- Max content width: `768px` (chat column)
- Side padding: `16px` mobile, `24px` desktop
- Message gap: `16px` between messages
- Section gap: `32px` between major sections

### Whitespace
- Generous vertical spacing between messages
- Tight horizontal spacing within message content
- Tool calls and plan items are visually grouped with reduced gap (8px)

## 6. Depth & Elevation

| Level | Shadow | Use |
|-------|--------|-----|
| 0 (flat) | none | Inline elements, badges |
| 1 (subtle) | `0 1px 3px rgba(0,0,0,0.04)` | Cards at rest, messages |
| 2 (lifted) | `0 4px 12px rgba(0,0,0,0.06)` | Cards on hover, dropdowns |
| 3 (floating) | `0 8px 24px rgba(0,0,0,0.08)` | Modals, popovers |
| Ring | `0 0 0 2px var(--ring)` | Focus states |

## 7. Do's and Don'ts

DO:
- Use warm tinted neutrals for all grays
- Use pill badges for candidate pipeline status
- Show tool calls as collapsible sections (not inline text)
- Use skeleton loading for streaming responses
- Keep the chat column narrow (768px max) for readability

DON'T:
- Use pure `#000000` or `#ffffff` anywhere
- Use gradient text, glassmorphism, or side-stripe borders
- Use bounce or elastic easing on any animation
- Animate layout properties (width, height, padding) -- only transform/opacity
- Use nested cards (card inside card)
- Use identical card grids -- vary candidate card content

## 8. Responsive Behavior

| Breakpoint | Width | Changes |
|-----------|-------|---------|
| Mobile | < 640px | Full-width chat, bottom input, collapsed tool calls |
| Tablet | 640-1024px | Centered chat column, side padding 24px |
| Desktop | > 1024px | Centered 768px chat column, optional sidebar for pipeline |

Touch targets: minimum 44x44px on mobile.

## 9. Agent Prompt Guide

When building UI components, use these patterns:

**Chat message:** "Create a message bubble on `var(--card)` with `border-radius: 16px 16px 16px 4px`, `1px solid var(--border)`, body text at 14px. User messages flip the radius to `16px 16px 4px 16px` and use `var(--muted)` background."

**Candidate card:** "Create a card on `var(--card)` with `12px` radius, subtle shadow, showing: name (heading 3), title + company (body small, muted), pipeline status as a pill badge using the semantic color at 10% opacity, score as a bold number."

**Approval dialog:** "Create a bordered card with slight amber tint background, showing the action to approve (e.g., 'Send 8 outreach emails - 0 credits'), with Accept (primary) and Reject (ghost) buttons."

## 10. Motion & Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Button hover | background-color | 150ms | ease-out |
| Card hover | box-shadow | 200ms | ease-out |
| Message appear | opacity + translateY(8px) | 250ms | ease-out |
| Tool call expand | height (auto via grid) | 200ms | ease-out |
| Status badge change | background-color | 300ms | ease-in-out |
| Skeleton shimmer | background-position | 1500ms | linear (infinite) |
| Typing indicator | opacity pulse | 1000ms | ease-in-out (infinite) |

Principles:
- 150-250ms for micro-interactions
- 200-300ms for layout changes
- ease-out for enters, ease-in for exits
- NEVER use bounce, spring, or elastic easing
- Respect `prefers-reduced-motion`: disable all non-essential animation
