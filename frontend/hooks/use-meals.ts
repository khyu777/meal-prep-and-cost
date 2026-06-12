// Hook for fetching and mutating the meals list via the API
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { mealsCache, invalidateMealData } from '../utils/api-cache';
import type { MealWithCost } from '../utils/types';

interface MealIngredientInput {
  ingredientId: number;
  quantity: number;
}

interface CreateMealBody {
  name: string;
  description?: string;
  servings: number;
  ingredients: MealIngredientInput[];
}

interface UpdateMealBody {
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: MealIngredientInput[];
}

interface UseMeals {
  items: MealWithCost[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
  create: (body: CreateMealBody) => Promise<MealWithCost>;
  update: (id: number, body: UpdateMealBody) => Promise<void>;
  remove: (id: number) => Promise<void>;
  autoPortion: (mealIds: number[]) => Promise<MealWithCost[]>;
}

export function useMeals(): UseMeals {
  const [items, setItems] = useState<MealWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mealsCache.load(() => apiGet<MealWithCost[]>('/api/meals'));
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = useCallback(async (body: CreateMealBody) => {
    setMutating(true);
    setError(null);
    try {
      const created = await apiPost<MealWithCost>('/api/meals', body);
      invalidateMealData();
      setItems((current) => [...current, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meal');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const update = useCallback(async (id: number, body: UpdateMealBody) => {
    setMutating(true);
    setError(null);
    try {
      const updated = await apiPut<MealWithCost>(`/api/meals/${id}`, body);
      invalidateMealData();
      setItems((current) => current.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meal');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setMutating(true);
    setError(null);
    try {
      await apiDelete<{ id: number }>(`/api/meals/${id}`);
      invalidateMealData();
      setItems((current) => current.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const autoPortion = useCallback(async (mealIds: number[]) => {
    setMutating(true);
    setError(null);
    try {
      const updated = await apiPost<MealWithCost[]>('/api/meals/auto-portion', { mealIds });
      invalidateMealData();
      setItems((current) => {
        const map = new Map(updated.map((m) => [m.id, m]));
        return current.map((m) => map.get(m.id) ?? m);
      });
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-portion meals');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  return { items, loading, mutating, error, create, update, remove, autoPortion };
}
