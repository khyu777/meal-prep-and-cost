# Meal Prep & Cost Planner — User Instructions

Plan your weekly meals, track ingredient costs, and see exactly how much each meal and plan costs you.

---

## Setup

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example backend/.env
```

The defaults in `.env.example` work for local development. Only change them if you need a different port or database location:

| Variable | Default | What it controls |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Path to the SQLite database file |
| `PORT` | `3001` | Port the backend server listens on |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | Origin the API accepts requests from |

### 3. Initialize the database

```bash
cd backend && npx prisma migrate dev
```

This creates the SQLite database and runs all migrations. You only need to do this once (or after pulling new migrations).

---

## Running the App

From the project root:

```bash
npm run dev
```

This starts both the backend and frontend together. Then open **http://localhost:5173** in your browser.

---

## How to Use

The app has three tabs: **Ingredients**, **Meals**, and **Plans**. Work through them in that order when starting fresh.

---

### Ingredients

Ingredients are the building blocks for meals. Each ingredient records what you bought: name, quantity purchased, total receipt price, and grams per purchased quantity. The app tracks remaining inventory in grams.

**Add an ingredient**
1. Fill in the name, quantity bought, total receipt price, and grams per quantity.
2. Click **Add**.

**Edit an ingredient**
- Click **Edit** on the row, update the purchase details inline, then save. Editing purchase details resets remaining grams to the recalculated total weight.

**Delete an ingredient**
- Click **Delete** on the row. A confirmation dialog will appear.
- Deleting an ingredient removes it from any meals that use it, which changes those meals' costs.

---

### Meals

A meal is a recipe: a name, optional description, number of servings it makes, and a list of ingredients with gram amounts used. Cost is computed automatically from each ingredient's price per gram.

**Add a meal**
1. Click **New Meal**.
2. Enter a name, optional description, and number of servings.
3. Add ingredient rows — pick an available ingredient from the dropdown and enter grams used.
4. Click **Save**. The cost per meal is shown in the table.

**Edit a meal**
- Click **Edit** on the row. The same form opens pre-filled. Updating ingredients replaces the full ingredient list.

**Delete a meal**
- Click **Delete**. Removing a meal also removes it from any plans that include it.

**Cost displayed** is the total cost for the full recipe (all servings combined), not per serving.

---

### Plans

A plan schedules meals across a week. You give it a name, a date range, and choose which meals go on which days.

**Create a plan**
1. Click **New Plan**.
2. Enter a name and start/end dates.
3. Add meal items — pick a meal, choose a day of the week (0 = Sunday … 6 = Saturday), and enter the number of servings to schedule.
4. Click **Save**. Total plan cost is shown on the card.

**Edit a plan**
- Click **Edit** on the plan card. Updating items replaces the full item list.

**Delete a plan**
- Click **Delete** on the plan card.

**Cost displayed** is scaled by servings: if a meal makes 4 servings at $8 total and you schedule 2 servings, it contributes $4 to the plan cost.

---

## Cost Calculation

| What you see | How it's computed |
|---|---|
| Ingredient total weight | `quantity × weightPerQuantityGrams` |
| Ingredient price per gram | `price / totalWeightGrams` |
| Meal cost | Sum of `grams used × pricePerGram` for each ingredient, rounded to 2 decimal places |
| Plan item cost | `(scheduled servings / meal servings) × meal cost` |
| Plan total | Sum of all plan item costs, rounded to 2 decimal places |

Costs update immediately when you save changes to ingredients or meals.

---

## Running Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## Notes

- All prices are in **USD**.
- The database is a local SQLite file at `backend/prisma/dev.db` — it stays on your machine and is not synced anywhere.
- No login or authentication is required; the app is intended for single-user local use.
