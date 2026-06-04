// Tests for IngredientsPage — renders with mocked useIngredients hook
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import IngredientsPage from '../../frontend/pages/ingredients-page';

// Mock the hook and utility modules
vi.mock('../../frontend/hooks/use-ingredients');
vi.mock('../../frontend/hooks/use-meals');
vi.mock('../../frontend/hooks/use-plans');
vi.mock('../../frontend/hooks/use-week');
vi.mock('../../frontend/utils/format-currency', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

import { useIngredients } from '../../frontend/hooks/use-ingredients';
import { useMeals } from '../../frontend/hooks/use-meals';
import { usePlans } from '../../frontend/hooks/use-plans';
import { useWeek } from '../../frontend/hooks/use-week';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

const sampleItems = [
  {
    id: 1,
    name: 'Chicken Breast',
    quantity: 2,
    price: 12,
    weightPerQuantityGrams: 500,
    stockWeightGrams: 1000,
    totalWeightGrams: 1000,
    pricePerGram: 0.012,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Rice',
    quantity: 1,
    price: 8,
    weightPerQuantityGrams: 2000,
    stockWeightGrams: 2000,
    totalWeightGrams: 2000,
    pricePerGram: 0.004,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Broccoli',
    quantity: 1,
    price: 4,
    weightPerQuantityGrams: 453.59237,
    stockWeightGrams: 453.59237,
    totalWeightGrams: 453.59237,
    pricePerGram: 0.0088,
    createdAt: '2026-06-03T12:00:00.000Z',
  },
];

const sampleMeals = [
  {
    id: 1,
    name: 'Grilled Chicken',
    description: 'Healthy meal',
    servings: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    ingredients: [
      { mealId: 1, ingredientId: 1, quantity: 250, ingredient: sampleItems[0] },
      { mealId: 1, ingredientId: 2, quantity: 200, ingredient: sampleItems[1] },
    ],
    cost: 3,
  },
];

const samplePlans = [
  {
    id: 1,
    name: 'Weekly Plan',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    createdAt: '2026-06-01T00:00:00.000Z',
    items: [
      {
        planId: 1,
        mealId: 1,
        dayOfWeek: 1,
        servings: 2,
        snapshotCostPerServing: 1.5,
        meal: sampleMeals[0],
      },
    ],
    cost: 3,
  },
];

function setupMock(overrides = {}) {
  (useIngredients as ReturnType<typeof vi.fn>).mockReturnValue({
    items: sampleItems,
    loading: false,
    error: null,
    create: mockCreate,
    update: mockUpdate,
    remove: mockRemove,
    ...overrides,
  });
  (useMeals as ReturnType<typeof vi.fn>).mockReturnValue({
    items: sampleMeals,
    loading: false,
  });
  (usePlans as ReturnType<typeof vi.fn>).mockReturnValue({
    items: samplePlans,
    loading: false,
  });
  (useWeek as ReturnType<typeof vi.fn>).mockReturnValue({
    weekStart: new Date('2026-06-01T00:00:00.000Z'),
    weekEnd: new Date('2026-06-07T23:59:59.999Z'),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMock();
});

describe('IngredientsPage', () => {
  it('renders the ingredients table with fetched data', () => {
    render(<IngredientsPage />);

    expect(screen.getByRole('heading', { name: /ingredients/i })).toBeInTheDocument();
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(screen.getByText('Broccoli')).toBeInTheDocument();
    expect(screen.getByText('Price / 100g')).toBeInTheDocument();
    expect(screen.getAllByText('1000g')).toHaveLength(2);
    expect(screen.getAllByText('2000g')).toHaveLength(2);
    expect(screen.getAllByText('453g')).toHaveLength(2);
    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.getByText('$1.20')).toBeInTheDocument();
    expect(screen.getByText('$0.40')).toBeInTheDocument();
  });

  it('adds a new ingredient via the inline form', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    expect(screen.getByText(/price \/ 100g: --/i)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Broccoli');
    await userEvent.type(screen.getByPlaceholderText(/quantity bought/i), '3');
    await userEvent.type(screen.getByPlaceholderText(/total receipt price/i), '6.50');
    await userEvent.type(screen.getByPlaceholderText(/weight\/volume per quantity/i), '0.425');
    await userEvent.selectOptions(screen.getByLabelText(/weight unit/i), 'lb');

    expect(screen.getByText(/price \/ 100g: \$1.12/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Broccoli',
      quantity: 3,
      price: 6.5,
      weightPerQuantityGrams: 192.77675725,
    });
  });

  it('converts ounces and milliliters to grams before adding an ingredient', async () => {
    mockCreate.mockResolvedValue(undefined);
    const { rerender } = render(<IngredientsPage />);

    await userEvent.type(screen.getByPlaceholderText('Name'), 'Cheese');
    await userEvent.type(screen.getByPlaceholderText(/quantity bought/i), '1');
    await userEvent.type(screen.getByPlaceholderText(/total receipt price/i), '4');
    await userEvent.type(screen.getByPlaceholderText(/weight\/volume per quantity/i), '8');
    await userEvent.selectOptions(screen.getByLabelText(/weight unit/i), 'oz');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockCreate).toHaveBeenLastCalledWith({
      name: 'Cheese',
      quantity: 1,
      price: 4,
      weightPerQuantityGrams: 226.796185,
    });

    rerender(<IngredientsPage />);

    await userEvent.type(screen.getByPlaceholderText('Name'), 'Milk');
    await userEvent.type(screen.getByPlaceholderText(/quantity bought/i), '1');
    await userEvent.type(screen.getByPlaceholderText(/total receipt price/i), '3');
    await userEvent.type(screen.getByPlaceholderText(/weight\/volume per quantity/i), '500');
    await userEvent.selectOptions(screen.getByLabelText(/weight unit/i), 'ml');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockCreate).toHaveBeenLastCalledWith({
      name: 'Milk',
      quantity: 1,
      price: 3,
      weightPerQuantityGrams: 500,
    });
  });

  it('opens an inline edit row and saves changes', async () => {
    mockUpdate.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await userEvent.click(editButtons[0]);

    // Edit form should appear — clear name and type new value
    const nameInputs = screen.getAllByDisplayValue('Chicken Breast');
    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'Chicken Thigh');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({
      name: 'Chicken Thigh',
      quantity: 2,
      price: 12,
      weightPerQuantityGrams: 500,
    }));
  });

  it('deletes an ingredient after confirmation', async () => {
    mockRemove.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

    // ConfirmDialog should appear — click confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm|yes|ok/i });
    await userEvent.click(confirmBtn);

    expect(mockRemove).toHaveBeenCalledWith(1);
  });

  it('shows an error message when the API call fails', () => {
    setupMock({ error: 'Failed to load ingredients' });
    render(<IngredientsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load ingredients');
  });
});
