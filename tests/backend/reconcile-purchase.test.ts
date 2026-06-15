// Tests for the purchase-quantity reconciliation backstop

import {
  reconcilePurchaseQuantities,
  ReconcileInput,
} from '../../backend/utils/reconcile-purchase';

function input(overrides: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    ingredients: [
      { name: 'Chicken thighs', quantity: 3, unit: 'lb', price_per_unit: 1.99 },
      { name: 'Doenjang', quantity: 1, unit: 'tub', price_per_unit: 5.6 },
    ],
    meals: [
      { ingredients: [{ name: 'Chicken thighs', units: 0.375 }, { name: 'Doenjang', units: 0.06 }] },
      { ingredients: [{ name: 'Chicken thighs', units: 0.25 }] },
      { ingredients: [{ name: 'Chicken thighs', units: 0.375 }, { name: 'Doenjang', units: 0.074 }] },
    ],
    ...overrides,
  };
}

describe('reconcilePurchaseQuantities', () => {
  it('clamps an avoidable overbuy down to the minimum unit (chicken 3 → 1 lb)', () => {
    const { ingredients, changes } = reconcilePurchaseQuantities(input());
    const chicken = ingredients.find((i) => i.name === 'Chicken thighs')!;
    // 0.375+0.25+0.375 = 1.0 lb, ceil(1.0) = 1
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

  it('preserves price_per_unit unchanged when clamping quantity', () => {
    const before = input().ingredients[0];
    const { ingredients } = reconcilePurchaseQuantities(input());
    const chicken = ingredients.find((i) => i.name === 'Chicken thighs')!;
    expect(chicken.price_per_unit).toBe(before.price_per_unit);
  });

  it('does not inflate a purchase that already equals or exceeds usage', () => {
    const { ingredients, changes } = reconcilePurchaseQuantities(input({
      ingredients: [{ name: 'Chicken thighs', quantity: 1, unit: 'lb', price_per_unit: 1.99 }],
      meals: [{ ingredients: [{ name: 'Chicken thighs', units: 1 }] }],
    }));
    const chicken = ingredients.find((i) => i.name === 'Chicken thighs')!;
    expect(chicken.quantity).toBe(1);
    expect(changes).toHaveLength(0);
  });
});
