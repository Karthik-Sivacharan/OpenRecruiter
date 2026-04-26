# Coding Standards

## TypeScript
- Strict mode, no `any` (use `unknown` + type guards)
- Prefer `const` over `let`, never `var`
- Arrow functions for callbacks, named functions for top-level
- Early returns over nested conditionals
- Explicit return types on exported functions

## Validation
- Zod schemas for ALL external API responses (Apollo, EnrichLayer, PDL, Nia, AgentMail, GitHub)
- Validate at system boundaries, trust internal code
- Never trust API response shapes without parsing

## File Organization
- Files under 300 lines, functions under 50 lines
- One component per file, colocate types with their component
- Tool functions in `lib/tools/<service>.ts` (e.g., `lib/tools/apollo.ts`)
- Shared types in `lib/types/`

## Error Handling
- Try/catch at API boundaries only
- Let errors propagate internally
- User-facing errors: return structured error objects, never throw to UI
- Log API failures with service name + endpoint + status code

## Testing
- Vitest for unit tests, Playwright for E2E
- Test files colocated: `foo.ts` -> `foo.test.ts`
- Mock external APIs, never hit real endpoints in tests
- Test the happy path + one error case per function

## Commits
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- One logical change per commit
