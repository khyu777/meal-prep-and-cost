// Meals management page — list meals with costs, create, edit, and delete meals
import React, { useState, useRef } from 'react';
import { useMeals } from '../hooks/use-meals';
import { useIngredients } from '../hooks/use-ingredients';
import { usePlans } from '../hooks/use-plans';
import { useWeek } from '../hooks/use-week';
import { planOverlapsWeek } from '../utils/week';
import { formatCurrency } from '../utils/format-currency';
import { formatUnits } from '../utils/format-units';
import LoadingSpinner from '../components/loading-spinner';
import ErrorMessage from '../components/error-message';
import ConfirmDialog from '../components/confirm-dialog';
import type { MealWithCost } from '../utils/types';
import styles from './meals-page.module.css';

interface IngredientRow {
  _key: number;
  ingredientId: string;
  quantity: string;
}

interface MealFormState {
  name: string;
  description: string;
  servings: string;
  ingredients: IngredientRow[];
}

const EMPTY_FORM: MealFormState = {
  name: '',
  description: '',
  servings: '1',
  ingredients: [{ _key: 0, ingredientId: '', quantity: '' }],
};

function emptyFormFromMeal(meal: MealWithCost): MealFormState {
  return {
    name: meal.name,
    description: meal.description ?? '',
    servings: String(meal.servings),
    ingredients: meal.ingredients.map((mi, i) => ({
      _key: i,
      ingredientId: String(mi.ingredientId),
      quantity: String(mi.quantity),
    })),
  };
}

function formatQuickFillAmount(value: number): string {
  return String(Math.floor(value * 100) / 100);
}

function pricePerUnit(ingredient: MealWithCost['ingredients'][number]['ingredient']): number | null {
  const direct = Number(ingredient.pricePerUnit);
  return Number.isFinite(direct) ? direct : null;
}

export default function MealsPage() {
  const { items: meals, loading: mealsLoading, mutating: mealsMutating, error: mealsError, create, update, remove, autoPortion } = useMeals();
  const { items: ingredients, loading: ingredientsLoading, refresh: refreshIngredients } = useIngredients();
  const { items: plans, loading: plansLoading } = usePlans();
  const { weekStart, weekEnd } = useWeek();
  const nextKeyRef = useRef(1);

  const [showForm, setShowForm] = useState(false);
  const [showExistingPicker, setShowExistingPicker] = useState(false);
  const [selectedMealIds, setSelectedMealIds] = useState<number[]>([]);
  const [existingMealId, setExistingMealId] = useState('');
  const [formState, setFormState] = useState<MealFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [expandedMealIds, setExpandedMealIds] = useState<number[]>([]);

  if (mealsLoading || ingredientsLoading || plansLoading) return <LoadingSpinner />;

  const assignedMealIds = new Set(
    plans
      .filter((plan) => planOverlapsWeek(plan.startDate, plan.endDate, weekStart, weekEnd))
      .flatMap((plan) => plan.items.map((item) => item.mealId))
  );
  const visibleMealIds = Array.from(new Set([...assignedMealIds, ...selectedMealIds]));
  const visibleMeals = visibleMealIds
    .map((id) => meals.find((meal) => meal.id === id))
    .filter((meal): meal is MealWithCost => Boolean(meal))
    .sort((a, b) => b.cost / b.servings - a.cost / a.servings);
  const availableExistingMeals = meals.filter((meal) => !visibleMealIds.includes(meal.id));

  function selectableIngredients(currentIngredientId: string, usedIds: Set<string>) {
    return ingredients.filter(
      (ing) =>
        !usedIds.has(String(ing.id)) &&
        (ing.stockUnits > 0 || String(ing.id) === currentIngredientId)
    );
  }

  function existingMealUnits(ingredientId: number): number {
    if (!editingId) return 0;
    const meal = meals.find((m) => m.id === editingId);
    const existing = meal?.ingredients.find((mi) => mi.ingredientId === ingredientId);
    return existing ? Number(existing.quantity) : 0;
  }

  function availableUnitsForMeal(ingredientId: number): number {
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    return (ingredient?.stockUnits ?? 0) + existingMealUnits(ingredientId);
  }

  function openCreate() {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
    setShowExistingPicker(false);
  }

  function openEdit(meal: MealWithCost) {
    setEditingId(meal.id);
    setFormState(emptyFormFromMeal(meal));
    setFormError(null);
    setShowForm(true);
    setShowExistingPicker(false);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  function addExistingMeal() {
    const mealId = Number(existingMealId);
    if (!mealId || selectedMealIds.includes(mealId)) return;
    setSelectedMealIds((current) => [...current, mealId]);
    setExistingMealId('');
  }

  function removeSelectedMeal(mealId: number) {
    setSelectedMealIds((current) => current.filter((id) => id !== mealId));
  }

  function toggleExpandedMeal(mealId: number) {
    setExpandedMealIds((current) =>
      current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId]
    );
  }

  function sortedMealIngredients(meal: MealWithCost) {
    return [...meal.ingredients].sort(
      (a, b) => (pricePerUnit(b.ingredient) ?? -1) - (pricePerUnit(a.ingredient) ?? -1)
    );
  }

  function updateIngredientRow(index: number, field: keyof IngredientRow, value: string) {
    setFormState((prev) => {
      const rows = [...prev.ingredients];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, ingredients: rows };
    });
  }

  function fillRemainingAmount(index: number, fraction: number) {
    const row = formState.ingredients[index];
    const ingredientId = Number(row.ingredientId);
    if (!ingredientId) return;
    const amount = availableUnitsForMeal(ingredientId) * fraction;
    updateIngredientRow(index, 'quantity', formatQuickFillAmount(amount));
  }

  function addIngredientRow() {
      const key = nextKeyRef.current++;
      setFormState((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { _key: key, ingredientId: '', quantity: '' }],
    }));
  }

  function removeIngredientRow(index: number) {
    setFormState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const servings = parseInt(formState.servings, 10);
    if (!formState.name.trim() || isNaN(servings) || servings < 1) {
      setFormError('Name and a valid servings count are required.');
      return;
    }

    const validIngredients = formState.ingredients.filter(
      (row) => row.ingredientId && row.quantity
    );
    const parsedIngredients = validIngredients.map((row) => ({
      ingredientId: Number(row.ingredientId),
      quantity: parseFloat(row.quantity),
    }));

    if (parsedIngredients.some((r) => isNaN(r.quantity) || r.quantity < 0)) {
      setFormError('All ingredient amounts must be non-negative numbers.');
      return;
    }

    const ids = parsedIngredients.map((r) => r.ingredientId);
    if (new Set(ids).size !== ids.length) {
      setFormError('Each ingredient can only be added once.');
      return;
    }

    const overdrawn = parsedIngredients.find(
      (row) => row.quantity > availableUnitsForMeal(row.ingredientId)
    );
    if (overdrawn) {
      const ingredient = ingredients.find((ing) => ing.id === overdrawn.ingredientId);
      setFormError(
        `${ingredient?.name ?? 'Ingredient'} only has ${formatUnits(availableUnitsForMeal(overdrawn.ingredientId), ingredient?.unit ?? 'unit')} available.`
      );
      return;
    }

    try {
      const body = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        servings,
        ingredients: parsedIngredients,
      };
      if (editingId) {
        await update(editingId, body);
      } else {
        const created = await create(body);
        setSelectedMealIds((current) => [...current, created.id]);
      }
      await refreshIngredients();
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save meal');
    }
  }

  async function handleDelete(id: number) {
    try {
      await remove(id);
      removeSelectedMeal(id);
      setExpandedMealIds((current) => current.filter((mealId) => mealId !== id));
      await refreshIngredients();
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleDeleteAll() {
    setDeleteAllConfirm(false);
    setBulkError(null);
    // Delete serially to avoid SQLite write contention; keep going past failures
    let failed = 0;
    for (const meal of visibleMeals) {
      try {
        await remove(meal.id);
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      setBulkError(`Failed to delete ${failed} of ${visibleMeals.length} meals.`);
    }
    setExpandedMealIds([]);
    await refreshIngredients();
  }

  async function handleAutoPortion() {
    if (visibleMealIds.length === 0) return;
    try {
      await autoPortion(visibleMealIds);
      await refreshIngredients();
    } catch {
      // error surfaced via mealsError from hook
    }
  }

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Meals</h1>
        <div className={styles.headerActions}>
          {visibleMeals.length > 0 && (
            <button className={styles.deleteAllBtn} onClick={() => setDeleteAllConfirm(true)}>
              Delete All
            </button>
          )}
          <button
            className={styles.secondaryBtn}
            onClick={() => {
              setShowExistingPicker((current) => !current);
              setShowForm(false);
              setEditingId(null);
              setFormError(null);
            }}
          >
            Add Existing Meal
          </button>
          {visibleMeals.length > 0 && (
            <button
              className={styles.secondaryBtn}
              onClick={handleAutoPortion}
              disabled={mealsMutating}
              title="Distribute each ingredient's full purchased stock across these meals, proportional to planned amounts"
            >
              Auto-portion from stock
            </button>
          )}
          <button className={styles.newBtn} onClick={openCreate}>+ New Meal</button>
        </div>
      </div>

      {mealsError && <ErrorMessage message={mealsError} />}
      {bulkError && <ErrorMessage message={bulkError} />}

      {showExistingPicker && (
        <section className={styles.existingSection}>
          <h2 className={styles.sectionTitle}>Add Existing Meal</h2>
          <div className={styles.existingControls}>
            <select
              className={styles.select}
              aria-label="Existing meal"
              value={existingMealId}
              onChange={(e) => setExistingMealId(e.target.value)}
            >
              <option value="">-- Select meal from history --</option>
              {availableExistingMeals.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.addExistingBtn}
              disabled={!existingMealId}
              onClick={addExistingMeal}
            >
              Add
            </button>
          </div>
          {availableExistingMeals.length === 0 && (
            <p className={styles.emptyInline}>No more meals in history.</p>
          )}
        </section>
      )}

      {showForm && (
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>{editingId ? 'Edit Meal' : 'New Meal'}</h2>
          {formError && <ErrorMessage message={formError} />}
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.formColumns}>
              <div className={styles.formLeft}>
                <label className={styles.label}>
                  Name
                  <input
                    className={styles.input}
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  />
                </label>
                <label className={styles.label}>
                  Description (optional)
                  <input
                    className={styles.input}
                    type="text"
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  />
                </label>
                <label className={styles.label}>
                  Servings
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={formState.servings}
                    onChange={(e) => setFormState({ ...formState, servings: e.target.value })}
                  />
                </label>
              </div>

              <div className={styles.formRight}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Ingredients Used</legend>
              {formState.ingredients.map((row) => {
                const usedIds = new Set(
                  formState.ingredients
                    .filter((r) => r._key !== row._key && r.ingredientId)
                    .map((r) => r.ingredientId)
                );
                const selectedId = Number(row.ingredientId);
                const maxAmount = row.ingredientId ? availableUnitsForMeal(selectedId) : undefined;
                const selectedIngredient = ingredients.find((ing) => ing.id === selectedId);
                return (
                <div key={row._key} className={styles.ingredientRow}>
                  <select
                    className={styles.select}
                    aria-label="Ingredient"
                    value={row.ingredientId}
                    onChange={(e) => {
                      const idx = formState.ingredients.indexOf(row);
                      updateIngredientRow(idx, 'ingredientId', e.target.value);
                    }}
                  >
                    <option value="">-- Select ingredient --</option>
                    {selectableIngredients(row.ingredientId, usedIds)
                      .map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({formatUnits(ing.stockUnits, ing.unit)} remaining)
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.qtyInput}
                    type="number"
                    step="any"
                    min="0"
                    max={maxAmount}
                    placeholder="Amount"
                    value={row.quantity}
                    onChange={(e) => {
                      const idx = formState.ingredients.indexOf(row);
                      updateIngredientRow(idx, 'quantity', e.target.value);
                    }}
                  />
                  <span className={styles.unitLabel}>{selectedIngredient?.unit ?? ''}</span>
                  <span className={styles.pricePreview}>
                    {selectedIngredient ? `${formatCurrency(selectedIngredient.pricePerUnit)} / ${selectedIngredient.unit}` : '--'}
                  </span>
                  <div className={styles.quickFillGroup} aria-label="Use remaining amount">
                    <button
                      type="button"
                      className={styles.quickFillBtn}
                      disabled={!row.ingredientId}
                      onClick={() => fillRemainingAmount(formState.ingredients.indexOf(row), 0.25)}
                    >
                      1/4
                    </button>
                    <button
                      type="button"
                      className={styles.quickFillBtn}
                      disabled={!row.ingredientId}
                      onClick={() => fillRemainingAmount(formState.ingredients.indexOf(row), 0.5)}
                    >
                      1/2
                    </button>
                    <button
                      type="button"
                      className={styles.quickFillBtn}
                      disabled={!row.ingredientId}
                      onClick={() => fillRemainingAmount(formState.ingredients.indexOf(row), 1)}
                    >
                      All
                    </button>
                  </div>
                  {formState.ingredients.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeRowBtn}
                      onClick={() => removeIngredientRow(formState.ingredients.indexOf(row))}
                    >
                      x
                    </button>
                  )}
                </div>
                );
              })}
              <button type="button" className={styles.addRowBtn} onClick={addIngredientRow}>
                + Add ingredient
              </button>
            </fieldset>
              </div>
            </div>

            <div className={styles.formActions}>
              <button className={styles.saveBtn} type="submit">
                {editingId ? 'Save Changes' : 'Create Meal'}
              </button>
              <button className={styles.cancelBtn} type="button" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Servings</th>
            <th>Cost</th>
            <th>Cost/Serving</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleMeals.length === 0 && (
            <tr>
              <td colSpan={5} className={styles.empty}>No meals selected. Add an existing meal from history when you need it.</td>
            </tr>
          )}
          {visibleMeals.map((meal) => {
            const expanded = expandedMealIds.includes(meal.id);
            const sortedIngredients = sortedMealIngredients(meal);
            return (
              <React.Fragment key={meal.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className={styles.mealToggle}
                      aria-expanded={expanded}
                      onClick={() => toggleExpandedMeal(meal.id)}
                    >
                      <span className={styles.chevron}>{expanded ? 'v' : '>'}</span>
                      <span>
                        <span className={styles.mealName}>{meal.name}</span>
                        {meal.description && (
                          <span className={styles.mealDesc}>{meal.description}</span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td>{meal.servings}</td>
                  <td className={styles.cost}>{formatCurrency(meal.cost)}</td>
                  <td className={styles.cost}>{formatCurrency(meal.cost / meal.servings)}</td>
                  <td>
                    <button className={styles.editBtn} onClick={() => openEdit(meal)}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => setDeleteTarget(meal.id)}>Delete</button>
                  </td>
                </tr>
                {expanded && (
                  <tr className={styles.detailRow}>
                    <td colSpan={5}>
                      {sortedIngredients.length === 0 ? (
                        <p className={styles.emptyInline}>No ingredients added.</p>
                      ) : (
                        <div className={styles.ingredientDetailList}>
                          {sortedIngredients.map((item) => {
                            const price = pricePerUnit(item.ingredient);
                            return (
                              <div key={item.ingredientId} className={styles.ingredientDetailItem}>
                                <span className={styles.ingredientDetailName}>{item.ingredient.name}</span>
                                <span className={styles.ingredientDetailMeta}>
                                  {formatUnits(Number(item.quantity), item.ingredient.unit)} used
                                </span>
                                <span className={styles.ingredientDetailMeta}>
                                  {price === null ? '--' : `${formatCurrency(price)} / ${item.ingredient.unit}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {deleteTarget && (
        <ConfirmDialog
          message="Are you sure you want to delete this meal?"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleteAllConfirm && (
        <ConfirmDialog
          message={`Delete all ${visibleMeals.length} meals for this week? This cannot be undone.`}
          onConfirm={handleDeleteAll}
          onCancel={() => setDeleteAllConfirm(false)}
        />
      )}
    </div>
  );
}
