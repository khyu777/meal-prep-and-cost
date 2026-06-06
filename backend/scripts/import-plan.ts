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

function parseArgs(): { filePath: string | undefined; weekStart: string | undefined } {
  const args = process.argv.slice(2);
  let filePath: string | undefined;
  let weekStart: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week' && args[i + 1]) {
      weekStart = args[++i];
    } else if (!args[i].startsWith('--')) {
      filePath = args[i];
    }
  }
  return { filePath, weekStart };
}

async function main() {
  const { filePath: argPath, weekStart } = parseArgs();

  // Resolve input file
  let inputPath = argPath;
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

  let created = 0;
  let reused = 0;

  // Create new ingredients with 0 stock; skip existing ones
  for (const ing of upload.ingredients) {
    const key = ing.name.toLowerCase();

    if (nameToId.has(key)) {
      reused++;
      console.log(`  ✓ Reused "${ing.name}"`);
    } else {
      const result = await apiFetch<ApiIngredient>('/api/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          name: ing.name,
          quantity: 0,
          price: ing.price,
          weightPerQuantityGrams: ing.weight_per_quantity_grams,
        }),
      });
      nameToId.set(key, result.id);
      created++;
      console.log(`  + Created "${ing.name}" (0 stock — fill in actual amount bought)`);
    }
  }

  // Create meals
  let mealsCreated = 0;
  const createdMealIds: number[] = [];
  const mealFailures: { name: string; error: string }[] = [];

  for (const meal of upload.meals) {
    const ingredients = meal.ingredients.map(mi => {
      const id = nameToId.get(mi.name.toLowerCase());
      if (!id) throw new Error(`No id found for ingredient "${mi.name}" — not in upload payload`);
      return { ingredientId: id, quantity: 0 };
    });

    try {
      const createdMeal = await apiFetch<{ id: number }>('/api/meals', {
        method: 'POST',
        body: JSON.stringify({
          name: meal.name,
          description: meal.description ?? '',
          servings: meal.servings,
          ingredients,
        }),
      });
      createdMealIds.push(createdMeal.id);
      mealsCreated++;
      console.log(`  + Created meal "${meal.name}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mealFailures.push({ name: meal.name, error: msg });
      console.error(`  ✗ Failed "${meal.name}": ${msg}`);
    }
  }

  // Create a MealPlan for the specified week if --week was given
  let planCreated = false;
  if (weekStart && mealsCreated > 0) {
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // Distribute created meal IDs round-robin across days 0–6
    const planMealIds = createdMealIds;
    const items = planMealIds.map((mealId, idx) => ({
      mealId,
      dayOfWeek: idx % 7,
      servings: upload.meals[idx]?.servings ?? 1,
    }));

    try {
      await apiFetch('/api/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: `Week of ${weekStart}`,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          items,
        }),
      });
      planCreated = true;
      console.log(`  + Created plan "Week of ${weekStart}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed to create plan: ${msg}`);
    }
  }

  console.log(`
Summary:
  Ingredients created: ${created}
  Ingredients reused:  ${reused}
  Meals created:       ${mealsCreated}
  Meals failed:        ${mealFailures.length}${weekStart ? `\n  Plan created:        ${planCreated ? 'yes' : 'no'}` : ''}
`);

  if (mealFailures.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
