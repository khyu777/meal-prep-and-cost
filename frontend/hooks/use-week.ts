// Shared week state — stores the selected week offset (0 = current week) across all tabs
import { createContext, useContext, useState } from 'react';
import { getWeekStart, getWeekEnd } from '../utils/week';

interface WeekContextValue {
  weekOffset: number;
  weekStart: Date;
  weekEnd: Date;
  prev: () => void;
  next: () => void;
  reset: () => void;
}

export const WeekContext = createContext<WeekContextValue | null>(null);

export function useWeek(): WeekContextValue {
  const ctx = useContext(WeekContext);
  if (!ctx) throw new Error('useWeek must be used inside WeekProvider');
  return ctx;
}

export function useWeekState(): WeekContextValue {
  const [weekOffset, setWeekOffset] = useState(0);
  return {
    weekOffset,
    weekStart: getWeekStart(weekOffset),
    weekEnd: getWeekEnd(weekOffset),
    prev: () => setWeekOffset((n) => n - 1),
    next: () => setWeekOffset((n) => n + 1),
    reset: () => setWeekOffset(0),
  };
}
