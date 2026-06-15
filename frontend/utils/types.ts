// Shared TypeScript types matching the backend API shapes
export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  pricePerUnit: number;
  stockUnits: number;
  createdAt: string;
}

export interface MealIngredient {
  mealId: number;
  ingredientId: number;
  quantity: number;
  targetUnits: number;
  ingredient: Ingredient;
}

export interface MealWithCost {
  id: number;
  name: string;
  description: string | null;
  servings: number;
  createdAt: string;
  ingredients: MealIngredient[];
  cost: number;
}

export interface PlanItem {
  planId: number;
  mealId: number;
  dayOfWeek: number;
  servings: number;
  snapshotCostPerServing: number;
  meal: MealWithCost;
}

export interface PlanWithCost {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  items: PlanItem[];
  cost: number;
}
