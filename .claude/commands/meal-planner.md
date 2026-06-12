# Meal Planner

Orchestrates the full meal planning workflow across three phases using two
subagents. Holds all session state. Subagents are stateless — all context
is passed explicitly on each call.

---

## Step 0 — Parse Args

Before asking anything, parse `$ARGUMENTS` (the text after `/meal-planner`) and
pre-populate the session state. Recognized signals:

| Signal in args | Field set |
|---|---|
| `meal prep` / `batch cook` / `prep` | `meal_prep: true` |
| `N days` / `N-day` | `days: N` |
| `under $N` / `$N budget` / `$N` | `budget_ceiling: N` |
| `N meat(s)` / `two meats` / `chicken and beef` etc. | note in `theme` |
| `in <place>` / city or metro name (e.g. `in Seattle`, `NYC`) | `location` |
| any cuisine / diet keyword | `theme` or `dietary_preferences` |

Set each matched field in session state. **Skip the corresponding question in
Step 1 for any field already set.** If args are empty or ambiguous, ask all
questions as normal.

---

## Step 1 — Collect Context

Use two sequential `AskUserQuestion` calls to collect all fields NOT already
set from args. All fields optional — apply defaults if blank. Omit any
question whose field was populated in Step 0.

**Round 1 — core fields** (skip any already set from args):
```
AskUserQuestion({
  "questions": [
    {
      "question": "How many days would you like to plan?",
      "header": "Days",
      "multiSelect": false,
      "options": [
        { "label": "5 days", "description": "Monday–Friday (default)" },
        { "label": "7 days", "description": "Full week including weekend" },
        { "label": "3 days", "description": "Short or partial week" }
      ]
    },
    {
      "question": "Meal prep mode — batch cook once, or cook fresh each meal?",
      "header": "Meal prep",
      "multiSelect": false,
      "options": [
        { "label": "Cook fresh each meal", "description": "No — cook at mealtime (default)" },
        { "label": "Batch cook for the week", "description": "Yes — one big cook session, reheat mid-week" }
      ]
    },
    {
      "question": "Do you have a weekly budget ceiling?",
      "header": "Budget",
      "multiSelect": false,
      "options": [
        { "label": "No limit", "description": "No budget constraint (default)" },
        { "label": "Under $75", "description": "Budget-friendly" },
        { "label": "Under $100", "description": "Moderate" },
        { "label": "Under $150", "description": "Generous" }
      ]
    },
    {
      "question": "Any dietary preferences or restrictions?",
      "header": "Dietary",
      "multiSelect": false,
      "options": [
        { "label": "None", "description": "No restrictions (default)" },
        { "label": "Vegetarian", "description": "No meat" },
        { "label": "Gluten-free", "description": "Avoid gluten" },
        { "label": "No shellfish", "description": "Avoid shellfish only" }
      ]
    }
  ]
})
```

**Round 2 — optional fields** (skip any already set from args; if all three
were set from args, skip this round entirely):
```
AskUserQuestion({
  "questions": [
    {
      "question": "Any meal plan theme or cuisine preference?",
      "header": "Theme",
      "multiSelect": false,
      "options": [
        { "label": "No preference", "description": "Varied, balanced meals (default)" },
        { "label": "High protein", "description": "Fitness-focused, protein-dense" },
        { "label": "Mediterranean", "description": "Fresh, healthy Mediterranean style" },
        { "label": "Quick 30-min meals", "description": "Fast meals for busy weekdays" }
      ]
    },
    {
      "question": "Where are you shopping? (used to estimate local prices)",
      "header": "Location",
      "multiSelect": false,
      "options": [
        { "label": "US average", "description": "No specific location (default)" },
        { "label": "NYC", "description": "New York City" },
        { "label": "Seattle", "description": "Seattle / Pacific Northwest" },
        { "label": "Other", "description": "Enter your city in the notes field" }
      ]
    },
    {
      "question": "Any meals already locked in for specific days?",
      "header": "Locked meals",
      "multiSelect": false,
      "options": [
        { "label": "None", "description": "No locked meals (default)" },
        { "label": "Yes — I'll describe", "description": "Add a note below, e.g. 'Pasta night Wednesday dinner'" }
      ]
    }
  ]
})
```

If ALL fields were set from args, skip both `AskUserQuestion` calls and
proceed to Step 2.

Do not ask these conversationally. Fire round 1, wait for response, then fire
round 2.

---

## Step 2 — Generate Meal Plan (Phase 1)

Call `meal-brainstormer` via Task tool.

```json
{
  "days": 5,
  "budget_ceiling": 150,
  "theme": "Mediterranean",
  "meal_prep": true,
  "dietary_preferences": ["vegetarian"],
  "locked_meals": [{ "day": 2, "type": "dinner", "name": "Pasta Primavera" }],
  "excluded_meals": [],
  "slot_to_fill": null
}
```

**When `meal_prep` is `true`**, add this requirement explicitly to the
brainstormer prompt:

> All cooking happens in ONE batch session (e.g., Sunday). Every meal must be
> assembly or reheating only — zero active stovetop or oven cooking mid-week.
> Structure meals around a small set of batch-cooked base components
> (proteins, grains, roasted veg, sauces) that combine differently each day.

Store the full plan (with descriptions) in session state.
Display as meal cards:

```
Day 1
  Lunch: [Meal name] — [description]
  Dinner: [Meal name] — [description]
```

---

## Step 3 — Swap / Lock / Regenerate Loop

After displaying the plan, prompt via `AskUserQuestion`:

```
AskUserQuestion({
  "title": "What would you like to do?",
  "questions": [
    {
      "id": "action",
      "label": "Choose an action",
      "type": "select",
      "options": ["Confirm plan", "Swap a meal", "Lock/unlock a meal", "Regenerate all"]
    },
    {
      "id": "detail",
      "label": "Which meal? (if swapping or locking)",
      "type": "text",
      "placeholder": "e.g. Day 3 lunch"
    }
  ]
})
```

**Swap a single meal:**
- Add swapped-out meal name to `excluded_meals`
- Call `meal-brainstormer` with slot-scoped payload only — no full plan needed:
```json
{
  "days": 5,
  "budget_ceiling": 150,
  "theme": "Mediterranean",
  "meal_prep": true,
  "dietary_preferences": ["vegetarian"],
  "locked_meals": [{ "day": 2, "type": "dinner", "name": "Pasta Primavera" }],
  "excluded_meals": ["Lentil Soup"],
  "slot_to_fill": { "day": 3, "type": "lunch" }
}
```
- Update only that slot in session state and redisplay that card

**Lock/unlock a meal:**
- Toggle locally — no subagent call
- Update `locked_meals` in session state (names only)

**Regenerate all:**
- Call `meal-brainstormer` with full context
- `locked_meals` = all currently locked meal names + day + type
- `excluded_meals` = all meal names seen so far
- Replace all unlocked slots in session state

Repeat until user selects "Confirm plan".

---

## Step 4 — Confirm Plan

- Collect final meal list from session state (name + description for each slot)
- Display confirmed summary
- Advance to Phase 2

---

## Step 5 — Analyze Meals (Phase 2 + 3)

Call `meal-analyzer` via Task tool (grocery list + prices + nutrition in one call).

```json
{
  "confirmed_meals": [
    { "name": "Roasted Chickpea Bowl", "description": "Chickpeas tahini cucumber pita" },
    { "name": "Lemon Herb Chicken", "description": "Chicken thighs lemon garlic herbs" }
  ],
  "budget_ceiling": 150,
  "meal_prep": true,
  "location": "Seattle"
}
```

Pass `location` from session state (null if unset → analyzer uses US average).

**Do NOT add a custom return schema to the prompt.** The analyzer has its own documented output format — overriding it will produce incomplete JSON (e.g., missing `tracker_upload.ingredients`). Just pass the input payload above and let the analyzer return its full format.

Hold returned JSON in memory as `output_json`. Do not write to file yet.

---

## Step 6 — Write All Output (single pass)

Run `mkdir -p meal-plan` unconditionally — this is a no-op if the directory already exists.

Generate datestamp from current date: `YYYY-MM-DD`.

Also write `meal-plan/tracker-upload-YYYY-MM-DD.json` from `output_json.tracker_upload`:

```json
{
  "tracker_upload": { ...output_json.tracker_upload }
}
```

This is the portable import file — keep the `tracker_upload` wrapper key so the importer can detect it regardless of how the file was generated.

**Write `meal-plan/meal-plan-YYYY-MM-DD.md`:**

```
# Meal Plan

| Day | Meal | Description | Cost | Cal | Protein | Carbs | Fat |
|---|---|---|---|---|---|---|---|
| Day 1 | Lunch: Roasted Chickpea Bowl | Chickpeas tahini cucumber pita | ~$3.20 | 520 | 18g | 62g | 22g |
| Day 1 | Dinner: Lemon Herb Chicken | Chicken thighs lemon garlic herbs | ~$4.75 | 480 | 42g | 8g | 28g |
...

**Total estimated cost: ~$52.40**
**Weekly nutrition: ~9,800 cal | 420g protein | 820g carbs | 380g fat**

[If budget_ceiling set and under:]
✅ Under budget ($150.00 ceiling)

[If budget_ceiling set and over:]
⚠️ Over budget ($150.00 ceiling) — consider swapping high-cost meals

*Prices are estimates for {location, or "US average" if unset} and may vary by store.*
*Nutrition estimates are approximate and based on standard USDA values.*

---

## Prep Session — Cook Everything Once (~X hours)

[Include this section only when `meal_prep` is `true`. Omit entirely for fresh-cook plans.]

Synthesize a single unified prep session from the `steps` arrays across all meals in `output_json.meals`. De-duplicate shared tasks (e.g., batch-cooking a grain used in multiple meals appears once). Order steps logically: longest-running tasks first (grains, braised proteins), oven waves in sequence, stovetop tasks in parallel windows, sauces and light prep last. Estimate a realistic total session time and use it in the header.

**Prep these N components in one batch session. Every meal below is just assembly + reheat.**

| Step | Task | Time | Notes |
|---|---|---|---|
| 1 | [first task] | [X min] | [tip or constraint] |
| 2 | [next task] | [X min] | [tip or constraint] |
...
| N | Portion all components into labeled airtight containers. Refrigerate. | 15 min | [fridge life summary for each component type] |

---

## Assembly Guide

Each meal is assembled cold or reheated. No stovetop needed at mealtime.

### Day 1 Lunch — Roasted Chickpea Bowl
**Ingredients:** Chickpeas — 80g · Cucumber — 120g · Tahini — 30g · Olive oil — 12g · Pita bread — 120g

Reheat chickpeas. Top with cucumber slices and tahini sauce. Serve with warm pita.

---

### Day 1 Dinner — Lemon Herb Chicken
...
```

Gram amounts come from `output_json.tracker_upload.meals[i].ingredients[].grams`. Every meal's **Ingredients** line must list each ingredient with its gram amount (e.g. `Chicken thighs — 150g · White rice — 90g`). Use the grams from `tracker_upload`, not the batch-sized quantities from `recipe_ingredients`.

```
## Produce
- [ ] Cucumber — 2 whole — ~$1.20
- [ ] Lemon — 3 whole — ~$1.80

## Protein
- [ ] Chicken thighs — 2 lbs — ~$3.98

## Dairy
...

## Pantry
...

## Other
...

<details>
<summary>Staples — check what you need</summary>
- [ ] Olive oil — check stock — ~$0.20/tbsp
</details>

*Prices are estimates for {location, or "US average" if unset} and may vary by store.*
```

Once written, proceed to Step 7 before notifying the user.

---

## Step 7 — Upload to Tracker (confirm gate)

Ask the user:

```
AskUserQuestion({
  "title": "Upload to tracker?",
  "questions": [
    {
      "id": "upload",
      "label": "Upload this plan's ingredients and meals to the tracker?",
      "type": "select",
      "options": ["Yes — upload now", "No — I'll do it later with /meal-uploader"]
    }
  ]
})
```

**If "Yes":**
1. Ask which week this plan is for:
```
AskUserQuestion({
  "questions": [
    {
      "question": "Which week should these meals be planned for?",
      "header": "Plan week",
      "multiSelect": false,
      "options": [
        { "label": "This week", "description": "Week starting this Sunday" },
        { "label": "Next week", "description": "Week starting next Sunday" },
        { "label": "Custom date", "description": "Enter a specific Sunday (YYYY-MM-DD)" }
      ]
    }
  ]
})
```
Compute `weekStart` as `YYYY-MM-DD`: "This week" → most recent Sunday on or before today; "Next week" → 7 days after; "Custom date" → ask via follow-up prompt.

2. Run: `curl -s http://localhost:3002/health`
   - If that fails, tell the user: "The backend isn't running. Start it with `npm run dev` in the `backend/` folder, then run `/meal-uploader` to upload."
   - Do not proceed further.
3. Run: `cd backend && npm run import-plan -- ../meal-plan/tracker-upload-YYYY-MM-DD.json --week <weekStart>`
4. Report the summary line printed by the importer (ingredients created/reused, meals created/failed, plan created).

**If "No":**
> Note: Run `/meal-uploader` any time to upload `meal-plan/tracker-upload-YYYY-MM-DD.json` to the tracker.

**Either way, notify the user:**
> "Done. Saved to meal-plan/ (YYYY-MM-DD) — meal plan with recipes, grocery list, and tracker-upload JSON."

---

## State Object (maintain throughout session)

```json
{
  "days": 5,
  "budget_ceiling": null,
  "location": null,
  "dietary_preferences": [],
  "locked_meals": [],
  "excluded_meals": [],
  "current_plan": {},
  "confirmed": false
}
```

Never pass stale state to a subagent. Strip descriptions before any subagent call —
keep them in session state for display only.
