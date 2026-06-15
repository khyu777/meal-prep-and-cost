// Tests for IngredientsPage — renders with mocked useIngredients hook
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import IngredientsPage from '../../frontend/pages/ingredients-page';

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
    unit: 'lb',
    pricePerUnit: 1.99,
    stockUnits: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Rice',
    unit: 'cup',
    pricePerUnit: 0.15,
    stockUnits: 4,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Broccoli',
    unit: 'bunch',
    pricePerUnit: 1.5,
    stockUnits: 1,
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
      { mealId: 1, ingredientId: 1, quantity: 0.5, targetUnits: 0.5, ingredient: sampleItems[0] },
      { mealId: 1, ingredientId: 2, quantity: 1, targetUnits: 1, ingredient: sampleItems[1] },
    ],
    cost: 1.15,
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
        snapshotCostPerServing: 0.575,
        meal: sampleMeals[0],
      },
    ],
    cost: 1.15,
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
    expect(screen.getByText('Price / Unit')).toBeInTheDocument();
    // Unit column values
    expect(screen.getByText('lb')).toBeInTheDocument();
    expect(screen.getByText('cup')).toBeInTheDocument();
    // Stock values
    expect(screen.getByText('2 lb')).toBeInTheDocument();
    expect(screen.getByText('4 cup')).toBeInTheDocument();
    // Price per unit
    expect(screen.getByText('$1.99')).toBeInTheDocument();
    expect(screen.getByText('$0.15')).toBeInTheDocument();
  });

  it('adds a new ingredient via the inline form', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    await userEvent.type(screen.getByPlaceholderText('Name'), 'Eggs');
    await userEvent.type(screen.getByPlaceholderText(/unit.*e\.g\./i), 'ea');
    await userEvent.type(screen.getByPlaceholderText(/price per unit/i), '0.30');
    await userEvent.type(screen.getByPlaceholderText(/quantity in stock/i), '12');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Eggs',
      unit: 'ea',
      pricePerUnit: 0.30,
      stockUnits: 12,
    });
  });

  it('defaults stockUnits to 0 when quantity field is left empty', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    await userEvent.type(screen.getByPlaceholderText('Name'), 'Salt');
    await userEvent.type(screen.getByPlaceholderText(/unit.*e\.g\./i), 'tsp');
    await userEvent.type(screen.getByPlaceholderText(/price per unit/i), '0.01');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Salt',
      unit: 'tsp',
      pricePerUnit: 0.01,
      stockUnits: 0,
    });
  });

  it('opens an inline edit row and saves changes', async () => {
    mockUpdate.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await userEvent.click(editButtons[0]);

    const nameInputs = screen.getAllByDisplayValue('Chicken Breast');
    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'Chicken Thigh');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({
      name: 'Chicken Thigh',
      unit: 'lb',
      pricePerUnit: 1.99,
      stockUnits: 2,
    }));
  });

  it('deletes an ingredient after confirmation', async () => {
    mockRemove.mockResolvedValue(undefined);
    render(<IngredientsPage />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

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
