// Hook tests for numeric-id local updates after API mutations
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useIngredients } from '../../frontend/hooks/use-ingredients';
import { useMeals } from '../../frontend/hooks/use-meals';
import { usePlans } from '../../frontend/hooks/use-plans';
import { apiGet, apiPut, apiDelete } from '../../frontend/utils/api';
import { ingredientsCache, mealsCache, plansCache } from '../../frontend/utils/api-cache';

vi.mock('../../frontend/utils/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const sampleIngredient = {
  id: 1,
  name: 'Chicken Breast',
  unit: 'lb',
  pricePerUnit: 1.99,
  stockUnits: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const sampleMeal = {
  id: 1,
  name: 'Grilled Chicken',
  description: null,
  servings: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
  ingredients: [{ mealId: 1, ingredientId: 1, quantity: 0.5, targetUnits: 0.5, ingredient: sampleIngredient }],
  cost: 1,
};

const samplePlan = {
  id: 1,
  name: 'Week 1',
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-07T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  items: [{ planId: 1, mealId: 1, dayOfWeek: 1, servings: 2, meal: sampleMeal }],
  cost: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  ingredientsCache.invalidate();
  mealsCache.invalidate();
  plansCache.invalidate();
});

describe('useIngredients', () => {
  it('fetches and returns a list of ingredients', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([sampleIngredient]);

    const { result } = renderHook(() => useIngredients());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([sampleIngredient]);
    expect(result.current.error).toBeNull();
  });

  it('update optimistically replaces item in local state', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([sampleIngredient]);
    const updated = { ...sampleIngredient, pricePerUnit: 2.49 };
    (apiPut as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const { result } = renderHook(() => useIngredients());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update(1, { pricePerUnit: 2.49 });
    });

    expect(result.current.items[0].pricePerUnit).toBe(2.49);
  });

  it('remove optimistically removes item from local state', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([sampleIngredient]);
    (apiDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useIngredients());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove(1);
    });

    expect(result.current.items).toHaveLength(0);
  });
});

describe('useMeals', () => {
  it('fetches and returns a list of meals', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([sampleMeal]);

    const { result } = renderHook(() => useMeals());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([sampleMeal]);
    expect(result.current.error).toBeNull();
  });
});

describe('usePlans', () => {
  it('fetches and returns a list of plans', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([samplePlan]);

    const { result } = renderHook(() => usePlans());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([samplePlan]);
    expect(result.current.error).toBeNull();
  });
});
