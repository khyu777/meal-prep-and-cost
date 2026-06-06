---
name: meal-analyzer
description: >
  Decomposes a confirmed meal plan into a deduplicated grouped grocery list,
  then estimates US average prices per ingredient, rolls up per-meal costs and
  a plan total, and estimates per-meal and weekly nutrition (calories, protein,
  carbs, fat). Returns structured JSON only. Called by the meal-planner command
  after plan confirmation, or invoked standalone if meal-plan/ files exist.
allowed-tools: [Read]
disable-model-invocation: false
user-invocable: true
---

# Meal Analyzer Subagent

Three responsibilities in one pass: grocery list generation + price estimation
+ nutrition estimation. Combined to avoid redundant meal decomposition — all
three phases share the same ingredient breakdown.

---

## Entry Points

**Orchestrated (called from meal-planner):**
Input JSON passed directly via Task tool. Proceed to Input Schema.

**Standalone (/meal-analyzer):**
1. List `meal-plan/` — find the most recent `meal-plan-YYYY-MM-DD.md` by date in filename
2. If multiple dates exist, ask which week via `AskUserQuestion`
3. Parse the file to reconstruct confirmed meals
4. Ask for budget ceiling via `AskUserQuestion` if not present in the file
5. Run full analysis and rewrite both files in place

If no `meal-plan/` files found:
> "No meal plan found. Run /meal-planner first."

---

## Input Schema

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

`budget_ceiling` may be null.

---

## Output Schema

```json
{
  "grocery_list": {
    "produce": [
      { "name": "Cucumber", "quantity": 2, "unit": "whole", "usage_cost": 1.20 }
    ],
    "protein": [
      { "name": "Chicken thighs", "quantity": 2, "unit": "lbs", "usage_cost": 3.98 }
    ],
    "dairy": [],
    "pantry": [
      { "name": "Canned chickpeas", "quantity": 2, "unit": "cans (15oz)", "usage_cost": 2.40 }
    ],
    "other": [],
    "staples": [
      { "name": "Olive oil", "quantity": null, "unit": null, "usage_cost": 0.20 }
    ]
  },
  "meals": [
    {
      "name": "Roasted Chickpea Bowl",
      "estimated_cost": 3.20,
      "nutrition": { "calories": 520, "protein_g": 18, "carbs_g": 62, "fat_g": 22 },
      "recipe_ingredients": [
        { "name": "Canned chickpeas", "quantity": 1, "unit": "can (15oz)" },
        { "name": "Cucumber", "quantity": 1, "unit": "whole" },
        { "name": "Tahini", "quantity": 2, "unit": "tbsp" },
        { "name": "Olive oil", "quantity": 1, "unit": "tbsp" },
        { "name": "Pita bread", "quantity": 2, "unit": "whole" }
      ],
      "steps": [
        "Preheat oven to 425°F. Drain and dry chickpeas, toss with olive oil, salt, and cumin.",
        "Roast chickpeas 25–30 min until crispy, shaking halfway.",
        "Slice cucumber. Whisk tahini with lemon juice and water to make sauce.",
        "Assemble bowl: chickpeas, cucumber, tahini sauce. Serve with warm pita."
      ]
    }
  ],
  "total_estimated_cost": 52.40,
  "budget_status": "under",
  "weekly_nutrition": {
    "calories": 9800,
    "protein_g": 420,
    "carbs_g": 820,
    "fat_g": 380
  },
  "tracker_upload": {
    "ingredients": [
      {
        "name": "Canned chickpeas",
        "quantity": 2,
        "unit": "can (15oz)",
        "weight_per_quantity_grams": 425,
        "price": 2.40
      }
    ],
    "meals": [
      {
        "name": "Roasted Chickpea Bowl",
        "description": "Chickpeas tahini cucumber pita",
        "servings": 2,
        "ingredients": [
          { "name": "Canned chickpeas", "grams": 213 }
        ]
      }
    ]
  }
}
```

`budget_status`: `"under"`, `"over"`, or `null` if no ceiling set.
Nutrition values are per serving (1 adult, standard portion).

Return JSON only. No preamble, no markdown fences.

---

## Phase 1 — Grocery List Generation

### Meal prep mode (`meal_prep: true`)
- Scale ingredient quantities to **batch size** — enough to cover all meals that share that ingredient across the week, not per-meal quantities
- Example: if chicken thighs appear in 4 meals, quantity = total needed for all 4, not just 1
- Grocery list still deduplicates and aggregates as normal — batch scaling happens before aggregation

### Decomposition
- Break every meal into component ingredients with realistic home-cooking quantities
- Standard units: whole, oz, lbs, g, kg, cup, tbsp, tsp, can, bunch, pack, jar
- **Preserve per-meal quantities** — these feed `recipe_ingredients` directly before aggregation

### Deduplication and aggregation
- Merge identical ingredients across all meals, sum quantities
- Convert to most practical unit if units differ
- Don't output "16 tsp olive oil" — flag as staple instead

### Grouping rules
| Group | What belongs |
|---|---|
| Produce | Fresh fruits, vegetables, herbs |
| Protein | Meat, fish, eggs, tofu, tempeh |
| Dairy | Milk, cheese, yogurt, butter, cream |
| Pantry | Canned goods, dried pasta/grains, oils, vinegars, sauces, nut butters |
| Other | Bread, frozen items, specialty items |
| Staples | Near-universal pantry items: olive oil, salt, pepper, sugar, flour, common dried spices, garlic, onion, bay leaves, soy sauce, vinegar |

- Staples: set `quantity: null`, `unit: null`
- Do NOT flag specialty ingredients as staples (tahini, fish sauce, harissa, etc.)
- Default assumption: 2 adults, standard portions
- Round up to nearest purchasable unit (1.5 cans → 2 cans)

---

## Phase 2 — Price Estimation

### Price basis
- US average grocery prices, generic (not store-specific)
- Per-usage cost, not per-package cost
  - 2 tbsp olive oil → cost of 2 tbsp, not a bottle
  - 1 cup dry rice → cost of 1 cup, not a 5lb bag

### Unit price reference
| Category | Examples |
|---|---|
| Produce | Onion $0.80/ea, garlic $0.50/head, lemon $0.60/ea, spinach $3.50/bag |
| Protein | Chicken thighs $1.99/lb, ground beef $4.99/lb, eggs $0.30/ea, tofu $2.50/block |
| Dairy | Milk $0.15/cup, cheddar $0.50/oz, Greek yogurt $1.00/cup, butter $0.25/tbsp |
| Pantry | Canned chickpeas $1.20/can, dry pasta $0.75/lb, olive oil $0.10/tbsp |
| Grains | White rice $0.15/cup dry, quinoa $0.40/cup dry, bread $0.30/slice |

### Meal cost rollup
- Attribute each ingredient's `usage_cost` proportionally across meals that use it
- If garlic appears in 3 meals, split cost equally across those 3
- Sum attributed costs per meal → `estimated_cost`
- Sum all meal costs → `total_estimated_cost`

### Budget status
- `"under"` if total < ceiling, `"over"` if total >= ceiling, `null` if no ceiling

---

## Phase 3 — Nutrition Estimation

### Basis
- Use USDA average nutritional values per ingredient
- Per-serving values (1 adult, standard portion) — not total recipe yield
- Round to nearest whole number for all macro values

### Macro reference (per ingredient unit — sum across all ingredients in a meal)
| Ingredient | Serving | Cal | Protein | Carbs | Fat |
|---|---|---|---|---|---|
| Chicken thigh (cooked) | 4oz | 210 | 26g | 0g | 11g |
| Ground beef 80/20 | 4oz | 280 | 22g | 0g | 20g |
| Eggs | 1 large | 70 | 6g | 0g | 5g |
| Canned chickpeas | ½ cup | 140 | 7g | 22g | 2g |
| Tofu (firm) | 4oz | 90 | 10g | 2g | 5g |
| Dry pasta | 2oz dry | 200 | 7g | 42g | 1g |
| White rice | ¼ cup dry | 170 | 3g | 37g | 0g |
| Quinoa | ¼ cup dry | 160 | 6g | 29g | 3g |
| Olive oil | 1 tbsp | 120 | 0g | 0g | 14g |
| Tahini | 2 tbsp | 180 | 5g | 6g | 16g |

These are per-ingredient-unit values. Sum them across all ingredients used
in a single serving to get the meal total. A balanced meal should land
around 400–650 cal, 25–40g protein, 40–80g carbs, 10–30g fat.

**Calibration example — Roasted Chickpea Bowl (1 serving):**
- ½ cup chickpeas: 140 cal, 7g protein, 22g carbs, 2g fat
- 1 tbsp olive oil: 120 cal, 0g protein, 0g carbs, 14g fat
- 2 tbsp tahini: 180 cal, 5g protein, 6g carbs, 16g fat
- ½ cucumber: 8 cal, 0g protein, 2g carbs, 0g fat
- 1 pita (small): 80 cal, 3g protein, 15g carbs, 1g fat
- **Total: ~528 cal | 15g protein | 45g carbs | 33g fat**

### Meal nutrition rollup
- Sum macros for all ingredients in a meal at per-serving quantities → `nutrition`
- Sum all meal `nutrition` values across the full plan → `weekly_nutrition`
- Weekly totals cover all meals (lunches + dinners × days)

### Accuracy note
Nutrition values are estimates based on standard USDA data and typical recipe
proportions. Write this disclaimer into `meal-plan.md`:
`*Nutrition estimates are approximate and based on standard USDA values.*`

---

## Phase 5 — Tracker Upload Payload

Append a `tracker_upload` object to the JSON output. This is what the importer
(`backend/scripts/import-plan.ts`) POSTs to the running REST API.

```json
"tracker_upload": {
  "ingredients": [
    {
      "name": "Canned chickpeas",
      "quantity": 2,
      "unit": "can (15oz)",
      "weight_per_quantity_grams": 425,
      "price": 2.40
    }
  ],
  "meals": [
    {
      "name": "Roasted Chickpea Bowl",
      "description": "Chickpeas tahini cucumber pita",
      "servings": 2,
      "ingredients": [
        { "name": "Canned chickpeas", "grams": 213 }
      ]
    }
  ]
}
```

### Rules for `tracker_upload.ingredients`
- `price` = the grocery item's `usage_cost` from the grocery list.
- `weight_per_quantity_grams` = total grams for that item ÷ `quantity` (so `pricePerGram` matches the analyzer's numbers).
- `quantity × weight_per_quantity_grams` **must be ≥ the sum of that ingredient's grams across all meals** — round purchase quantity up so no meal 422s on stock.
- Include **all** ingredients that appear in any meal, including staples that appear in `recipe_ingredients`.
- Name must exactly match the names used in `meals[].ingredients[].name`.

### Rules for `tracker_upload.meals[].ingredients[].grams`
- Use **per-serving-scaled grams** (one adult, standard portion) — not batch-sized.
- For meal-prep mode, `recipe_ingredients` are batch-sized for display; the tracker needs per-meal grams so the app cost calculation is correct.

### Gram conversion reference
| Unit | Approx grams |
|---|---|
| 1 can (15oz) | 425 g |
| 1 cup dry rice | 185 g |
| 1 cup dry quinoa | 185 g |
| 1 cup dry pasta | 100 g |
| 1 tbsp oil / butter | 14 g |
| 1 tbsp tahini / nut butter | 16 g |
| 1 tsp spice | 3 g |
| 1 oz | 28 g |
| 1 lb | 454 g |
| 1 egg (large) | 50 g |
| 1 whole onion (medium) | 110 g |
| 1 garlic head | 50 g |
| 1 lemon | 100 g |
| 1 pita (small) | 60 g |
| 1 slice bread | 30 g |
| 1 whole tomato (medium) | 120 g |
| 1 whole cucumber | 200 g |
| 1 bunch spinach | 170 g |
| 1 cup Greek yogurt | 245 g |
| 1 cup milk | 240 g |
| 1 oz cheddar | 28 g |

---

## Phase 4 — Recipe Generation

### Meal prep mode (`meal_prep: true`)
- `recipe_ingredients` quantities should reflect **batch size** (enough for all meals using that ingredient)
- `steps` should be written as batch cooking instructions:
  - Lead with the batch cook step (e.g. "Cook 3 lbs chicken thighs in bulk — use across Day 1 dinner, Day 2 lunch, Day 3 lunch")
  - Include storage instructions at the end of each recipe: fridge shelf life and whether it freezes well
  - Example storage note: "Store in airtight container — fridge 4 days, freezer 2 months."
  - Combine shared batch components into one recipe (e.g. one "Batch: Roasted Chicken Thighs" recipe referenced by multiple meals, rather than repeating steps)

### recipe_ingredients
- Use the per-meal quantities already computed in Phase 1 (before aggregation)
- List only ingredients actually used in this meal — do not include ingredients from other meals
- Staples (oil, salt, spices) should appear here with their per-meal quantities even though they're flagged as staples in the grocery list

### steps
- 3–5 steps per meal, written as concise cooking instructions
- Each step max 20 words
- Cover: any prep/oven preheat, main cooking action, any sauce or assembly, plating
- Assume a competent home cook — skip obvious basics ("wash your hands", "get a pan")
- Include temperatures and times where they matter (roasting, baking, simmering)
- Example style: "Roast chickpeas at 425°F for 25 min, shaking halfway, until crispy."

