---
name: scaffold
description: >
  Generates the full stack-agnostic folder structure for a new app project.
  Use this at the start of every new project before writing any code.
  Invoke with /scaffold followed by a brief app description. Automatically
  sets up all directories, a README, and signals backend-builder to begin.
argument-hint: "[brief app description]"
allowed-tools: [Write, Bash]
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

### Step 1 — Confirm target directory
State the directory where the scaffold will be created and ask for confirmation
before writing anything.

### Step 2 — Generate folder structure
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

### Step 3 — Create root files

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

### Step 4 — Output summary
List every directory and file created.

### Step 5 — Signal handoff
Output: "Scaffold complete. Invoke backend-builder to begin."

## Rules

- Always read CLAUDE.md before creating any file (Step 0 is mandatory)
- Never create files outside the defined structure during scaffolding
- Never scaffold inside an existing project without asking first
