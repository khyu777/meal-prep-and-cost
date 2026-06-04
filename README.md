# Meal Prep & Cost Planner

Plan weekly meals and calculate per-meal and per-serving costs from a set of ingredients.

**Stack:** React + TypeScript (frontend) · Node/Express + TypeScript (backend) · Prisma + SQLite

---

## Setup

```bash
# Install all workspace dependencies
npm install
cd frontend && npm install && cd ..

# Copy env template and fill in values
cp .env.example .env

# Run Prisma migrations and generate client
cd backend && npx prisma generate && npx prisma migrate dev && cd ..
```

---

## Running the app

```bash
# Backend (port 3001 by default)
cd backend && npm run dev

# Frontend (port 5173 by default)
cd frontend && npm run dev
```

---

## Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## Build

```bash
cd backend && npm run build
cd frontend && npm run build
```

---

## Build tooling (`.claude/`)

This repo includes a Claude Code build pipeline used during development:

| Agent | Role |
|---|---|
| `backend-builder` | Writes routes, controllers, models, middleware |
| `frontend-builder` | Writes components, pages, hooks |
| `reviewer` | Reviews each builder's output |
| `test-runner` | Runs and fixes tests |
| `security-auditor` | Scans for vulnerabilities |
| `performance-agent` | Identifies bottlenecks |
| `docs-writer` | Writes `docs/architecture.md` |
| `debugger` | Traces root cause of bugs |

Invoke via `/scaffold`, `/meal-planner`, or the agent names directly inside Claude Code.

---

## License

MIT
