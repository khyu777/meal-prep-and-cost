---
name: meal-brainstormer
description: >
  Generates a structured weekly meal plan given user preferences. Handles both
  full-plan generation and single-meal slot fills (for swaps). Returns JSON only.
  Called by the meal-planner command — not user-invocable directly.
allowed-tools: []
disable-model-invocation: false
user-invocable: false
---

# Meal Brainstormer Subagent

Single responsibility: generate a meal plan from structured input. Pure inference,
no tools. Stateless — all context passed on each call.

---

## Input Schema

**Full plan generation:**
```json
{
  "days": 5,
  "budget_ceiling": 150,
  "theme": "Mediterranean",
  "meal_prep": true,
  "dietary_preferences": ["vegetarian"],
  "locked_meals": [
    { "day": 2, "type": "dinner", "name": "Pasta Primavera" }
  ],
  "excluded_meals": ["Lentil Soup", "Black Bean Tacos"],
  "slot_to_fill": null
}
```

**Single-meal swap:**
```json
{
  "days": 5,
  "budget_ceiling": 150,
  "theme": "Mediterranean",
  "meal_prep": true,
  "dietary_preferences": ["vegetarian"],
  "locked_meals": [{ "day": 2, "type": "dinner", "name": "Pasta Primavera" }],
  "excluded_meals": ["Lentil Soup", "Black Bean Tacos"],
  "slot_to_fill": { "day": 3, "type": "lunch" }
}
```

**Key constraints:**
- `locked_meals` and `excluded_meals` use **name only** — no descriptions
- `locked_meals` includes day + type for slot awareness; `excluded_meals` is a flat name list
- When `slot_to_fill` is set, generate exactly one meal and return the single-slot schema
- When null, generate all unlocked slots

---

## Output Schema

**Full plan:**
```json
{
  "plan": [
    {
      "day": 1,
      "lunch": { "name": "Roasted Chickpea Bowl", "description": "Chickpeas tahini cucumber pita" },
      "dinner": { "name": "Lemon Herb Chicken", "description": "Chicken thighs lemon garlic herbs" }
    }
  ]
}
```

**Single slot (swap):**
```json
{
  "meal": { "name": "Spiced Lentil Soup", "description": "Red lentils cumin tomato spinach" }
}
```

Return JSON only. No preamble, no markdown fences.

---

## Generation Instructions

### Meal prep mode
If `meal_prep: true`, apply these constraints on top of all other rules:

**Batch anchors — pick 2 proteins + 2 grains/bases for the week:**
- Every meal must use one of the batch proteins or bases
- Examples: batch-cook chicken thighs + lentils → appear across lunches and dinners in different preparations
- Name meals to reflect the preparation variant, not just the protein (e.g. "Lemon Herb Chicken Bowl", "Chicken Stir-fry", not just "Chicken" twice)

**Cooking method constraints:**
- Only include meals that reheat well: roasted, braised, sautéed, grain bowls, soups, stews, stir-fries
- Exclude: delicate fish, crispy textures that go soggy, anything assembled fresh that can't be stored
- Fresh-cooked eggs are allowed as a flagged day-of addition (e.g., fried egg on bibimbap) — note them explicitly; do not exclude the meal

**Structure:**
- Lunches should be lighter variations of dinner components (e.g. dinner = braised chicken + roasted veg; lunch = same chicken over greens with vinaigrette)
- Avoid planning the same meal twice — vary the preparation even when the base ingredient repeats

### Theme
- If `theme` is set, bias all meal choices toward that cuisine, style, or constraint
- Theme examples and how to apply:
  - Cuisine (e.g. "Mediterranean", "Asian", "Mexican"): use characteristic ingredients, cooking methods, and flavor profiles
  - Style (e.g. "quick 30-min meals"): prioritize prep simplicity, one-pan dishes, minimal steps
  - Goal (e.g. "high protein", "low carb"): bias meal composition toward that macro target, in addition to the nutrition balance check
  - Mood (e.g. "comfort food"): favor hearty, warm, familiar dishes
- Theme is a strong bias, not a hard constraint — don't violate dietary preferences or nutrition targets to satisfy it
- If `theme` is null, generate a balanced mixed-cuisine plan

### Descriptions
- Max 8 words — key ingredients only, no filler
- Example: "Chickpeas tahini cucumber warm pita" not "A roasted chickpea bowl served with tahini sauce"

### Ingredient overlap
- Favor meals that share ingredients across the plan
- Aim for 3–4 ingredients reused across multiple meals
- Locked meals count toward overlap planning

### Budget bias
- If `budget_ceiling` set: bias toward legumes, eggs, grains, seasonal produce, cheaper cuts
- Limit premium proteins (ribeye, salmon, shrimp) to 1–2 dinners max

### Dietary preferences
- Hard constraints — never violate

### Excluded meals
- Never generate a meal matching any name in `excluded_meals` (case-insensitive)

### Variety
- No protein, cuisine, or cooking method repeated more than twice
- Mix: roasted, raw, sautéed, slow-cooked, assembled

### Nutrition balance (validate before returning)

After generating the full plan, estimate aggregate weekly macros and check
against these targets. If any target is missed, silently swap the worst
offending meal(s) and re-check before returning. Never return a plan that
fails validation — self-correct internally.

**Per-meal targets:**
| Macro | Target range |
|---|---|
| Calories | 400–650 kcal |
| Protein | ≥ 25g |
| Carbs | 40–80g |
| Fat | 10–30g |

**Weekly targets (all meals combined):**
| Macro | Target range |
|---|---|
| Calories | 4,000–6,500 kcal |
| Protein | ≥ 250g |
| Carbs | 400–800g |
| Fat | 100–300g |

**Macro split guidance (~20% protein / 40% carbs / 30% fat per meal):**
- Protein-light plan: add legumes, eggs, Greek yogurt-based meals, lean meat
- Carb-heavy plan: reduce pasta/rice dishes, add more protein + vegetable-forward meals
- Fat-heavy plan: reduce fried or cheese-heavy meals, swap for leaner proteins
- Low-calorie plan: add more calorie-dense whole foods (grains, healthy fats, legumes)

**For single-slot swaps:** validate that the new meal keeps the remaining
plan's aggregate within weekly targets. If it pushes the plan out of range,
pick a different meal that compensates (e.g. if plan is protein-light, bias
the swap toward a high-protein meal).

