// Hook for fetching and mutating the meal plans list via the API
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import type { PlanWithCost } from '../utils/types';

let _cache: PlanWithCost[] | null = null;
let _fetching = false;

interface PlanItemInput {
  mealId: number;
  dayOfWeek: number;
  servings: number;
}

interface CreatePlanBody {
  name: string;
  startDate: string;
  endDate: string;
  items: PlanItemInput[];
}

interface UpdatePlanBody {
  name?: string;
  startDate?: string;
  endDate?: string;
  items?: PlanItemInput[];
}

interface UsePlans {
  items: PlanWithCost[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
  create: (body: CreatePlanBody) => Promise<void>;
  update: (id: number, body: UpdatePlanBody) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export function usePlans(): UsePlans {
  const [items, setItems] = useState<PlanWithCost[]>([]);
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
      const data = await apiGet<PlanWithCost[]>('/api/plans');
      _cache = data;
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      _fetching = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = useCallback(async (body: CreatePlanBody) => {
    setMutating(true);
    setError(null);
    try {
      const created = await apiPost<PlanWithCost>('/api/plans', body);
      _cache = null;
      setItems((current) => [...current, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const update = useCallback(async (id: number, body: UpdatePlanBody) => {
    setMutating(true);
    setError(null);
    try {
      const updated = await apiPut<PlanWithCost>(`/api/plans/${id}`, body);
      _cache = null;
      setItems((current) => current.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setMutating(true);
    setError(null);
    try {
      await apiDelete<{ id: number }>(`/api/plans/${id}`);
      _cache = null;
      setItems((current) => current.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  return { items, loading, mutating, error, create, update, remove };
}
