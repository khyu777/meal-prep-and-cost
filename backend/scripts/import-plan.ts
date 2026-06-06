// Imports a tracker-upload-*.json file into the running backend via REST API.
// Usage: ts-node scripts/import-plan.ts [path/to/tracker-upload.json]
// If no path given, picks the newest meal-plan/tracker-upload-*.json in the repo root.

import * as fs from 'fs';
import * as path from 'path';

interface UploadIngredient {
  name: string;
  quantity: number;
  unit: string;
  weight_per_quantity_grams: number;
  price: number;
}

interface UploadMealIngredient {
  name: string;
  grams: number;
}

interface UploadMeal {
  name: string;
  description?: string;
  servings: number;
  ingredients: UploadMealIngredient[];
}

interface TrackerUpload {
  ingredients: UploadIngredient[];
  meals: UploadMeal[];
}

interface TrackerUploadFile {
  tracker_upload: TrackerUpload;
}

interface ApiIngredient {
  id: number;
  name: string;
  quantity: number;
  price: number;
  weightPerQuantityGrams: number;
  stockWeightGrams: number;
}

const API_BASE = process.env.API_BASE ?? 'http://localhost:3002';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const json = await res.json() as { data: T; error: string | { message?: string } | null };
  if (json.error) {
    const msg = typeof json.error === 'string' ? json.error : json.error.message ?? 'Request failed';
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return json.data;
}

function findNewestUploadFile(): string | null {
  const mealPlanDir = path.resolve(__dirname, '../../meal-plan');
  if (!fs.existsSync(mealPlanDir)) return null;
  const files = fs.readdirSync(mealPlanDir)
    .filter(f => f.startsWith('tracker-upload-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length ? path.join(mealPlanDir, files[0]) : null;
}

async function main() {
  // Resolve input file
  let inputPath = process.argv[2];
  if (!inputPath) {
    const found = findNewestUploadFile();
    if (!found) {
      console.error('No tracker-upload-*.json found in meal-plan/. Run /meal-planner first.');
      process.exit(1);
    }
    inputPath = found;
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as TrackerUploadFile;
  const upload: TrackerUpload = raw.tracker_upload ?? (raw as unknown as TrackerUpload);

  console.log(`Importing from: ${inputPath}`);

  // Health check
  try {
    await fetch(`${API_BASE}/health`);
  } catch {
    console.error(`Cannot reach backend at ${API_BASE}. Start it first:\n  cd backend && npm run dev`);
    process.exit(1);
  }

  // Build existing ingredient map: name → id
  const existingIngredients = await apiFetch<ApiIngredient[]>('/api/ingredients');
  const nameToId = new Map<string, number>(existingIngredients.map(i => [i.name.toLowerCase(), i.id]));
  const nameToStock = new Map<string, number>(existingIngredients.map(i => [i.name.toLowerCase(), i.stockWeightGrams]));

  // Compute total grams needed per ingredient across all meals
  const gramsNeeded = new Map<string, number>();
  for (const meal of upload.meals) {
    for (const mi of meal.ingredients) {
      const key = mi.name.toLowerCase();
      gramsNeeded.set(key, (gramsNeeded.get(key) ?? 0) + mi.grams);
    }
  }

  let created = 0;
  let reused = 0;
  let toppedUp = 0;

  // Create or reuse ingredients
  for (const ing of upload.ingredients) {
    const key = ing.name.toLowerCase();
    const needed = gramsNeeded.get(key) ?? 0;

    if (nameToId.has(key)) {
      // Reuse — top up stock if insufficient
      const currentStock = nameToStock.get(key) ?? 0;
      if (currentStock < needed) {
        const existingId = nameToId.get(key)!;
        const deficit = needed - currentStock;
        const addQuantity = Math.ceil(deficit / ing.weight_per_quantity_grams);
        const existing = existingIngredients.find(e => e.id === existingId)!;
        await apiFetch(`/api/ingredients/${existingId}`, {
          method: 'PUT',
          body: JSON.stringify({ quantity: existing.quantity + addQuantity }),
        });
        toppedUp++;
        console.log(`  ↑ Topped up "${ing.name}" by ${addQuantity} ${ing.unit} (stock was ${currentStock}g, needed ${needed}g)`);
      } else {
        reused++;
        console.log(`  ✓ Reused "${ing.name}" (stock ${currentStock}g, need ${needed}g)`);
      }
    } else {
      // Compute quantity that covers the needed grams
      const minQuantity = needed > 0
        ? Math.ceil(needed / ing.weight_per_quantity_grams)
        : ing.quantity;
      const quantity = Math.max(ing.quantity, minQuantity);

      const result = await apiFetch<ApiIngredient>('/api/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          name: ing.name,
          quantity,
          price: ing.price,
          weightPerQuantityGrams: ing.weight_per_quantity_grams,
        }),
      });
      nameToId.set(key, result.id);
      created++;
      console.log(`  + Created "${ing.name}" (${quantity} ${ing.unit})`);
    }
  }

  // Create meals
  let mealsCreated = 0;
  const mealFailures: { name: string; error: string }[] = [];

  for (const meal of upload.meals) {
    const ingredients = meal.ingredients.map(mi => {
      const id = nameToId.get(mi.name.toLowerCase());
      if (!id) throw new Error(`No id found for ingredient "${mi.name}" — not in upload payload`);
      return { ingredientId: id, quantity: mi.grams };
    });

    try {
      await apiFetch('/api/meals', {
        method: 'POST',
        body: JSON.stringify({
          name: meal.name,
          description: meal.description ?? '',
          servings: meal.servings,
          ingredients,
        }),
      });
      mealsCreated++;
      console.log(`  + Created meal "${meal.name}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mealFailures.push({ name: meal.name, error: msg });
      console.error(`  ✗ Failed "${meal.name}": ${msg}`);
    }
  }

  console.log(`
Summary:
  Ingredients created: ${created}
  Ingredients reused:  ${reused}
  Ingredients topped up: ${toppedUp}
  Meals created:       ${mealsCreated}
  Meals failed:        ${mealFailures.length}
`);

  if (mealFailures.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
