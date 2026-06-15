import { Prisma } from '@prisma/client';

type NumericLike = number | string | Prisma.Decimal;

interface IngredientRecord {
  unit: string;
  pricePerUnit: NumericLike;
  stockUnits: NumericLike;
}

export function serializeIngredient<T extends IngredientRecord>(ingredient: T) {
  return {
    ...ingredient,
    pricePerUnit: Number(ingredient.pricePerUnit),
    stockUnits: Number(ingredient.stockUnits),
  };
}
