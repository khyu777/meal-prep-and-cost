// Pure cost computation helpers — no DB access, no side effects

import { Prisma } from '@prisma/client';

type NumericLike = number | string | Prisma.Decimal;

export interface IngredientWithPrice {
  price: NumericLike;
  quantity: NumericLike;
  weightPerQuantityGrams: NumericLike;
}

export interface MealIngredientWithPrice {
  quantity: NumericLike;
  ingredient: IngredientWithPrice;
}

export interface MealWithIngredients {
  ingredients: MealIngredientWithPrice[];
}

export interface PlanItemWithMeal {
  servings: number;
  meal: MealWithIngredients;
}

/**
 * Computes the total cost of a single meal.
 * MealIngredient.quantity is grams used.
 * cost = Σ(gramsUsed × pricePerGram) for each ingredient.
 * Returns a number rounded to 2 decimal places.
 */
export function computeMealCost(ingredients: MealIngredientWithPrice[]): number {
  const total = ingredients.reduce((sum, mi) => {
    const qty = Number(mi.quantity);
    const totalWeightGrams =
      Number(mi.ingredient.quantity) * Number(mi.ingredient.weightPerQuantityGrams);
    const pricePerGram = totalWeightGrams > 0 ? Number(mi.ingredient.price) / totalWeightGrams : 0;
    return sum + qty * pricePerGram;
  }, 0);
  return Math.round(total * 100) / 100;
}

export interface PlanItemForCost {
  mealId: number;
  servings: number;
  meal: {
    servings: number;
    ingredients: MealIngredientWithPrice[];
  };
}

/**
 * Computes the total cost of a meal plan.
 * Memoizes each meal's base cost by mealId to avoid re-summing ingredients
 * when the same meal appears multiple times in the plan.
 * Each item scales cost by (item.servings / meal.servings).
 */
export function computePlanCost(items: PlanItemForCost[]): number {
  const costByMealId = new Map<number, number>();
  const total = items.reduce((sum, item) => {
    if (!costByMealId.has(item.mealId)) {
      costByMealId.set(item.mealId, computeMealCost(item.meal.ingredients));
    }
    const baseCost = costByMealId.get(item.mealId)!;
    const scalingFactor = item.meal.servings > 0 ? item.servings / item.meal.servings : 1;
    return sum + baseCost * scalingFactor;
  }, 0);
  return Math.round(total * 100) / 100;
}
