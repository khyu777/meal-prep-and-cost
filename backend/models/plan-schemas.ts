// Zod validation schemas for MealPlan and MealPlanItem request bodies

import { z } from 'zod';

const planItemSchema = z.object({
  mealId: z.number().int().positive(),
  dayOfWeek: z.number().int().min(0).max(6),
  servings: z.number().int().positive(),
});

const uniqueMealDays = (items: { mealId: number; dayOfWeek: number }[]) =>
  new Set(items.map((item) => `${item.mealId}:${item.dayOfWeek}`)).size === items.length;

const createPlanItemsSchema = z.array(planItemSchema).min(1).max(50).refine(uniqueMealDays, {
  message: 'Each meal can only be scheduled once per day',
});

const updatePlanItemsSchema = z.array(planItemSchema).max(50).refine(uniqueMealDays, {
  message: 'Each meal can only be scheduled once per day',
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  items: createPlanItemsSchema,
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  items: updatePlanItemsSchema.optional(),
});
