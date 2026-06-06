# Project Overview

Meal Prep & Cost Planner — React + TypeScript frontend, Node/Express + TypeScript backend, Prisma + SQLite. Users create meals with ingredients, assign them to weekly plans, and track per-serving and total costs.

# Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, React Router v6
- **Backend:** Node.js + Express + TypeScript
- **Database:** Prisma ORM + SQLite
- **Testing:** Vitest + Testing Library (frontend), Jest + Supertest (backend)

# Folder Structure

```
frontend/
  components/   # Reusable UI components
  pages/        # Route-level views
  hooks/        # Custom logic hooks
  styles/       # Global CSS
  utils/        # Frontend helpers
backend/
  routes/       # Express route definitions
  controllers/  # Business logic
  models/       # Prisma schemas and queries
  middleware/   # Error handling, logging, validation
  utils/        # Backend helpers
tests/
  frontend/     # Component and page tests
  backend/      # Route and controller tests
docs/           # Architecture docs
```

# Conventions

- File names: kebab-case (`meal-card.tsx`, not `MealCard.tsx`)
- Component names: PascalCase inside the file
- API routes: REST conventions (`GET /meals`, `POST /meals`, `DELETE /meals/:id`)
- One responsibility per file — suggest splitting at ~150 lines
- One-line comment at the top of every new file

# Environment Variables

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | backend `.env` | SQLite path, e.g. `file:./dev.db` |
| `PORT` | backend `.env` | Express port (default `3002`) |
| `ALLOWED_ORIGIN` | backend `.env` | CORS origin, e.g. `http://localhost:5173` |
| `VITE_API_TARGET` | frontend env | Proxy target for `/api` (default `http://localhost:3002`) |

# API Response Shape

All backend routes return `{ data, error }`. `data` holds the payload on success; `error` is a string on failure. Never return a naked array or object at the top level.

# Coding Rules

- No hardcoded secrets, URLs, or env values — use env vars
- When adding a route, add a test stub in `tests/backend/`
- When adding a component, add a test stub in `tests/frontend/`
- Do not install packages without listing them and asking first
- Do not modify CLAUDE.md unless explicitly asked

# Testing

- Every route and component needs at least a stub test before the session ends
- `test-runner` agent is responsible for making stubs pass

# Session Start

Read this file. If `docs/architecture.md` exists, read that too. Print a one-line status before proceeding.

# Active Agents & Commands

| Name | Type | Role |
|---|---|---|
| `meal-brainstormer` | agent | Suggests meal ideas given user preferences |
| `meal-analyzer` | agent | Breaks a confirmed plan into a grocery list, costs, and nutrition |
| `test-runner` | agent | Runs and iterates on tests until passing |
| `debugger` | agent | Traces root cause of bugs |
| `/meal-planner` | command | End-to-end meal planning flow |
| `/meal-uploader` | command | Upload a tracker-upload JSON file to the running backend |
| `/init` | command | Session kickoff |
