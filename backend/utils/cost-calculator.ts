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
