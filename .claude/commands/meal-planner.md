# Meal Planner

Orchestrates the full meal planning workflow across three phases using two
subagents. Holds all session state. Subagents are stateless — all context
is passed explicitly on each call.

---

## Step 1 — Collect Context

Use `AskUserQuestion` to collect all fields upfront in a single prompt.
All fields optional — apply defaults if blank.

```
AskUserQuestion({
  "title": "Let's plan your week",
  "questions": [
    {
      "id": "days",
      "label": "How many days to plan?",
      "type": "number",
      "default": 5
    },
    {
      "id": "budget",
      "label": "Weekly budget ceiling (optional)",
      "type": "text",
      "placeholder": "e.g. $150 — leave blank for no limit"
    },
    {
      "id": "theme",
      "label": "Meal plan theme or cuisine (optional)",
      "type": "text",
      "placeholder": "e.g. Mediterranean, quick 30-min meals, high protein, comfort food"
    },
    {
      "id": "dietary",
      "label": "Dietary preferences (optional)",
      "type": "text",
      "placeholder": "e.g. vegetarian, no shellfish, gluten-free"
    },
    {
      "id": "meal_prep",
      "label": "Meal prep mode?",
      "type": "select",
      "options": ["No — cook fresh each meal", "Yes — batch cook for the week"],
      "default": "No — cook fresh each meal"
    },
    {
      "id": "locked",
      "label": "Any meals already locked in? (optional)",
      "type": "text",
      "placeholder": "e.g. Pasta night on Wednesday dinner"
    }
  ]
})
```

Do not ask these conversationally. Fire once and wait.

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
  "meal_prep": true
}
```

Hold returned JSON in memory as `output_json`. Do not write to file yet.

---

## Step 6 — Write All Output (single pass)

Run `mkdir -p meal-plan` unconditionally — this is a no-op if the directory already exists.

Generate datestamp from current date: `YYYY-MM-DD`.

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

*Prices are US average estimates and may vary by region and store.*
*Nutrition estimates are approximate and based on standard USDA values.*

---

## Recipes

### Day 1 Lunch — Roasted Chickpea Bowl

**Ingredients**
- 1 can (15oz) chickpeas
- 1 cucumber, sliced
- 2 tbsp tahini
- 1 tbsp olive oil
- 2 pita breads

**Steps**
1. Preheat oven to 425°F. Drain and dry chickpeas, toss with olive oil, salt, cumin.
2. Roast 25–30 min until crispy, shaking halfway.
3. Whisk tahini with lemon juice and water to make sauce.
4. Assemble: chickpeas, cucumber, tahini sauce. Serve with warm pita.

---

### Day 1 Dinner — Lemon Herb Chicken
...
```

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

*Prices are US average estimates and may vary by region and store.*
```

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

*Prices are US average estimates and may vary by region and store.*
*Nutrition estimates are approximate and based on standard USDA values.*
```

Once written, notify the user:
> "Done. Saved to meal-plan/ (YYYY-MM-DD) — meal plan with recipes, and grocery list."

---

## State Object (maintain throughout session)

```json
{
  "days": 5,
  "budget_ceiling": null,
  "dietary_preferences": [],
  "locked_meals": [],
  "excluded_meals": [],
  "current_plan": {},
  "confirmed": false
}
```

Never pass stale state to a subagent. Strip descriptions before any subagent call —
keep them in session state for display only.
