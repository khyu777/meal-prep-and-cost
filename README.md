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
# Run both together (recommended)
npm run dev

# Or separately:
# Backend (port 3001)
cd backend && npm run dev
# Frontend (port 5173)
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

## Claude Code tooling (`.claude/`)

| Agent / Command | Role |
|---|---|
| `/meal-planner` | Generate a weekly meal plan and grocery list |
| `meal-brainstormer` | Suggests meal ideas given user preferences |
| `meal-analyzer` | Breaks a plan into a grocery list with prices and nutrition |
| `test-runner` | Runs and iterates on tests until passing |
| `debugger` | Traces root cause of bugs |

---

## License

MIT
