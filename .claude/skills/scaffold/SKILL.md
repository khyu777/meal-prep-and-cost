---
name: scaffold
description: >
  Generates the full stack-agnostic folder structure for a new app project.
  Use this at the start of every new project before writing any code.
  Invoke with /scaffold followed by a brief app description. Runs a context
  interview first, gets approval on the proposed structure, then sets up all
  directories and a README, and signals backend-builder to begin.
argument-hint: "[brief app description]"
allowed-tools: [Write, Bash, Skill, AskUserQuestion]
user-invocable: true
---

# Scaffold Skill

When invoked with `/scaffold [app description]`:

### Step 0 — Read context
Read CLAUDE.md in full before creating any files. Apply all conventions
defined there to everything this skill creates.

If no argument is provided, ask: "What is this app for?" before proceeding.
If this skill is being invoked inside an existing project (any files already
present), ask: "This directory isn't empty. Scaffold anyway?" before proceeding.

### Step 1 — Interview for full context
Do not scaffold from the one-line description alone. Invoke the `deep-interview`
skill to gather the context scaffolding actually needs.

- Begin with a **focused, light pass** covering: target stack/framework,
  required layers (does the app need both frontend and backend?), the core
  data model, external integrations, and scope boundaries (what's explicitly
  out for v1).
- **Escalate** to the full deep-interview phases only when the app is complex
  or answers are vague. When you escalate, **announce it and say why** — the
  user can decline and tell you to proceed with what you have.
- Carry the resulting Interview Debrief forward into Step 2.

### Step 2 — Propose structure & get approval
Present a single approval artifact and **write nothing until the user approves.**
It has two parts, in this order:

1. **Interview Debrief** — the debrief produced by `deep-interview`.
2. **Proposed Structure** — the concrete folder tree you will create plus the
   chosen tech stack, target directory, and any deviations from the default
   structure justified by the interview.

Then ask: "Approve this structure? I'll scaffold once you confirm."
This is a hard stop. Do not proceed to Step 3 without explicit approval.
If the directory isn't empty, surface that here as part of the gate.

### Step 3 — Generate folder structure
Create all directories defined in CLAUDE.md:
```
frontend/components/
frontend/pages/
frontend/hooks/
frontend/styles/
frontend/utils/
backend/routes/
backend/controllers/
backend/models/
backend/middleware/
backend/utils/
tests/frontend/
tests/backend/
docs/
```
Create empty `.gitkeep` files in each leaf directory so the structure
is committed to git even before code is written.

### Step 4 — Create root files

**`.gitignore`** — include at minimum:
```
.env
node_modules/
__pycache__/
*.pyc
.DS_Store
dist/
build/
```

**`.env.example`** — placeholder for env vars, to be updated by backend-builder:
```
# Environment variables — copy to .env and fill in real values
# DATABASE_URL=
# JWT_SECRET=
# PORT=
```

**`README.md`** — include:
- App name and description (from the argument)
- Folder structure overview
- Placeholder sections: Setup, Environment Variables, Running Tests

### Step 5 — Output summary
List every directory and file created.

### Step 6 — Signal handoff
Output: "Scaffold complete. Invoke backend-builder to begin."

## Rules

- Always read CLAUDE.md before creating any file (Step 0 is mandatory)
- Never scaffold from the one-line description alone — the Step 1 interview and
  the Step 2 approval gate are mandatory; write no files until the user approves
- Never create files outside the defined structure during scaffolding
- Never scaffold inside an existing project without asking first
