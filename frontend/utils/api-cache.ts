// Shared list caches for the data hooks — dedupes in-flight fetches and centralizes invalidation
import type { Ingredient, MealWithCost, PlanWithCost } from './types';

export class ListCache<T> {
  private cache: T[] | null = null;
  private inflight: Promise<T[]> | null = null;

  // Returns cached data, or joins the in-flight fetch so late subscribers still get the result
  load(fetcher: () => Promise<T[]>): Promise<T[]> {
    if (this.cache) return Promise.resolve(this.cache);
    if (!this.inflight) {
      this.inflight = fetcher()
        .then((data) => {
          this.cache = data;
          return data;
        })
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }

  invalidate(): void {
    this.cache = null;
  }
}

// One cache per collection, shared across all hook instances
export const ingredientsCache = new ListCache<Ingredient>();
export const mealsCache = new ListCache<MealWithCost>();
export const plansCache = new ListCache<PlanWithCost>();

// Ingredient changes ripple into meal costs and plan data nested in API responses
export function invalidateIngredientData(): void {
  ingredientsCache.invalidate();
  mealsCache.invalidate();
  plansCache.invalidate();
}

// Meal mutations also move ingredient stock and feed plan items
export function invalidateMealData(): void {
  ingredientsCache.invalidate();
  mealsCache.invalidate();
  plansCache.invalidate();
}

export function invalidatePlanData(): void {
  plansCache.invalidate();
}
