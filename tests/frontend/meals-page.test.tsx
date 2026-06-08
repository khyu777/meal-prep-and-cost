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
  quantity: 2,
  price: 12,
  weightPerQuantityGrams: 500,
  stockWeightGrams: 1000,
  totalWeightGrams: 1000,
  pricePerGram: 0.012,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const cheaperIngredient = {
  ...sampleIngredient,
  id: 2,
  name: 'Rice',
  price: 8,
  stockWeightGrams: 2000,
  totalWeightGrams: 2000,
  pricePerGram: 0.004,
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
      { mealId: 1, ingredientId: 2, quantity: 200, ingredient: cheaperIngredient },
      { mealId: 1, ingredientId: 1, quantity: 250, ingredient: sampleIngredient },
    ],
    cost: 3,
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
      snapshotCostPerServing: 1.5,
      meal: sampleMeals[0],
    },
  ],
  cost: 3,
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
    expect(screen.getByText('$3.00')).toBeInTheDocument();
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

  it('expands a meal to show ingredients sorted by price per 100g descending', async () => {
    render(<MealsPage />);

    await addSampleMealFromHistory();
    await userEvent.click(screen.getByRole('button', { name: /grilled chicken/i }));

    const chicken = screen.getByText('Chicken Breast');
    const rice = screen.getByText('Rice');
    expect(chicken.compareDocumentPosition(rice)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('$1.20 / 100g')).toBeInTheDocument();
    expect(screen.getByText('$0.40 / 100g')).toBeInTheDocument();
  });

  it('opens the New Meal form when the button is clicked', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    expect(screen.getByRole('heading', { name: /new meal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/servings/i)).toBeInTheDocument();
  });

  it('submits a new meal with selected ingredients and grams used', async () => {
    const createdMeal = {
      ...sampleMeals[0],
      id: 2,
      name: 'Pasta Salad',
      description: null,
      servings: 3,
      ingredients: [{ mealId: 2, ingredientId: 1, quantity: 250, ingredient: sampleIngredient }],
      cost: 3,
    };
    mockCreate.mockImplementation(async () => {
      setupMocks({ items: [...sampleMeals, createdMeal] });
      return createdMeal;
    });
    mockRefreshIngredients.mockResolvedValue(undefined);
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    await userEvent.type(screen.getByLabelText(/^name/i), 'Pasta Salad');
    await userEvent.clear(screen.getByLabelText(/servings/i));
    await userEvent.type(screen.getByLabelText(/servings/i), '3');

    // Select an ingredient from the dropdown
    expect(screen.getByText(/price \/ 100g: --/i)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    expect(screen.getByText(/price \/ 100g: \$1.20/i)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/amount/i), '250');

    await userEvent.click(screen.getByRole('button', { name: /create meal/i }));

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Pasta Salad',
      servings: 3,
      ingredients: [{ ingredientId: 1, quantity: 250 }],
    }));
    expect(mockRefreshIngredients).toHaveBeenCalledOnce();
    expect(screen.getByText('Pasta Salad')).toBeInTheDocument();
  });

  it('converts cups to grams before creating a meal', async () => {
    mockCreate.mockResolvedValue({ ...sampleMeals[0], id: 2, name: 'Soup' });
    mockRefreshIngredients.mockResolvedValue(undefined);
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    await userEvent.type(screen.getByLabelText(/^name/i), 'Soup');
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    await userEvent.type(screen.getByPlaceholderText(/amount/i), '1.5');
    await userEvent.selectOptions(screen.getByLabelText(/amount unit/i), 'cup');

    await userEvent.click(screen.getByRole('button', { name: /create meal/i }));

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Soup',
      ingredients: [{ ingredientId: 1, quantity: 354 }],
    }));
  });

  it('fills all, half, and quarter of the remaining amount in grams', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    const amountInput = screen.getByPlaceholderText(/amount/i);

    await userEvent.click(screen.getByRole('button', { name: /all/i }));
    expect(amountInput).toHaveValue(1000);

    await userEvent.click(screen.getByRole('button', { name: /1\/2/i }));
    expect(amountInput).toHaveValue(500);

    await userEvent.click(screen.getByRole('button', { name: /1\/4/i }));
    expect(amountInput).toHaveValue(250);
  });

  it('fills remaining amount fractions in cups when cups are selected', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    await userEvent.selectOptions(screen.getByLabelText(/amount unit/i), 'cup');
    const amountInput = screen.getByPlaceholderText(/amount/i);

    await userEvent.click(screen.getByRole('button', { name: /1\/2/i }));

    expect(amountInput).toHaveValue(2.113);
  });

  it('submits all remaining cups without exceeding available grams', async () => {
    mockCreate.mockResolvedValue({ ...sampleMeals[0], id: 2, name: 'All Remaining Soup' });
    mockRefreshIngredients.mockResolvedValue(undefined);
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));
    await userEvent.type(screen.getByLabelText(/^name/i), 'All Remaining Soup');
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    await userEvent.selectOptions(screen.getByLabelText(/amount unit/i), 'cup');
    await userEvent.click(screen.getByRole('button', { name: /all/i }));
    await userEvent.click(screen.getByRole('button', { name: /create meal/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const body = mockCreate.mock.calls[0][0];
    expect(body.name).toBe('All Remaining Soup');
    expect(body.ingredients[0].ingredientId).toBe(1);
    expect(body.ingredients[0].quantity).toBeLessThanOrEqual(1000);
    expect(body.ingredients[0].quantity).toBe(999);
  });

  it('hides depleted ingredients when creating a meal', async () => {
    setupMocks({}, {
      items: [{ ...sampleIngredient, stockWeightGrams: 0 }],
    });
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    expect(screen.queryByRole('option', { name: /chicken breast/i })).not.toBeInTheDocument();
  });

  it('shows floored whole grams in ingredient remaining labels', async () => {
    setupMocks({}, {
      items: [{ ...sampleIngredient, stockWeightGrams: 999.6 }],
    });
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));

    expect(screen.getByRole('option', { name: /chicken breast \(999g remaining\)/i })).toBeInTheDocument();
  });

  it('prevents submitting more grams than are available', async () => {
    render(<MealsPage />);

    await userEvent.click(screen.getByRole('button', { name: /new meal/i }));
    await userEvent.type(screen.getByLabelText(/^name/i), 'Too Much Chicken');
    await userEvent.selectOptions(screen.getByLabelText(/ingredient/i), '1');
    await userEvent.type(screen.getByPlaceholderText(/amount/i), '1001');
    await userEvent.click(screen.getByRole('button', { name: /create meal/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Chicken Breast only has 1000g available.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('opens the edit form pre-populated with existing meal data', async () => {
    render(<MealsPage />);

    await addSampleMealFromHistory();
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    // The form heading should say Edit Meal
    expect(screen.getByRole('heading', { name: /edit meal/i })).toBeInTheDocument();
    // The name field should be pre-populated
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
