// Pure cost computation helpers — no DB access, no side effects

import { Prisma } from '@prisma/client';

type NumericLike = number | string | Prisma.Decimal;

export interface IngredientWithPrice {
  pricePerUnit: NumericLike;
}

export interface MealIngredientWithPrice {
  quantity: NumericLike;
  ingredient: IngredientWithPrice;
}

/**
 * Computes the total cost of a single meal.
 * MealIngredient.quantity is the number of units used.
 * cost = Σ(unitsUsed × pricePerUnit) for each ingredient.
 * Returns a number rounded to 2 decimal places.
 */
export function computeMealCost(ingredients: MealIngredientWithPrice[]): number {
  const total = ingredients.reduce((sum, mi) => {
    const units = Number(mi.quantity);
    const pricePerUnit = Number(mi.ingredient.pricePerUnit);
    return sum + units * pricePerUnit;
  }, 0);
  return Math.round(total * 100) / 100;
}
