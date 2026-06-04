import { Prisma } from '@prisma/client';

type NumericLike = number | string | Prisma.Decimal;

interface IngredientRecord {
  quantity: NumericLike;
  price: NumericLike;
  weightPerQuantityGrams: NumericLike;
  stockWeightGrams: NumericLike;
}

export function serializeIngredient<T extends IngredientRecord>(ingredient: T) {
  const quantity = Number(ingredient.quantity);
  const price = Number(ingredient.price);
  const weightPerQuantityGrams = Number(ingredient.weightPerQuantityGrams);
  const stockWeightGrams = Number(ingredient.stockWeightGrams);
  const totalWeightGrams = quantity * weightPerQuantityGrams;

  return {
    ...ingredient,
    quantity,
    price,
    weightPerQuantityGrams,
    stockWeightGrams,
    totalWeightGrams,
    pricePerGram: totalWeightGrams > 0 ? price / totalWeightGrams : 0,
  };
}
