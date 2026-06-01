# Project Overview

This is a stack-agnostic app scaffold. Claude Code is the primary builder.
When starting a new project, generate the full folder structure first, then
proceed to backend and frontend in that order. Never skip the scaffold step.

# Folder Structure (enforce this always)

```
project-root/
├── frontend/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level views
│   ├── hooks/            # Custom logic hooks
│   ├── styles/           # Global and component styles
│   └── utils/            # Frontend helpers
├── backend/
│   ├── routes/           # API endpoint definitions
│   ├── controllers/      # Business logic handlers
│   ├── models/           # Data models / schemas
│   ├── middleware/        # Auth, logging, validation
│   └── utils/            # Backend helpers
├── tests/
│   ├── frontend/         # Component and page tests
│   └── backend/          # Route and controller tests
├── docs/                 # Architecture decisions, API docs
├── .env.example          # Documented env vars (no real values)
├── .gitignore            # Must include .env
└── CLAUDE.md
```

# Tech Stack

Stack-agnostic. Claude should not assume a framework unless explicitly told.
When a stack is chosen, update this section before writing any code.

# Conventions & Standards

- File names: kebab-case for all files (`user-profile.js`, not `UserProfile.js`)
- Component names: PascalCase inside the file (`export default function UserProfile`)
- API routes: REST conventions (`GET /users`, `POST /users`, `DELETE /users/:id`)
- One responsibility per file — if a file exceeds ~150 lines, suggest splitting
- All new files need a one-line comment at the top describing what the file does

# Coding Rules

- Never write code without first confirming the folder structure exists
- Prefer explicit over clever — readable code beats compact code
- No hardcoded secrets, URLs, or environment values — use env vars and note them
- When adding a new route, always add a corresponding stub in `tests/backend/`
- When adding a new component, always add a corresponding stub in `tests/frontend/`

# Testing Requirements

- Every route must have a test stub in `tests/backend/` before the session ends
- Every component must have a test stub in `tests/frontend/` before the session ends
- Test stubs are placeholders — test-runner agent is responsible for making them pass
- Do not ship code without at least stub-level test coverage

# What NOT to Do

- Do not install packages without listing them and asking for approval first
- Do not modify CLAUDE.md unless explicitly asked
- Do not skip the Reviewer Agent step — always invoke reviewer after writing
- Do not flatten the folder structure to save time
- Do not write frontend and backend in the same file or directory
- Do not run frontend-builder before backend-builder has completed and been reviewed
- Do not let frontend-builder call any endpoint not listed in the API Contract Summary

# Session Start

At the start of every session, read this file (CLAUDE.md) in full.
If TODO.md or docs/architecture.md exist, read those too.
Then print a one-line project status before proceeding.

## Build Sequence (follow this order exactly)

1. `/scaffold [app description]` — runs a context interview (via the
   `deep-interview` skill), presents an Interview Debrief plus the proposed
   folder structure and tech stack, and waits for explicit approval before
   generating anything. Never scaffold from the one-line description alone.
2. Invoke `backend-builder` — build API layer, produce API Contract Summary
3. Invoke `reviewer` — review backend output; loop until approved
4. Invoke `frontend-builder` — build UI layer using API Contract Summary
5. Invoke `reviewer` — review frontend output; loop until approved
6. Invoke `test-runner` — run tests, iterate until passing or blocker surfaced
7. Invoke `security-auditor` — scan for vulnerabilities
8. Invoke `performance-agent` — identify bottlenecks
9. Invoke `docs-writer` — synthesize all agent outputs into `docs/architecture.md`

Do not skip steps. Do not reorder steps. If a step produces a blocker,
stop and ask the human before proceeding.

# Self-Improvement Protocol

All agents and skills are expected to notice and flag improvement opportunities
as they work. This system improves over time through use — but no agent may
edit any config file directly. All improvements require human approval first.

## When to Flag an Improvement

Flag an improvement when you notice any of the following:

- A convention in CLAUDE.md that caused confusion or required interpretation
- A checklist item in the Reviewer Agent that was too vague to apply consistently
- A step in a skill that was missing, redundant, or in the wrong order
- A rule that conflicted with another rule
- A pattern that repeated across two builds and should be standardized
- A folder, file type, or layer that CLAUDE.md doesn't account for but should

Do not flag improvements for minor phrasing preferences or stylistic opinions.
Flag only things that would have changed the outcome of this build.

## How to Propose an Improvement

At the end of your output (after your summary or review), append an
**Improvement Proposals** block using this format:

### Proposal 1
**File:** `.claude/agents/reviewer.md`
**Section:** Review Checklist > Logic
**Current:** "Is any business logic leaking into the wrong layer?"
**Proposed:** "Is any business logic written inside a route file or component
  instead of a controller or hook?"
**Why:** The current wording was too abstract to apply during this review.
  The proposed version is checkable without interpretation.

### Proposal 2
**File:** `CLAUDE.md`
**Section:** Conventions & Standards
**Current:** (nothing — this is a new rule)
**Proposed:** "API responses must always return a consistent shape:
  `{ data, error, status }`"
**Why:** backend-builder made an inconsistent decision here that
  frontend-builder had to work around.

One block per proposal. Multiple proposals are allowed.
After listing proposals, always ask: "Approve any of these? I'll apply the
ones you confirm."

## What Agents May NOT Propose

- Changes to the Self-Improvement Protocol itself
- Removal of the approval requirement
- Expanding their own tool permissions
- Changes to another agent's core responsibility or scope
