// Clamps grocery purchase quantities to the minimum purchasable unit that covers actual meal usage.

export interface ReconcileIngredient {
  name: string;
  quantity: number;
  unit: string;
  weight_per_quantity_grams: number;
  price: number;
}

export interface ReconcileMealIngredient {
  name: string;
  grams: number;
}

export interface ReconcileMeal {
  ingredients: ReconcileMealIngredient[];
}

export interface ReconcileInput {
  ingredients: ReconcileIngredient[];
  meals: ReconcileMeal[];
}

export interface ReconcileChange {
  name: string;
  fromQuantity: number;
  toQuantity: number;
  unit: string;
  usageGrams: number;
}

export interface ReconcileResult {
  ingredients: ReconcileIngredient[];
  changes: ReconcileChange[];
}

/**
 * Recomputes each ingredient's purchase quantity as the minimum purchasable unit
 * whose total grams cover the summed usage across all meals:
 *   quantity = ceil(usageGrams / weight_per_quantity_grams), min 1 when used at all.
 * pricePerGram is preserved (price recomputed from the original per-gram rate) so
 * downstream meal-cost math is unchanged. Ingredients never used or with no weight
 * are left untouched.
 */
export function reconcilePurchaseQuantities(input: ReconcileInput): ReconcileResult {
  const usageByName = new Map<string, number>();
  for (const meal of input.meals) {
    for (const mi of meal.ingredients) {
      const key = mi.name.toLowerCase();
      usageByName.set(key, (usageByName.get(key) ?? 0) + mi.grams);
    }
  }

  const changes: ReconcileChange[] = [];

  const ingredients = input.ingredients.map((ing) => {
    const usageGrams = usageByName.get(ing.name.toLowerCase()) ?? 0;
    const wpqg = ing.weight_per_quantity_grams;

    // Can't reconcile without a weight basis or any usage — leave as-is.
    if (wpqg <= 0 || usageGrams <= 0) {
      return ing;
    }

    const minQuantity = Math.max(1, Math.ceil(usageGrams / wpqg));
    if (minQuantity >= ing.quantity) {
      // Already at or below the minimum — never inflate a purchase.
      return ing;
    }

    const pricePerGram =
      ing.quantity > 0 ? ing.price / (ing.quantity * wpqg) : 0;
    const newPrice = Math.round(pricePerGram * minQuantity * wpqg * 100) / 100;

    changes.push({
      name: ing.name,
      fromQuantity: ing.quantity,
      toQuantity: minQuantity,
      unit: ing.unit,
      usageGrams,
    });

    return { ...ing, quantity: minQuantity, price: newPrice };
  });

  return { ingredients, changes };
}
