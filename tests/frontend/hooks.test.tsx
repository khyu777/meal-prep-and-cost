// Hook tests for numeric-id local updates after API mutations
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useIngredients } from '../../frontend/hooks/use-ingredients';
import { useMeals } from '../../frontend/hooks/use-meals';
import { usePlans } from '../../frontend/hooks/use-plans';
import { apiGet, apiPut, apiDelete } from '../../frontend/utils/api';

vi.mock('../../frontend/utils/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const sampleIngredient = {
  id: 1,
  name: 'Chicken Breast',
  quantity: 2,
  price: 12,
  weightPerQuantityGrams: 500,
  stockWeightGrams: 1000,
  totalWeightGrams: 1000,
  pricePerGram: 0.012,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const sampleMeal = {
  id: 1,
  name: 'Grilled Chicken',
  description: null,
  servings: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
  ingredients: [{ mealId: 1, ingredientId: 1, quantity: 250, ingredient: sampleIngredient }],
  cost: 3,
};

const samplePlan = {
  id: 1,
  name: 'Week 1',
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-07T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  items: [{ planId: 1, mealId: 1, dayOfWeek: 1, servings: 2, meal: sampleMeal }],
  cost: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('data hooks', () => {
  it('updates and removes ingredients by numeric id', async () => {
    const updated = { ...sampleIngredient, id: 2, name: 'Rice' };
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([sampleIngredient, updated]);
    (apiPut as ReturnType<typeof vi.fn>).mockResolvedValue({ ...updated, name: 'Brown Rice' });
    (apiDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useIngredients());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.update(2, { name: 'Brown Rice' }));
    expect(result.current.items.map((item) => item.name)).toEqual(['Chicken Breast', 'Brown Rice']);

    await act(async () => result.current.remove(1));
    expect(result.current.items.map((item) => item.id)).toEqual([2]);
  });

  it('updates and removes meals by numeric id', async () => {
    const mealTwo = { ...sampleMeal, id: 2, name: 'Rice Bowl' };
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([sampleMeal, mealTwo]);
    (apiPut as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mealTwo, name: 'Bean Bowl' });
    (apiDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useMeals());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.update(2, { name: 'Bean Bowl' }));
    expect(result.current.items.map((item) => item.name)).toEqual(['Grilled Chicken', 'Bean Bowl']);

    await act(async () => result.current.remove(1));
    expect(result.current.items.map((item) => item.id)).toEqual([2]);
  });

  it('updates and removes plans by numeric id', async () => {
    const planTwo = { ...samplePlan, id: 2, name: 'Week 2' };
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([samplePlan, planTwo]);
    (apiPut as ReturnType<typeof vi.fn>).mockResolvedValue({ ...planTwo, name: 'Updated Week' });
    (apiDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => usePlans());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.update(2, { name: 'Updated Week' }));
    expect(result.current.items.map((item) => item.name)).toEqual(['Week 1', 'Updated Week']);

    await act(async () => result.current.remove(1));
    expect(result.current.items.map((item) => item.id)).toEqual([2]);
  });
});
