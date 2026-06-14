// Tests for the purchase-quantity reconciliation backstop

import {
  reconcilePurchaseQuantities,
  ReconcileInput,
} from '../../backend/utils/reconcile-purchase';

function input(overrides: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    ingredients: [
      { name: 'Chicken thighs', quantity: 3, unit: 'lbs', weight_per_quantity_grams: 454, price: 13.17 },
      { name: 'Doenjang', quantity: 1, unit: 'tub (500g)', weight_per_quantity_grams: 500, price: 5.6 },
    ],
    meals: [
      { ingredients: [{ name: 'Chicken thighs', grams: 170 }, { name: 'Doenjang', grams: 30 }] },
      { ingredients: [{ name: 'Chicken thighs', grams: 113 }] },
      { ingredients: [{ name: 'Chicken thighs', grams: 170 }, { name: 'Doenjang', grams: 37 }] },
    ],
    ...overrides,
  };
}

describe('reconcilePurchaseQuantities', () => {
  it('clamps an avoidable overbuy down to the minimum unit (chicken 3 → 1 lb)', () => {
    const { ingredients, changes } = reconcilePurchaseQuantities(input());
    const chicken = ingredients.find((i) => i.name === 'Chicken thighs')!;
    // 170+113+170 = 453g, ceil(453/454) = 1 lb
    expect(chicken.quantity).toBe(1);
    expect(changes).toContainEqual(
      expect.objectContaining({ name: 'Chicken thighs', fromQuantity: 3, toQuantity: 1 })
    );
  });

  it('leaves a big-package item at 1 unit (doenjang stays 1 tub)', () => {
    const { ingredients, changes } = reconcilePurchaseQuantities(input());
    const doenjang = ingredients.find((i) => i.name === 'Doenjang')!;
    expect(doenjang.quantity).toBe(1);
    expect(changes.find((c) => c.name === 'Doenjang')).toBeUndefined();
  });

  it('preserves pricePerGram when clamping quantity', () => {
    const before = input().ingredients[0];
    const beforePpg = before.price / (before.quantity * before.weight_per_quantity_grams);
    const { ingredients } = reconcilePurchaseQuantities(input());
    const chicken = ingredients.find((i) => i.name === 'Chicken thighs')!;
    const afterPpg = chicken.price / (chicken.quantity * chicken.weight_per_quantity_grams);
    expect(afterPpg).toBeCloseTo(beforePpg, 5);
  });
});
