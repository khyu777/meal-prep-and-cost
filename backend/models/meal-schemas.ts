// Zod validation schemas for Meal and MealIngredient request bodies

import { z } from 'zod';

const mealIngredientSchema = z.object({
  ingredientId: z.number().int().positive(),
  quantity: z.number().positive(),
});

const uniqueIngredients = (items: { ingredientId: number }[]) =>
  new Set(items.map((i) => i.ingredientId)).size === items.length;

export const createMealSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  servings: z.number().int().positive(),
  ingredients: z
    .array(mealIngredientSchema)
    .min(1)
    .max(50)
    .refine(uniqueIngredients, { message: 'Each ingredient can only appear once' }),
});

export const updateMealSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  servings: z.number().int().positive().optional(),
  ingredients: z
    .array(mealIngredientSchema)
    .max(50)
    .refine((v) => v === undefined || uniqueIngredients(v), {
      message: 'Each ingredient can only appear once',
    })
    .optional(),
});
