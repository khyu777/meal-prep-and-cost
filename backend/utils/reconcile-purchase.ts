// Clamps grocery purchase quantities to the whole number of units that covers actual meal usage.

export interface ReconcileIngredient {
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
}

export interface ReconcileMealIngredient {
  name: string;
  units: number;
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
  usageUnits: number;
}

export interface ReconcileResult {
  ingredients: ReconcileIngredient[];
  changes: ReconcileChange[];
}

/**
 * Recomputes each ingredient's purchase quantity as the whole number of units
 * whose total covers the summed usage across all meals:
 *   quantity = ceil(usageUnits), min 1 when used at all.
 * price_per_unit is fixed, so downstream meal-cost math is unchanged.
 * Ingredients never used are left untouched, and purchases are never inflated.
 */
export function reconcilePurchaseQuantities(input: ReconcileInput): ReconcileResult {
  const usageByName = new Map<string, number>();
  for (const meal of input.meals) {
    for (const mi of meal.ingredients) {
      const units = typeof mi.units === 'number' ? mi.units : 0;
      const key = mi.name.toLowerCase();
      usageByName.set(key, (usageByName.get(key) ?? 0) + units);
    }
  }

  const changes: ReconcileChange[] = [];

  const ingredients = input.ingredients.map((ing) => {
    // No purchase quantity set — nothing to clamp.
    if (ing.quantity == null) {
      return ing;
    }

    const usageUnits = usageByName.get(ing.name.toLowerCase()) ?? 0;

    // No usage or non-numeric usage — leave as-is.
    if (!usageUnits || !isFinite(usageUnits)) {
      return ing;
    }

    const minQuantity = Math.max(1, Math.ceil(usageUnits));
    if (minQuantity >= ing.quantity) {
      // Already at or below the minimum — never inflate a purchase.
      return ing;
    }

    changes.push({
      name: ing.name,
      fromQuantity: ing.quantity,
      toQuantity: minQuantity,
      unit: ing.unit,
      usageUnits,
    });

    return { ...ing, quantity: minQuantity };
  });

  return { ingredients, changes };
}
