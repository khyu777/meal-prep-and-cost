// Hook for fetching and mutating the ingredients list via the API
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import type { Ingredient } from '../utils/types';

let _cache: Ingredient[] | null = null;
let _fetching = false;

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
    if (_cache) { setItems(_cache); setLoading(false); return; }
    if (_fetching) return;
    _fetching = true;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Ingredient[]>('/api/ingredients');
      _cache = data;
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients');
    } finally {
      _fetching = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refresh = useCallback(() => fetchAll(), [fetchAll]);

  const create = useCallback(async (body: CreateIngredientBody) => {
    setMutating(true);
    setError(null);
    try {
      const created = await apiPost<Ingredient>('/api/ingredients', body);
      _cache = null;
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
      _cache = null;
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
      _cache = null;
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
