// Hook for fetching and mutating the ingredients list via the API
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { ingredientsCache, invalidateIngredientData } from '../utils/api-cache';
import type { Ingredient } from '../utils/types';

interface CreateIngredientBody {
  name: string;
  quantity: number;
  price: number;
  weightPerQuantityGrams: number;
}

interface UpdateIngredientBody {
  name?: string;
  quantity?: number;
  price?: number;
  weightPerQuantityGrams?: number;
}

interface UseIngredients {
  items: Ingredient[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
  create: (body: CreateIngredientBody) => Promise<void>;
  update: (id: number, body: UpdateIngredientBody) => Promise<void>;
  remove: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useIngredients(): UseIngredients {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ingredientsCache.load(() => apiGet<Ingredient[]>('/api/ingredients'));
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refresh = useCallback(async () => { ingredientsCache.invalidate(); await fetchAll(); }, [fetchAll]);

  const create = useCallback(async (body: CreateIngredientBody) => {
    setMutating(true);
    setError(null);
    try {
      const created = await apiPost<Ingredient>('/api/ingredients', body);
      invalidateIngredientData();
      setItems((current) => [...current, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ingredient');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const update = useCallback(async (id: number, body: UpdateIngredientBody) => {
    setMutating(true);
    setError(null);
    try {
      const updated = await apiPut<Ingredient>(`/api/ingredients/${id}`, body);
      invalidateIngredientData();
      setItems((current) => current.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ingredient');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setMutating(true);
    setError(null);
    try {
      await apiDelete<{ id: number }>(`/api/ingredients/${id}`);
      invalidateIngredientData();
      setItems((current) => current.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ingredient');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  return { items, loading, mutating, error, create, update, remove, refresh };
}
