# OpenRecruiter Design System

Dark-mode-native, inspired by Linear. A near-black canvas where content emerges from darkness with extreme precision. The recruiting pipeline should feel like a command center — engineered, not decorated.

## 1. Visual Theme & Atmosphere

A near-black canvas (`#08090a`) where content emerges from darkness like starlight. Every element exists in a carefully calibrated hierarchy of luminance, from barely-visible borders (`rgba(255,255,255,0.05)`) to soft, luminous text (`#f7f8f8`). This is darkness as the native medium — information density is managed through subtle gradations of white opacity rather than color variation.

The typography system is built on Inter Variable with OpenType features `"cv01"` and `"ss03"` enabled globally. Inter is used at weights from 300 (light) through 510 (signature emphasis) to 590 (semibold). The 510 weight is distinctive — between regular and medium, creating subtle emphasis that doesn't shout. At display sizes, aggressive negative letter-spacing creates compressed, authoritative headlines. Berkeley Mono serves as the monospace companion for code and technical labels.

The color system is almost entirely achromatic — dark backgrounds with white/gray text — punctuated by a brand accent: indigo-violet (`#5e6ad2` for backgrounds, `#7170ff` for interactive accents). Borders use ultra-thin semi-transparent white (`rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`) that create structure without noise.

**Key Characteristics:**
- Dark-mode-native: `#08090a` base, `#0f1011` panels, `#191a1b` elevated surfaces
- Inter Variable with `"cv01", "ss03"` globally — geometric alternates for a cleaner aesthetic
- Signature weight 510 (between regular and medium) for most UI text
- Aggressive negative letter-spacing at display sizes (-1.584px at 72px, -1.056px at 48px)
- Brand indigo-violet: `#5e6ad2` (bg) / `#7170ff` (accent) / `#828fff` (hover) — the only chromatic color
- Semi-transparent white borders throughout: `rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`
- Button backgrounds at near-zero opacity: `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.05)`
- Multi-layered shadows with inset variants for depth on dark surfaces

## 2. Color Palette & Roles

### Background Surfaces
| Role | Value | CSS Variable | Use |
|------|-------|-------------|-----|
| Marketing Black | `#010102` / `#08090a` | `--background` | Deepest canvas, page background |
| Panel Dark | `#0f1011` | `--card` | Sidebar, panel backgrounds, message bubbles |
| Level 3 Surface | `#191a1b` | `--muted` | Elevated surfaces, dropdowns, tool call cards |
| Secondary Surface | `#28282c` | `--accent` | Hover states, slightly elevated components |

### Text & Content
| Role | Value | CSS Variable | Use |
|------|-------|-------------|-----|
| Primary Text | `#f7f8f8` | `--foreground` | Headlines, primary content (not pure white) |
| Secondary Text | `#d0d6e0` | `--muted-foreground` | Body text, descriptions |
| Tertiary Text | `#8a8f98` | -- | Placeholders, metadata, de-emphasized content |
| Quaternary Text | `#62666d` | -- | Timestamps, disabled states, subtle labels |

### Brand & Accent
| Role | Value | CSS Variable | Use |
|------|-------|-------------|-----|
| Brand Indigo | `#5e6ad2` | `--primary` | CTA buttons, brand marks, key interactive surfaces |
| Accent Violet | `#7170ff` | -- | Links, active states, selected items |
| Accent Hover | `#828fff` | -- | Hover states on accent elements |
| Primary Foreground | `#ffffff` | `--primary-foreground` | Text on brand indigo backgrounds |

### Pipeline Status Colors
| Status | Color | Use |
|--------|-------|-----|
| Sourced | `#5e6ad2` | Indigo badge — initial pipeline stage |
| Enriched | `#7170ff` | Violet badge — data enriched |
| Analyzed | `#c084fc` | Purple badge — GitHub/portfolio analyzed |
| Scored | `#f59e0b` | Amber badge — candidate scored |
| Draft Ready | `#8a8f98` | Gray badge — email drafted |
| Contacted | `#3b82f6` | Blue badge — outreach sent |
| Replied | `#10b981` | Green badge — candidate responded |
| Screened | `#06b6d4` | Cyan badge — phone screen complete |
| Intro'd | `#27a644` | Success green — handed to hiring manager |

### Borders & Dividers
| Role | Value | CSS Variable |
|------|-------|-------------|
| Border Subtle | `rgba(255,255,255,0.05)` | `--border` |
| Border Standard | `rgba(255,255,255,0.08)` | `--input` |
| Border Solid | `#23252a` | -- |
| Focus Ring | `#5e6ad2` | `--ring` |

### Overlay
- Modal backdrop: `rgba(0,0,0,0.85)`

## 3. Typography Rules

### Font Family
- **Primary**: `Inter Variable`, fallbacks: `SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, sans-serif`
- **Monospace**: `Berkeley Mono`, fallbacks: `ui-monospace, SF Mono, Menlo, monospace`
- **OpenType Features**: `"cv01", "ss03"` enabled globally

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|--------|-------------|----------------|-----|
| Display XL | 72px | 510 | 1.00 | -1.584px | Hero headlines |
| Display Large | 64px | 510 | 1.00 | -1.408px | Secondary hero |
| Display | 48px | 510 | 1.00 | -1.056px | Section headlines |
| Heading 1 | 32px | 400 | 1.13 | -0.704px | Major section titles |
| Heading 2 | 24px | 400 | 1.33 | -0.288px | Sub-section headings |
| Heading 3 | 20px | 590 | 1.33 | -0.24px | Feature titles, card headers |
| Body Large | 18px | 400 | 1.60 | -0.165px | Intro text, feature descriptions |
| Body | 16px | 400 | 1.50 | normal | Standard reading text |
| Body Medium | 16px | 510 | 1.50 | normal | Navigation, labels |
| Small | 15px | 400 | 1.60 | -0.165px | Secondary body text |
| Small Medium | 15px | 510 | 1.60 | -0.165px | Emphasized small text |
| Caption | 13px | 400-510 | 1.50 | -0.13px | Metadata, timestamps |
| Label | 12px | 400-590 | 1.40 | normal | Button text, small labels |
| Micro | 11px | 510 | 1.40 | normal | Tiny labels |
| Mono Body | 14px (Berkeley Mono) | 400 | 1.50 | normal | Code blocks, API data |
| Mono Caption | 13px (Berkeley Mono) | 400 | 1.50 | normal | Code labels |

### Principles
- **510 is the signature weight**: Between regular 400 and medium 500 — subtle emphasis without heaviness
- **Compression at scale**: -1.584px at 72px, -1.056px at 48px, -0.704px at 32px. Below 16px, spacing normalizes
- **OpenType as identity**: `"cv01", "ss03"` are non-negotiable — they transform Inter into our distinctive typeface
- **Three-tier weight system**: 400 (reading), 510 (emphasis/UI), 590 (strong emphasis)

## 4. Component Stylings

### Chat Messages
- **User message:** Right-aligned, `rgba(255,255,255,0.04)` background, `1px solid rgba(255,255,255,0.08)` border, `border-radius: 12px 12px 4px 12px`
- **Assistant message:** Left-aligned, `#0f1011` background, `1px solid rgba(255,255,255,0.05)` border, `border-radius: 12px 12px 12px 4px`
- **Tool call:** Collapsible, `#191a1b` background, wrench icon + status badge, `8px` radius
- **Approval request:** `#191a1b` background, `1px solid rgba(255,255,255,0.08)` border, brand indigo Accept button + ghost Reject

### Buttons

**Primary Brand**
- Background: `#5e6ad2`
- Text: `#ffffff`
- Padding: 8px 16px
- Radius: 6px
- Hover: `#828fff`
- Use: Primary CTAs ("Send outreach", "Approve all")

**Ghost (Default)**
- Background: `rgba(255,255,255,0.02)`
- Text: `#e2e4e7`
- Radius: 6px
- Border: `1px solid rgb(36, 40, 44)`
- Use: Secondary actions

**Subtle**
- Background: `rgba(255,255,255,0.04)`
- Text: `#d0d6e0`
- Radius: 6px
- Use: Toolbar actions, contextual buttons

**Pill**
- Background: transparent
- Text: `#d0d6e0`
- Radius: 9999px
- Border: `1px solid #23252a`
- Use: Filter chips, quick-reply suggestions

### Cards (Candidate Cards)
- Background: `rgba(255,255,255,0.02)` (never solid — always translucent)
- Border: `1px solid rgba(255,255,255,0.08)`
- Radius: 8px (standard), 12px (featured)
- Shadow: `rgba(0,0,0,0.2) 0px 0px 0px 1px`
- Hover: subtle background opacity increase to `rgba(255,255,255,0.04)`

### Inputs & Forms
- Background: `rgba(255,255,255,0.02)`
- Text: `#d0d6e0`
- Border: `1px solid rgba(255,255,255,0.08)`
- Padding: 12px 14px
- Radius: 6px
- Focus: multi-layer shadow stack with brand indigo ring

### Status Badges
- Radius: 9999px (pill)
- Padding: 2px 10px
- Font: 12px weight 510
- Background: status color at 15% opacity
- Text: status color at full brightness
- Border: `1px solid` status color at 20% opacity

## 5. Layout Principles

### Spacing Scale (8px base)
`4 | 8 | 12 | 16 | 20 | 24 | 32 | 48 | 64 | 80`

### Grid & Container
- Max chat column width: `768px` (centered)
- Side padding: `16px` mobile, `24px` desktop
- Message gap: `16px` between messages
- Section gap: `48px` between major sections
- Full-width dark sections with internal max-width constraints

### Whitespace Philosophy
- **Darkness as space**: The near-black background IS the whitespace. Content emerges from it.
- **Compressed headlines, expanded surroundings**: Dense typography within generous dark padding creates tension.
- **Section isolation**: Generous vertical padding (80px+) with no visible dividers — darkness provides natural separation.

### Border Radius Scale
- Micro (2px): Inline badges, toolbar buttons
- Standard (4px): Small containers, list items
- Comfortable (6px): Buttons, inputs, functional elements
- Card (8px): Cards, dropdowns, popovers
- Panel (12px): Panels, featured cards, sections
- Full Pill (9999px): Chips, filter pills, status tags
- Circle (50%): Icon buttons, avatars, status dots

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (L0) | No shadow, `#010102` bg | Page background |
| Subtle (L1) | `rgba(0,0,0,0.03) 0px 1.2px 0px` | Toolbar buttons |
| Surface (L2) | `rgba(255,255,255,0.05)` bg + border | Cards, inputs, containers |
| Inset (L2b) | `rgba(0,0,0,0.2) 0px 0px 12px 0px inset` | Recessed panels |
| Ring (L3) | `rgba(0,0,0,0.2) 0px 0px 0px 1px` | Border-as-shadow |
| Elevated (L4) | `rgba(0,0,0,0.4) 0px 2px 4px` | Floating elements, dropdowns |
| Dialog (L5) | Multi-layer stack | Modals, command palette |
| Focus | Brand indigo ring + shadow stack | Keyboard focus |

**Elevation via luminance**: Each level increases white opacity of the surface background (`0.02` -> `0.04` -> `0.05`). On dark surfaces, shadows are nearly invisible — use background luminance stepping instead.

## 7. Do's and Don'ts

### Do
- Use Inter Variable with `"cv01", "ss03"` on ALL text — non-negotiable
- Use weight 510 as default emphasis weight
- Apply aggressive negative letter-spacing at display sizes
- Build on near-black: `#08090a` base, `#0f1011` panels, `#191a1b` elevated
- Use semi-transparent white borders (`rgba(255,255,255,0.05)` to `0.08`)
- Keep button backgrounds nearly transparent: `rgba(255,255,255,0.02)` to `0.05`
- Reserve brand indigo for CTAs and interactive accents only
- Use `#f7f8f8` for primary text — not pure `#ffffff`
- Apply luminance stacking: deeper = darker bg, elevated = lighter bg
- Show tool calls as collapsible sections with status badges
- Use pill badges for pipeline status with semantic colors

### Don't
- Don't use pure white (`#ffffff`) as primary text
- Don't use solid colored backgrounds for buttons — transparency is the system
- Don't apply brand indigo decoratively — reserved for interactive elements
- Don't use positive letter-spacing on display text
- Don't use visible/opaque borders on dark backgrounds
- Don't skip OpenType features (`"cv01", "ss03"`)
- Don't use weight 700 (bold) — max is 590, workhorse is 510
- Don't introduce warm colors into UI chrome — cool gray with blue-violet only
- Don't use drop shadows for elevation — use luminance stepping
- Don't use bounce, spring, or elastic easing
- Don't animate layout properties (width, height) — only transform/opacity
- Don't use gradient text, glassmorphism, or side-stripe borders

## 8. Responsive Behavior

| Breakpoint | Width | Changes |
|-----------|-------|---------|
| Mobile | < 640px | Full-width chat, bottom input, compact padding, 48px display text |
| Tablet | 640-1024px | Centered chat column, 2-column feature grids |
| Desktop | > 1024px | Centered 768px chat, optional sidebar for pipeline view |

- Touch targets: minimum 44x44px on mobile
- Hero text: 72px -> 48px -> 32px, tracking adjusts proportionally
- Navigation: links + CTAs -> hamburger at 768px
- Section spacing: 80px+ -> 48px on mobile

## 9. Agent Prompt Guide

### Quick Color Reference
- Page Background: `#08090a` (--background)
- Panel/Card: `#0f1011` (--card)
- Elevated Surface: `#191a1b` (--muted)
- Primary Text: `#f7f8f8` (--foreground)
- Body Text: `#d0d6e0` (--muted-foreground)
- Muted Text: `#8a8f98`
- Subtle Text: `#62666d`
- Brand CTA: `#5e6ad2` (--primary)
- Accent: `#7170ff`
- Accent Hover: `#828fff`
- Border: `rgba(255,255,255,0.08)` (--input)
- Subtle Border: `rgba(255,255,255,0.05)` (--border)

### Example Component Prompts
- "Create a chat message on `#0f1011` with `border-radius: 12px 12px 12px 4px`, `1px solid rgba(255,255,255,0.05)`. Body at 15px Inter Variable weight 400, `#d0d6e0`, font-feature-settings `'cv01', 'ss03'`."
- "Create a candidate card: `rgba(255,255,255,0.02)` bg, `1px solid rgba(255,255,255,0.08)` border, 8px radius. Name at 20px weight 590, `#f7f8f8`. Title at 13px weight 510, `#8a8f98`. Pipeline badge: pill with status color at 15% opacity bg."
- "Build a tool call display: `#191a1b` bg, 8px radius, collapsible. Header: wrench icon + 13px weight 510 tool name in `#d0d6e0` + status badge (Pending: amber, Complete: green, Error: red). Body: 13px Berkeley Mono, `#8a8f98`."
- "Create approval card: `#191a1b` bg, `1px solid rgba(255,255,255,0.08)`, 8px radius. Action text at 15px weight 400, `#d0d6e0`. Accept button: `#5e6ad2` bg, white text, 6px radius. Reject: ghost button."

## 10. Motion & Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Button hover | background-color, box-shadow | 150ms | ease-out |
| Card hover | background opacity increase | 200ms | ease-out |
| Message appear | opacity + translateY(8px) | 250ms | ease-out |
| Tool call expand | height (grid-template-rows) | 200ms | ease-out |
| Status badge change | background-color, color | 300ms | ease-in-out |
| Skeleton shimmer | background-position | 1500ms | linear (infinite) |
| Typing indicator | opacity pulse | 1000ms | ease-in-out (infinite) |
| Focus ring appear | box-shadow | 150ms | ease-out |
| Dropdown open | opacity + translateY(-4px) | 200ms | ease-out |
| Modal backdrop | opacity | 200ms | ease-out |

### Principles
- 150-250ms for micro-interactions
- 200-300ms for layout changes
- ease-out for enters, ease-in for exits
- NEVER use bounce, spring, or elastic easing
- Respect `prefers-reduced-motion`: disable all non-essential animation
- On dark surfaces, animate opacity and transform only — luminance shifts handle the rest
