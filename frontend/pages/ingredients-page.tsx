// Ingredients management page — list, add, edit, and delete ingredients
import React, { useState } from 'react';
import { useIngredients } from '../hooks/use-ingredients';
import { useMeals } from '../hooks/use-meals';
import { usePlans } from '../hooks/use-plans';
import { useWeek } from '../hooks/use-week';
import { planOverlapsWeek } from '../utils/week';
import { formatCurrency } from '../utils/format-currency';
import { formatUnits } from '../utils/format-units';
import LoadingSpinner from '../components/loading-spinner';
import ErrorMessage from '../components/error-message';
import ConfirmDialog from '../components/confirm-dialog';
import styles from './ingredients-page.module.css';

interface EditState {
  id: number;
  name: string;
  unit: string;
  pricePerUnit: string;
  stockUnits: string;
  receiptTotal: string;
}

interface AddState {
  name: string;
  unit: string;
  pricePerUnit: string;
  stockUnits: string;
  receiptTotal: string;
}

const EMPTY_ADD: AddState = {
  name: '',
  unit: '',
  pricePerUnit: '',
  stockUnits: '',
  receiptTotal: '',
};

function computePriceFromReceipt(total: string, stockUnits: string): string {
  const t = parseFloat(total);
  const u = parseFloat(stockUnits);
  if (!isNaN(t) && !isNaN(u) && u > 0) return (t / u).toFixed(4);
  return '';
}

function dateFallsInWeek(dateValue: string, weekStart: Date, weekEnd: Date) {
  const date = new Date(dateValue);
  return date >= weekStart && date <= weekEnd;
}

export default function IngredientsPage() {
  const { items, loading, error, create, update, remove } = useIngredients();
  const { items: meals, loading: mealsLoading } = useMeals();
  const { items: allPlans, loading: plansLoading } = usePlans();
  const { weekStart, weekEnd } = useWeek();

  const weekMealIds = new Set(
    allPlans
      .filter((p) => planOverlapsWeek(p.startDate, p.endDate, weekStart, weekEnd))
      .flatMap((p) => p.items.map((item) => item.mealId))
  );
  const weekIngredientIds = new Set(
    meals.filter((m) => weekMealIds.has(m.id)).flatMap((m) => m.ingredients.map((i) => i.ingredientId))
  );
  const displayedItems = items.filter(
    (i) => weekIngredientIds.has(i.id) || dateFallsInWeek(i.createdAt, weekStart, weekEnd)
  );

  const [addForm, setAddForm] = useState<AddState>(EMPTY_ADD);
  const [addError, setAddError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  function mealsUsingIngredient(id: number): string[] {
    return meals
      .filter((meal) => meal.ingredients.some((mi) => mi.ingredientId === id))
      .map((meal) => meal.name);
  }

  function deleteMessage(id: number): string {
    const usedBy = mealsUsingIngredient(id);
    if (usedBy.length === 0) return 'Are you sure you want to delete this ingredient?';
    return `This ingredient is used by ${usedBy.length} meal${usedBy.length === 1 ? '' : 's'} (${usedBy.join(', ')}). Deleting it removes it from those meals and changes their costs. Delete anyway?`;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const pricePerUnit = parseFloat(addForm.pricePerUnit);
    const stockUnits = addForm.stockUnits ? parseFloat(addForm.stockUnits) : 0;
    if (
      !addForm.name.trim() ||
      !addForm.unit.trim() ||
      isNaN(pricePerUnit) ||
      pricePerUnit < 0 ||
      isNaN(stockUnits) ||
      stockUnits < 0
    ) {
      setAddError('Name, unit, and a non-negative price per unit are required.');
      return;
    }
    try {
      await create({ name: addForm.name.trim(), unit: addForm.unit.trim(), pricePerUnit, stockUnits });
      setAddForm(EMPTY_ADD);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add ingredient');
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    setEditError(null);
    const pricePerUnit = parseFloat(editState.pricePerUnit);
    const stockUnits = parseFloat(editState.stockUnits);
    if (
      !editState.name.trim() ||
      !editState.unit.trim() ||
      isNaN(pricePerUnit) ||
      pricePerUnit < 0 ||
      isNaN(stockUnits) ||
      stockUnits < 0
    ) {
      setEditError('Name, unit, and a non-negative price per unit are required.');
      return;
    }
    try {
      await update(editState.id, {
        name: editState.name.trim(),
        unit: editState.unit.trim(),
        pricePerUnit,
        stockUnits,
      });
      setEditState(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update ingredient');
    }
  }

  async function handleDelete(id: number) {
    try {
      await remove(id);
    } catch (err) {
      // error surfaces through hook's error state
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleDeleteAll() {
    setDeleteAllConfirm(false);
    setBulkError(null);
    // Delete serially to avoid SQLite write contention; keep going past failures
    let failed = 0;
    for (const ingredient of displayedItems) {
      try {
        await remove(ingredient.id);
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      setBulkError(`Failed to delete ${failed} of ${displayedItems.length} ingredients.`);
    }
  }

  if (loading || mealsLoading || plansLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Ingredients</h1>
        {displayedItems.length > 0 && (
          <button className={styles.deleteAllBtn} onClick={() => setDeleteAllConfirm(true)}>
            Delete All
          </button>
        )}
      </div>
      {error && <ErrorMessage message={error} />}
      {bulkError && <ErrorMessage message={bulkError} />}

      <section className={styles.addSection}>
        <h2 className={styles.sectionTitle}>Add Ingredient</h2>
        {addError && <ErrorMessage message={addError} />}
        <form className={styles.addForm} onSubmit={handleAdd}>
          <input
            className={styles.input}
            type="text"
            placeholder="Name"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          />
          <input
            className={styles.input}
            type="text"
            placeholder="Unit (e.g. egg, can, lb, cup)"
            value={addForm.unit}
            onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
          />
          <input
            className={styles.input}
            type="number"
            step="0.01"
            min="0"
            placeholder="Receipt total ($)"
            value={addForm.receiptTotal}
            onChange={(e) => {
              const receiptTotal = e.target.value;
              const computed = computePriceFromReceipt(receiptTotal, addForm.stockUnits);
              setAddForm({ ...addForm, receiptTotal, pricePerUnit: computed || addForm.pricePerUnit });
            }}
          />
          <input
            className={styles.input}
            type="number"
            step="any"
            min="0"
            placeholder="Quantity in stock"
            value={addForm.stockUnits}
            onChange={(e) => {
              const stockUnits = e.target.value;
              const computed = computePriceFromReceipt(addForm.receiptTotal, stockUnits);
              setAddForm({ ...addForm, stockUnits, pricePerUnit: computed || addForm.pricePerUnit });
            }}
          />
          <input
            className={styles.input}
            type="number"
            step="any"
            min="0"
            placeholder="Price per unit (auto-filled from receipt)"
            value={addForm.pricePerUnit}
            onChange={(e) => setAddForm({ ...addForm, pricePerUnit: e.target.value })}

          />
          <button className={styles.addBtn} type="submit">Add</button>
        </form>
      </section>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Unit</th>
            <th>Remaining</th>
            <th>Price / Unit</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedItems.length === 0 && (
            <tr>
              <td colSpan={5} className={styles.empty}>No ingredients needed this week.</td>
            </tr>
          )}
          {displayedItems.map((ingredient) =>
            editState?.id === ingredient.id ? (
              <tr key={ingredient.id}>
                <td colSpan={5}>
                  {editError && <ErrorMessage message={editError} />}
                  <form className={styles.editForm} onSubmit={handleEditSave}>
                    <input
                      className={styles.input}
                      type="text"
                      value={editState.name}
                      onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Unit"
                      value={editState.unit}
                      onChange={(e) => setEditState({ ...editState, unit: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Receipt total ($)"
                      value={editState.receiptTotal}
                      onChange={(e) => {
                        const receiptTotal = e.target.value;
                        const computed = computePriceFromReceipt(receiptTotal, editState.stockUnits);
                        setEditState({ ...editState, receiptTotal, pricePerUnit: computed || editState.pricePerUnit });
                      }}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Quantity in stock"
                      value={editState.stockUnits}
                      onChange={(e) => {
                        const stockUnits = e.target.value;
                        const computed = computePriceFromReceipt(editState.receiptTotal, stockUnits);
                        setEditState({ ...editState, stockUnits, pricePerUnit: computed || editState.pricePerUnit });
                      }}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Price per unit (auto-filled from receipt)"
                      value={editState.pricePerUnit}
                      onChange={(e) => setEditState({ ...editState, pricePerUnit: e.target.value })}
                    />
                    <button className={styles.saveBtn} type="submit">Save</button>
                    <button
                      className={styles.cancelBtn}
                      type="button"
                      onClick={() => setEditState(null)}
                    >
                      Cancel
                    </button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={ingredient.id}>
                <td>{ingredient.name}</td>
                <td>{ingredient.unit}</td>
                <td>{formatUnits(ingredient.stockUnits, ingredient.unit)}</td>
                <td>{formatCurrency(ingredient.pricePerUnit)}</td>
                <td>
                  <button
                    className={styles.editBtn}
                    onClick={() =>
                      setEditState({
                        id: ingredient.id,
                        name: ingredient.name,
                        unit: ingredient.unit,
                        pricePerUnit: String(ingredient.pricePerUnit),
                        stockUnits: String(ingredient.stockUnits),
                        receiptTotal: '',
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setDeleteTarget(ingredient.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>

      {deleteTarget && (
        <ConfirmDialog
          message={deleteMessage(deleteTarget)}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleteAllConfirm && (
        <ConfirmDialog
          message={`Delete all ${displayedItems.length} ingredients for this week? This cannot be undone.`}
          onConfirm={handleDeleteAll}
          onCancel={() => setDeleteAllConfirm(false)}
        />
      )}
    </div>
  );
}
