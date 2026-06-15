// Tests for MealsPage — renders with mocked useMeals and useIngredients hooks
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MealsPage from '../../frontend/pages/meals-page';

vi.mock('../../frontend/hooks/use-meals');
vi.mock('../../frontend/hooks/use-ingredients');
vi.mock('../../frontend/hooks/use-plans');
vi.mock('../../frontend/hooks/use-week');
vi.mock('../../frontend/utils/format-currency', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

import { useMeals } from '../../frontend/hooks/use-meals';
import { useIngredients } from '../../frontend/hooks/use-ingredients';
import { usePlans } from '../../frontend/hooks/use-plans';
import { useWeek } from '../../frontend/hooks/use-week';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockAutoPortion = vi.fn();
const mockRefreshIngredients = vi.fn();

const sampleIngredient = {
  id: 1,
  name: 'Chicken Breast',
  unit: 'lb',
  pricePerUnit: 5,
  stockUnits: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const cheaperIngredient = {
  id: 2,
  name: 'Rice',
  unit: 'cup',
  pricePerUnit: 0.15,
  stockUnits: 4,
  createdAt: '2024-01-02T00:00:00.000Z',
};

const sampleMeals = [
  {
    id: 1,
    name: 'Grilled Chicken',
    description: 'Healthy meal',
    servings: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    ingredients: [
      { mealId: 1, ingredientId: 2, quantity: 1, targetUnits: 1, ingredient: cheaperIngredient },
      { mealId: 1, ingredientId: 1, quantity: 0.5, targetUnits: 0.5, ingredient: sampleIngredient },
    ],
    cost: 2.65,
  },
];

const samplePlan = {
  id: 1,
  name: 'Week Plan',
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: '2026-06-07T23:59:59.999Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  items: [
    {
      planId: 1,
      mealId: 1,
      dayOfWeek: 1,
      servings: 1,
      snapshotCostPerServing: 1.325,
      meal: sampleMeals[0],
    },
  ],
  cost: 2.65,
};

function setupMocks(mealOverrides = {}, ingredientOverrides = {}, planOverrides = {}) {
  (useMeals as ReturnType<typeof vi.fn>).mockReturnValue({
    items: sampleMeals,
    loading: false,
    error: null,
    create: mockCreate,
    update: mockUpdate,
    remove: mockRemove,
    autoPortion: mockAutoPortion,
    ...mealOverrides,
  });
  (useIngredients as ReturnType<typeof vi.fn>).mockReturnValue({
    items: [sampleIngredient],
    loading: false,
    error: null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: mockRefreshIngredients,
    ...ingredientOverrides,
  });
  (usePlans as ReturnType<typeof vi.fn>).mockReturnValue({
    items: [],
    loading: false,
    error: null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...planOverrides,
  });
  (useWeek as ReturnType<typeof vi.fn>).mockReturnValue({
    weekOffset: 0,
    weekStart: new Date('2026-06-01T00:00:00.000Z'),
    weekEnd: new Date('2026-06-07T23:59:59.999Z'),
    prev: vi.fn(),
    next: vi.fn(),
    reset: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('MealsPage', () => {
  async function addSampleMealFromHistory() {
    await userEvent.click(screen.getByRole('button', { name: /add existing meal/i }));
    await userEvent.selectOptions(screen.getByLabelText(/existing meal/i), '1');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
  }

  it('hides meal history by default', () => {
    render(<MealsPage />);

    expect(screen.getByRole('heading', { name: /meals/i })).toBeInTheDocument();
    expect(screen.getByText(/no meals selected/i)).toBeInTheDocument();
    expect(screen.queryByText('Grilled Chicken')).not.toBeInTheDocument();
  });

  it('adds an existing meal from history to the visible list', async () => {
    render(<MealsPage />);

    await addSampleMealFromHistory();

    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('$2.65')).toBeInTheDocument();
  });

  it('shows meals assigned to the current week by default', () => {
    setupMocks({}, {}, { items: [samplePlan] });
    render(<MealsPage />);

    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.queryByText(/no meals selected/i)).not.toBeInTheDocument();
  });

  it('auto-portions visible week meals and refreshes ingredient stock', async () => {
    mockAutoPortion.mockResolvedValue(sampleMeals);
    mockRefreshIngredients.mockResolvedValue(undefined);
    setupMocks({}, {}, { items: [samplePlan] });
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /auto-portion from stock/i }));

    expect(mockAutoPortion).toHaveBeenCalledWith([1]);
    expect(mockRefreshIngredients).toHaveBeenCalledOnce();
  });

  it('expands a meal to show ingredients sorted by price per unit descending', async () => {
    setupMocks({}, { items: [sampleIngredient, cheaperIngredient] });
    render(<MealsPage />);

    await addSampleMealFromHistory();
    await userEvent.click(screen.getByRole('button', { name: /grilled chicken/i }));

    const chicken = screen.getByText('Chicken Breast');
    const rice = screen.getByText('Rice');
    expect(chicken.compareDocumentPosition(rice)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('$5.00 / lb')).toBeInTheDocument();
    expect(screen.getByText('$0.15 / cup')).toBeInTheDocument();
  });

  it('opens the New Meal form when the button is clicked', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    expect(screen.getByRole('heading', { name: /new meal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/servings/i)).toBeInTheDocument();
  });

  it('submits a new meal with selected ingredients and units used', async () => {
    const createdMeal = {
      ...sampleMeals[0],
      id: 2,
      name: 'Chicken Bowl',
      description: null,
      servings: 3,
      ingredients: [{ mealId: 2, ingredientId: 1, quantity: 0.5, targetUnits: 0.5, ingredient: sampleIngredient }],
      cost: 2.5,
    };
    mockCreate.mockImplementation(async () => {
      setupMocks({ items: [...sampleMeals, createdMeal] });
      return createdMeal;
    });
    mockRefreshIngredients.mockResolvedValue(undefined);
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    await userEvent.type(screen.getByLabelText(/^name/i), 'Chicken Bowl');
    await userEvent.clear(screen.getByLabelText(/servings/i));
    await userEvent.type(screen.getByLabelText(/servings/i), '3');

    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    await userEvent.type(screen.getByPlaceholderText(/amount/i), '0.5');

    await userEvent.click(screen.getByRole('button', { name: /create meal/i }));

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Chicken Bowl',
      servings: 3,
      ingredients: [{ ingredientId: 1, quantity: 0.5 }],
    }));
    expect(mockRefreshIngredients).toHaveBeenCalledOnce();
    expect(screen.getByText('Chicken Bowl')).toBeInTheDocument();
  });

  it('fills all, half, and quarter of the remaining stock', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    const amountInput = screen.getByPlaceholderText(/amount/i);

    await userEvent.click(screen.getByRole('button', { name: /all/i }));
    expect(amountInput).toHaveValue(2);

    await userEvent.click(screen.getByRole('button', { name: /1\/2/i }));
    expect(amountInput).toHaveValue(1);

    await userEvent.click(screen.getByRole('button', { name: /1\/4/i }));
    expect(amountInput).toHaveValue(0.5);
  });

  it('hides depleted ingredients when creating a meal', async () => {
    setupMocks({}, {
      items: [{ ...sampleIngredient, stockUnits: 0 }],
    });
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    expect(screen.queryByRole('option', { name: /chicken breast/i })).not.toBeInTheDocument();
  });

  it('shows floored units in ingredient remaining labels', async () => {
    setupMocks({}, {
      items: [{ ...sampleIngredient, stockUnits: 1.999 }],
    });
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    expect(screen.getByRole('option', { name: /chicken breast \(1.99 lb remaining\)/i })).toBeInTheDocument();
  });

  it('prevents submitting more units than are available', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));
    await userEvent.type(screen.getByLabelText(/^name/i), 'Too Much Chicken');
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    await userEvent.type(screen.getByPlaceholderText(/amount/i), '3');
    await userEvent.click(screen.getByRole('button', { name: /create meal/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Chicken Breast only has 2 lb available.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('opens the edit form pre-populated with existing meal data', async () => {
    render(<MealsPage />);

    await addSampleMealFromHistory();
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('heading', { name: /edit meal/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grilled Chicken')).toBeInTheDocument();
  });

  it('deletes a meal after confirmation', async () => {
    mockRemove.mockResolvedValue(undefined);
    mockRefreshIngredients.mockResolvedValue(undefined);
    render(<MealsPage />);

    await addSampleMealFromHistory();
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(mockRemove).toHaveBeenCalledWith(1);
    expect(mockRefreshIngredients).toHaveBeenCalledOnce();
  });

  it('shows an error message when the API call fails', () => {
    setupMocks({ error: 'Failed to load meals' });
    render(<MealsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load meals');
  });
});
