// Business logic for CRUD operations on Meal resources, including cost computation

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../models/prisma-client';
import { computeMealCost } from '../utils/cost-calculator';
import { serializeIngredient } from '../utils/ingredient-serializer';
import { createMealSchema, updateMealSchema } from '../models/meal-schemas';

// Shared include clause for meals with ingredients and their purchase data
const mealInclude = {
  ingredients: {
    include: {
      ingredient: true,
    },
  },
} as const satisfies Prisma.MealInclude;

type MealWithIngredients = Prisma.MealGetPayload<{ include: typeof mealInclude }>;

function attachCost(meal: MealWithIngredients) {
  const cost = computeMealCost(meal.ingredients);
  return {
    ...meal,
    ingredients: meal.ingredients.map((mealIngredient) => ({
      ...mealIngredient,
      quantity: Number(mealIngredient.quantity),
      ingredient: serializeIngredient(mealIngredient.ingredient),
    })),
    cost,
  };
}

export async function getAllMeals(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const meals = await prisma.meal.findMany({
      orderBy: { createdAt: 'asc' },
      include: mealInclude,
    });
    res.json({ data: meals.map(attachCost), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function getMealById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ data: null, error: { message: 'Invalid id' }, status: 400 });
      return;
    }
    const meal = await prisma.meal.findUnique({
      where: { id },
      include: mealInclude,
    });
    if (!meal) {
      res.status(404).json({ data: null, error: { message: 'Meal not found' }, status: 404 });
      return;
    }
    res.json({ data: attachCost(meal), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function createMeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description, servings, ingredients } =
      req.body as z.infer<typeof createMealSchema>;

    const meal = await prisma.$transaction(async (tx) => {
        // Validate and deduct gram stock for each ingredient
        for (const mi of ingredients) {
          const ing = await tx.ingredient.findUnique({ where: { id: mi.ingredientId } });
          if (!ing) {
            throw Object.assign(new Error(`Ingredient ${mi.ingredientId} not found`), { statusCode: 400 });
          }
        const available = Number(ing.stockWeightGrams);
        if (available < mi.quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for "${ing.name}": need ${mi.quantity}g, have ${available}g`),
            { statusCode: 422 }
          );
        }
        await tx.ingredient.update({
          where: { id: mi.ingredientId },
          data: { stockWeightGrams: { decrement: mi.quantity } },
        });
      }

      return tx.meal.create({
        data: {
          name,
          description,
          servings,
          ingredients: {
            create: ingredients.map((mi) => ({
              ingredientId: mi.ingredientId,
              quantity: mi.quantity,
            })),
          },
        },
        include: mealInclude,
      });
    });

    res.status(201).json({ data: attachCost(meal), error: null, status: 201 });
  } catch (err) {
    next(err);
  }
}

export async function updateMeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ data: null, error: { message: 'Invalid id' }, status: 400 });
      return;
    }
    const { name, description, servings, ingredients } =
      req.body as z.infer<typeof updateMealSchema>;

    const updated = await prisma.$transaction(async (tx) => {
      if (ingredients !== undefined) {
        // Restore gram stock from old ingredient quantities before deducting new ones
        const oldIngredients = await tx.mealIngredient.findMany({ where: { mealId: id } });
        for (const old of oldIngredients) {
          await tx.ingredient.update({
            where: { id: old.ingredientId },
            data: { stockWeightGrams: { increment: Number(old.quantity) } },
          });
        }

        // Validate and deduct gram stock for new quantities
        for (const mi of ingredients) {
          const ing = await tx.ingredient.findUnique({ where: { id: mi.ingredientId } });
          if (!ing) {
            throw Object.assign(new Error(`Ingredient ${mi.ingredientId} not found`), { statusCode: 400 });
          }
          const available = Number(ing.stockWeightGrams);
          if (available < mi.quantity) {
            throw Object.assign(
              new Error(`Insufficient stock for "${ing.name}": need ${mi.quantity}g, have ${available}g`),
              { statusCode: 422 }
            );
          }
          await tx.ingredient.update({
            where: { id: mi.ingredientId },
            data: { stockWeightGrams: { decrement: mi.quantity } },
          });
        }

        await tx.mealIngredient.deleteMany({ where: { mealId: id } });
        await tx.mealIngredient.createMany({
          data: ingredients.map((mi) => ({
            mealId: id,
            ingredientId: mi.ingredientId,
            quantity: mi.quantity,
          })),
        });
      }
      return tx.meal.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(servings !== undefined && { servings }),
        },
        include: mealInclude,
      });
    });

    res.json({ data: attachCost(updated), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function deleteMeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ data: null, error: { message: 'Invalid id' }, status: 400 });
      return;
    }
    await prisma.$transaction(async (tx) => {
      const ingredients = await tx.mealIngredient.findMany({ where: { mealId: id } });
      for (const mi of ingredients) {
        await tx.ingredient.update({
          where: { id: mi.ingredientId },
          data: { stockWeightGrams: { increment: Number(mi.quantity) } },
        });
      }
      await tx.meal.delete({ where: { id } });
    });
    res.json({ data: { id }, error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}
