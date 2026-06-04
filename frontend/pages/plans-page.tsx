// Meal plans management page — 7-day weekly grid for creating and viewing plans
import React, { useState, useRef } from 'react';
import { usePlans } from '../hooks/use-plans';
import { useMeals } from '../hooks/use-meals';
import { useWeek } from '../hooks/use-week';
import { planOverlapsWeek } from '../utils/week';
import { formatCurrency } from '../utils/format-currency';
import LoadingSpinner from '../components/loading-spinner';
import ErrorMessage from '../components/error-message';
import type { PlanWithCost } from '../utils/types';
import styles from './plans-page.module.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface PlanItemRow {
  _key: number;
  mealId: string;
}

type WeekDays = [
  PlanItemRow[], PlanItemRow[], PlanItemRow[],
  PlanItemRow[], PlanItemRow[], PlanItemRow[], PlanItemRow[]
];

function emptyDays(): WeekDays {
  return [[], [], [], [], [], [], []];
}

function formFromPlan(plan: PlanWithCost): WeekDays {
  const days = emptyDays();
  plan.items.forEach((item, i) => {
    days[item.dayOfWeek].push({ _key: i, mealId: String(item.mealId) });
  });
  return days;
}

function autoName(weekStart: Date): string {
  return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function PlansPage() {
  const { items: allPlans, loading: plansLoading, error: plansError, create, update } = usePlans();
  const { items: meals, loading: mealsLoading } = useMeals();
  const { weekStart, weekEnd } = useWeek();
  const nextKeyRef = useRef(100);

  const plans = allPlans.filter((p) => planOverlapsWeek(p.startDate, p.endDate, weekStart, weekEnd));

  const [days, setDays] = useState<WeekDays>(emptyDays);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (plansLoading || mealsLoading) return <LoadingSpinner />;

  function openEdit(plan: PlanWithCost) {
    setEditingId(plan.id);
    setDays(formFromPlan(plan));
    setFormError(null);
  }

  function closeEdit() {
    setEditingId(null);
    setFormError(null);
  }

  function addMealToDay(dayIdx: number) {
    const key = nextKeyRef.current++;
    setDays((prev) => {
      const next = [...prev] as WeekDays;
      next[dayIdx] = [...next[dayIdx], { _key: key, mealId: '' }];
      return next;
    });
  }

  function removeMealFromDay(dayIdx: number, key: number) {
    setDays((prev) => {
      const next = [...prev] as WeekDays;
      next[dayIdx] = next[dayIdx].filter((r) => r._key !== key);
      return next;
    });
  }

  function updateDayItem(dayIdx: number, key: number, field: keyof PlanItemRow, value: string) {
    setDays((prev) => {
      const next = [...prev] as WeekDays;
      next[dayIdx] = next[dayIdx].map((r) => (r._key === key ? { ...r, [field]: value } : r));
      return next;
    });
  }

  function mealUsedCount(mealId: string): number {
    return days.flat().filter((r) => r.mealId === mealId).length;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const allItems = days.flatMap((dayRows, dayIdx) =>
      dayRows.filter((r) => r.mealId).map((r) => ({ mealId: Number(r.mealId), dayOfWeek: dayIdx, _key: r._key }))
    );

    if (allItems.length === 0) {
      setFormError('Add at least one meal to the plan.');
      return;
    }

    // Check same meal on same day (violates composite PK)
    const seen = new Set<string>();
    for (const item of allItems) {
      const key = `${item.mealId}-${item.dayOfWeek}`;
      if (seen.has(key)) {
        const meal = meals.find((m) => m.id === item.mealId);
        setFormError(`${meal?.name ?? 'A meal'} is added more than once on the same day.`);
        return;
      }
      seen.add(key);
    }

    try {
      const body = {
        name: autoName(weekStart),
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        items: allItems.map(({ mealId, dayOfWeek }) => ({ mealId, dayOfWeek, servings: 1 })),
      };
      if (editingId) {
        await update(editingId, body);
      } else {
        await create(body);
      }
      closeEdit();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save plan');
    }
  }

  const weekPlan = plans[0] ?? null;
  const showForm = !weekPlan || editingId !== null;

  async function refreshPrices(plan: PlanWithCost) {
    setRefreshing(true);
    try {
      await update(plan.id, {
        items: plan.items.map(({ mealId, dayOfWeek, servings }) => ({ mealId, dayOfWeek, servings })),
      });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Meal Plans</h1>
      </div>

      {plansError && <ErrorMessage message={plansError} />}

      {showForm && (
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>{editingId ? 'Edit Plan' : autoName(weekStart)}</h2>
          {formError && <ErrorMessage message={formError} />}
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.weekGrid}>
              {DAY_LABELS.map((label, dayIdx) => (
                <div key={dayIdx} className={styles.dayColumn}>
                  <div className={styles.dayHeader}>{label}</div>
                  {days[dayIdx].map((row) => (
                    <div key={row._key} className={styles.dayMealRow}>
                      <select
                        className={styles.daySelect}
                        value={row.mealId}
                        onChange={(e) => updateDayItem(dayIdx, row._key, 'mealId', e.target.value)}
                      >
                        <option value="">— meal —</option>
                        {meals
                          .filter((meal) => {
                            const id = String(meal.id);
                            const used = mealUsedCount(id);
                            return used < meal.servings || id === row.mealId;
                          })
                          .map((meal) => (
                            <option key={meal.id} value={meal.id}>{meal.name}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className={styles.removeRowBtn}
                        onClick={() => removeMealFromDay(dayIdx, row._key)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.addDayBtn} onClick={() => addMealToDay(dayIdx)}>
                    + Add
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.formActions}>
              <button className={styles.saveBtn} type="submit">
                {editingId ? 'Save Changes' : 'Save Plan'}
              </button>
              {editingId && (
                <button className={styles.cancelBtn} type="button" onClick={closeEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {weekPlan && editingId === null && (() => {
        const byDay: PlanWithCost['items'][] = Array.from({ length: 7 }, () => []);
        weekPlan.items.forEach((item) => byDay[item.dayOfWeek].push(item));
        const dayCosts = byDay.map((items) =>
          items.reduce((sum, item) => sum + (Number(item.snapshotCostPerServing) || 0) * item.servings, 0)
        );
        return (
          <div className={styles.planCard}>
            <div className={styles.planHeader}>
              <h2 className={styles.planName}>{weekPlan.name}</h2>
              <div className={styles.planRight}>
                <span className={styles.planCost}>{formatCurrency(weekPlan.cost)}</span>
                <div className={styles.planActions}>
                  <button className={styles.refreshBtn} onClick={() => refreshPrices(weekPlan)} disabled={refreshing}>
                    {refreshing ? 'Refreshing…' : 'Refresh Prices'}
                  </button>
                  <button className={styles.editBtn} onClick={() => openEdit(weekPlan)}>Edit</button>
                </div>
              </div>
            </div>
            <div className={styles.cardWeekGrid}>
              {DAY_LABELS.map((label, dayIdx) => (
                <div key={dayIdx} className={styles.cardDayCol}>
                  <div className={styles.cardDayHeader}>
                    <span>{label}</span>
                    <span className={styles.cardDayCost}>{formatCurrency(dayCosts[dayIdx])}</span>
                  </div>
                  {byDay[dayIdx].length === 0 ? (
                    <span className={styles.cardEmpty}>—</span>
                  ) : (
                    byDay[dayIdx].map((item) => (
                      <div key={`${item.mealId}`} className={styles.cardMealChip}>
                        <span className={styles.cardMealName}>{item.meal.name}</span>
                        <span className={styles.cardMealMeta}>
                          {formatCurrency((Number(item.snapshotCostPerServing) || 0) * item.servings)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
