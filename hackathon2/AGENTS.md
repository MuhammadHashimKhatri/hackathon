<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

Project skills live in `.claude/skills/` (installed with `npx skills`, pinned in `skills-lock.json`). Where a skill and this file disagree, this file wins.

### spec-driven-development
- Use for every feature prompt in docs/PROMPTS.md.
- docs/HCM_SPEC.md is the approved product spec — do NOT rewrite it.
- Per module, run the skill's phases scoped to that module only:
  1. Spec: write `docs/specs/<NN>-<module>.md` (NN = two-digit prompt number, e.g. `06-attendance.md`) — requirements + acceptance criteria taken from HCM_SPEC.md.
  2. Plan.
  3. Task list.
  4. Implement only after the user approves.
- If HCM_SPEC.md is ambiguous, ask instead of inventing.
- Overrides to the skill's defaults:
  - Skip Phase 0 (capability map): docs/PROMPTS.md already fixes the modules and build order.
  - Plan and task list go in the same `docs/specs/<NN>-<module>.md` file (sections `## Plan`, `## Tasks`) — no root `SPEC-*.md`, no `tasks/plan.md` / `tasks/todo.md`.
  - Don't repeat Tech Stack / Commands / Project Structure / Code Style per module; link HCM_SPEC.md §2–§3 and this file.
  - The skill references `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `context-engineering` and `api-and-interface-design`. They are not installed; use the inline guidance in SKILL.md and don't install them.

### frontend-design
- Use for every page/component (Prompt 1 and the UI part of Prompts 3–12).
- One consistent design system across the app: tokens in `src/app/globals.css`, components in `src/components/ui`.
- Required: responsive from 375px, dark mode, and loading / empty / error states on every page.
- Run the skill's design-plan pass (palette, type, layout, principles) once in Prompt 1. Later prompts reuse that system and must not invent a new look per page.
