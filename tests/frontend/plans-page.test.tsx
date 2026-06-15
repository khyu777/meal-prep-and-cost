// Tests for PlansPage — renders with mocked usePlans and useMeals hooks
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlansPage from '../../frontend/pages/plans-page';

vi.mock('../../frontend/hooks/use-plans');
vi.mock('../../frontend/hooks/use-meals');
vi.mock('../../frontend/hooks/use-week');
vi.mock('../../frontend/utils/format-currency', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

import { usePlans } from '../../frontend/hooks/use-plans';
import { useMeals } from '../../frontend/hooks/use-meals';
import { useWeek } from '../../frontend/hooks/use-week';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

const sampleIngredient = {
  id: 1,
  name: 'Chicken Breast',
  unit: 'lb',
  pricePerUnit: 5,
  stockUnits: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const sampleMeal = {
  id: 1,
  name: 'Grilled Chicken',
  description: null,
  servings: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
  ingredients: [{ mealId: 1, ingredientId: 1, quantity: 0.5, targetUnits: 0.5, ingredient: sampleIngredient }],
  cost: 2.5,
};

const samplePlans = [
  {
    id: 1,
    name: 'Week 1',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-07T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    items: [
      {
        planId: 1,
        mealId: 1,
        dayOfWeek: 1,
        servings: 2,
        snapshotCostPerServing: 1.5,
        meal: sampleMeal,
      },
    ],
    cost: 3,
  },
];

function setupMocks(planOverrides = {}, mealOverrides = {}) {
  (usePlans as ReturnType<typeof vi.fn>).mockReturnValue({
    items: samplePlans,
    loading: false,
    error: null,
    create: mockCreate,
    update: mockUpdate,
    remove: mockRemove,
    ...planOverrides,
  });
  (useMeals as ReturnType<typeof vi.fn>).mockReturnValue({
    items: [sampleMeal],
    loading: false,
    error: null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...mealOverrides,
  });
  (useWeek as ReturnType<typeof vi.fn>).mockReturnValue({
    weekOffset: 0,
    weekStart: new Date(2024, 0, 1, 0, 0, 0, 0),
    weekEnd: new Date(2024, 0, 7, 23, 59, 59, 999),
    prev: vi.fn(),
    next: vi.fn(),
    reset: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('PlansPage', () => {
  it('renders all plans with name, date range, and total cost', () => {
    render(<PlansPage />);

    expect(screen.getByRole('heading', { name: /meal plans/i })).toBeInTheDocument();
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getAllByText('$3.00').length).toBeGreaterThan(0);
  });

  it('shows the weekly plan form when no plan exists for the selected week', () => {
    setupMocks({ items: [] });
    render(<PlansPage />);

    expect(screen.getByRole('heading', { name: /week of jan 1/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /\+ add/i })).toHaveLength(7);
  });

  it('submits a new plan with meal items by day of week', async () => {
    setupMocks({ items: [] });
    mockCreate.mockResolvedValue(undefined);
    render(<PlansPage />);

    await userEvent.click(screen.getAllByRole('button', { name: /\+ add/i })[1]);
    const mealSelect = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(mealSelect, '1');

    await userEvent.click(screen.getByRole('button', { name: /save plan/i }));

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Week of Jan 1',
      items: [{ mealId: 1, dayOfWeek: 1, servings: 1 }],
    }));
  });

  it('hides a meal option after all servings are scheduled', async () => {
    setupMocks({ items: [] }, { items: [{ ...sampleMeal, servings: 1 }] });
    render(<PlansPage />);

    await userEvent.click(screen.getAllByRole('button', { name: /\+ add/i })[0]);
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], '1');
    await userEvent.click(screen.getAllByRole('button', { name: /\+ add/i })[1]);

    const secondSelect = screen.getAllByRole('combobox')[1];
    expect(secondSelect).not.toHaveTextContent('Grilled Chicken');
  });

  it('displays day of week labels (Sun–Sat) instead of numeric values', () => {
    render(<PlansPage />);

    // dayOfWeek: 1 should display as "Mon"
    expect(screen.getByText('Mon')).toBeInTheDocument();
  });

  it('shows the daily cost next to each day name', () => {
    render(<PlansPage />);

    const monHeader = screen.getByText('Mon').closest('div');

    expect(monHeader).toHaveTextContent('Mon');
    expect(monHeader).toHaveTextContent('$3.00');
  });

  it('opens the edit form pre-populated with existing plan data', async () => {
    render(<PlansPage />);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('heading', { name: /edit plan/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('1');
  });

  it('shows an error message when the API call fails', () => {
    setupMocks({ error: 'Failed to load plans' });
    render(<PlansPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load plans');
  });
});
