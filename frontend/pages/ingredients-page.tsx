// Ingredients management page — list, add, edit, and delete ingredients
import React, { useState } from 'react';
import { useIngredients } from '../hooks/use-ingredients';
import { useMeals } from '../hooks/use-meals';
import { usePlans } from '../hooks/use-plans';
import { useWeek } from '../hooks/use-week';
import { planOverlapsWeek } from '../utils/week';
import { formatCurrency } from '../utils/format-currency';
import { formatGrams } from '../utils/format-grams';
import LoadingSpinner from '../components/loading-spinner';
import ErrorMessage from '../components/error-message';
import ConfirmDialog from '../components/confirm-dialog';
import styles from './ingredients-page.module.css';

interface EditState {
  id: number;
  name: string;
  quantity: string;
  price: string;
  weightPerQuantityGrams: string;
  weightPerQuantityUnit: WeightUnit;
}

interface AddState {
  name: string;
  quantity: string;
  price: string;
  weightPerQuantityGrams: string;
  weightPerQuantityUnit: WeightUnit;
}

type WeightUnit = 'g' | 'lb' | 'oz' | 'ml';

const GRAMS_PER_POUND = 453.59237;
const GRAMS_PER_OUNCE = 28.349523125;
const EMPTY_ADD: AddState = {
  name: '',
  quantity: '',
  price: '',
  weightPerQuantityGrams: '',
  weightPerQuantityUnit: 'g',
};

function toGrams(value: number, unit: WeightUnit) {
  if (unit === 'lb') return value * GRAMS_PER_POUND;
  if (unit === 'oz') return value * GRAMS_PER_OUNCE;
  return value;
}

function dateFallsInWeek(dateValue: string, weekStart: Date, weekEnd: Date) {
  const date = new Date(dateValue);
  return date >= weekStart && date <= weekEnd;
}

function pricePer100gPreview(form: AddState): number | null {
  const quantity = parseFloat(form.quantity);
  const price = parseFloat(form.price);
  const weightPerQuantity = parseFloat(form.weightPerQuantityGrams);
  if (
    isNaN(quantity) ||
    quantity <= 0 ||
    isNaN(price) ||
    price <= 0 ||
    isNaN(weightPerQuantity) ||
    weightPerQuantity <= 0
  ) {
    return null;
  }
  const totalWeightGrams = quantity * toGrams(weightPerQuantity, form.weightPerQuantityUnit);
  return totalWeightGrams > 0 ? (price / totalWeightGrams) * 100 : null;
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
  const addPricePer100g = pricePer100gPreview(addForm);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const quantity = parseFloat(addForm.quantity);
    const price = parseFloat(addForm.price);
    const weightPerQuantity = parseFloat(addForm.weightPerQuantityGrams);
    const weightPerQuantityGrams = toGrams(weightPerQuantity, addForm.weightPerQuantityUnit);
    if (
      !addForm.name.trim() ||
      isNaN(quantity) ||
      quantity <= 0 ||
      isNaN(price) ||
      price <= 0 ||
      isNaN(weightPerQuantity) ||
      weightPerQuantity <= 0
    ) {
      setAddError('All fields are required. Quantity, price, and weight or volume per quantity must be positive.');
      return;
    }
    try {
      await create({ name: addForm.name.trim(), quantity, price, weightPerQuantityGrams });
      setAddForm(EMPTY_ADD);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add ingredient');
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    setEditError(null);
    const quantity = parseFloat(editState.quantity);
    const price = parseFloat(editState.price);
    const weightPerQuantity = parseFloat(editState.weightPerQuantityGrams);
    const weightPerQuantityGrams = toGrams(weightPerQuantity, editState.weightPerQuantityUnit);
    if (
      !editState.name.trim() ||
      isNaN(quantity) ||
      quantity <= 0 ||
      isNaN(price) ||
      price <= 0 ||
      isNaN(weightPerQuantity) ||
      weightPerQuantity <= 0
    ) {
      setEditError('All fields are required. Quantity, price, and weight or volume per quantity must be positive.');
      return;
    }
    try {
      await update(editState.id, {
        name: editState.name.trim(),
        quantity,
        price,
        weightPerQuantityGrams,
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
    for (const ingredient of displayedItems) {
      await remove(ingredient.id);
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
            type="number"
            step="0.01"
            min="0"
            placeholder="Quantity bought"
            value={addForm.quantity}
            onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
          />
          <input
            className={styles.input}
            type="number"
            step="0.01"
            min="0"
            placeholder="Total receipt price"
            value={addForm.price}
            onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
          />
          <input
            className={styles.input}
            type="number"
            step="any"
            min="0"
            placeholder="Weight/volume per quantity"
            value={addForm.weightPerQuantityGrams}
            onChange={(e) => setAddForm({ ...addForm, weightPerQuantityGrams: e.target.value })}
          />
          <select
            className={styles.select}
            aria-label="Weight unit"
            value={addForm.weightPerQuantityUnit}
            onChange={(e) => setAddForm({ ...addForm, weightPerQuantityUnit: e.target.value as WeightUnit })}
          >
            <option value="g">g</option>
            <option value="lb">lb</option>
            <option value="oz">oz</option>
            <option value="ml">ml</option>
          </select>
          <span className={styles.pricePreview} aria-live="polite">
            Price / 100g: {addPricePer100g === null ? '--' : formatCurrency(addPricePer100g)}
          </span>
          <button className={styles.addBtn} type="submit">Add</button>
        </form>
      </section>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Total Weight</th>
            <th>Remaining</th>
            <th>Total Price</th>
            <th>Price / 100g</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedItems.length === 0 && (
            <tr>
              <td colSpan={6} className={styles.empty}>No ingredients needed this week.</td>
            </tr>
          )}
          {displayedItems.map((ingredient) =>
            editState?.id === ingredient.id ? (
              <tr key={ingredient.id}>
                <td colSpan={6}>
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
                      type="number"
                      step="0.01"
                      min="0"
                      value={editState.quantity}
                      onChange={(e) => setEditState({ ...editState, quantity: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      step="0.01"
                      min="0"
                      value={editState.price}
                      onChange={(e) => setEditState({ ...editState, price: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Weight/volume per quantity"
                      value={editState.weightPerQuantityGrams}
                      onChange={(e) => setEditState({ ...editState, weightPerQuantityGrams: e.target.value })}
                    />
                    <select
                      className={styles.select}
                      aria-label="Weight unit"
                      value={editState.weightPerQuantityUnit}
                      onChange={(e) => setEditState({ ...editState, weightPerQuantityUnit: e.target.value as WeightUnit })}
                    >
                      <option value="g">g</option>
                      <option value="lb">lb</option>
                      <option value="oz">oz</option>
                      <option value="ml">ml</option>
                    </select>
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
                <td>{formatGrams(ingredient.totalWeightGrams)}</td>
                <td>{formatGrams(ingredient.stockWeightGrams)}</td>
                <td>{formatCurrency(ingredient.price)}</td>
                <td>{formatCurrency(ingredient.pricePerGram * 100)}</td>
                <td>
                  <button
                    className={styles.editBtn}
                    onClick={() =>
                      setEditState({
                        id: ingredient.id,
                        name: ingredient.name,
                        quantity: String(ingredient.quantity),
                        price: String(ingredient.price),
                        weightPerQuantityGrams: String(ingredient.weightPerQuantityGrams),
                        weightPerQuantityUnit: 'g',
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
          message="Are you sure you want to delete this ingredient?"
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
