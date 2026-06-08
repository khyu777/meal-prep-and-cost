// Shared TypeScript types matching the backend API shapes
export interface Ingredient {
  id: number;
  name: string;
  quantity: number;
  price: number;
  weightPerQuantityGrams: number;
  stockWeightGrams: number;
  totalWeightGrams: number;
  pricePerGram: number;
  createdAt: string;
}

export interface MealIngredient {
  mealId: number;
  ingredientId: number;
  quantity: number;
  targetGrams: number;
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
