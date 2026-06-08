// Business logic for CRUD operations on Meal resources, including cost computation

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../models/prisma-client';
import { computeMealCost } from '../utils/cost-calculator';
import { serializeIngredient } from '../utils/ingredient-serializer';
import { createMealSchema, updateMealSchema, autoPortionSchema } from '../models/meal-schemas';

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
      targetGrams: Number(mealIngredient.targetGrams),
      ingredient: serializeIngredient(mealIngredient.ingredient),
    })),
    cost,
  };
}

function allocateWholeGramsByTarget<T>(
  rows: T[],
  wholeGramPool: number,
  targetFor: (row: T) => number
): number[] {
  const totalTarget = rows.reduce((sum, row) => sum + targetFor(row), 0);
  if (totalTarget <= 0 || wholeGramPool <= 0) {
    return rows.map(() => 0);
  }

  const allocations = rows.map((row, index) => {
    const exact = wholeGramPool * (targetFor(row) / totalTarget);
    const floor = Math.floor(exact);
    return { index, floor, remainder: exact - floor };
  });
  let remaining = wholeGramPool - allocations.reduce((sum, row) => sum + row.floor, 0);

  allocations
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((row) => {
      if (remaining > 0) {
        row.floor += 1;
        remaining--;
      }
    });

  return allocations
    .sort((a, b) => a.index - b.index)
    .map((row) => row.floor);
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
        if (mi.quantity > 0) {
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
              targetGrams: mi.targetGrams ?? mi.quantity,
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
          if (mi.quantity > 0) {
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
        }

        await tx.mealIngredient.deleteMany({ where: { mealId: id } });
        await tx.mealIngredient.createMany({
          data: ingredients.map((mi) => ({
            mealId: id,
            ingredientId: mi.ingredientId,
            quantity: mi.quantity,
            targetGrams: mi.targetGrams ?? mi.quantity,
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

export async function autoPortion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { mealIds } = req.body as { mealIds: number[] };

    const updatedMeals = await prisma.$transaction(async (tx) => {
      // Load all MealIngredient rows for the target meals + full ingredient data
      const rows = await tx.mealIngredient.findMany({
        where: { mealId: { in: mealIds } },
        include: { ingredient: true },
      });

      // Group by ingredientId to process each purchased ingredient once
      const byIngredient = new Map<number, typeof rows>();
      for (const row of rows) {
        const arr = byIngredient.get(row.ingredientId) ?? [];
        arr.push(row);
        byIngredient.set(row.ingredientId, arr);
      }

      for (const [ingredientId, miRows] of byIngredient) {
        const ing = miRows[0].ingredient;
        const currentSelectedQuantity = miRows.reduce((sum, row) => sum + Number(row.quantity), 0);
        const available = Math.max(0, Number(ing.stockWeightGrams) + currentSelectedQuantity);
        const wholeGramPool = Math.floor(available);

        const totalTarget = miRows.reduce((s, r) => s + Number(r.targetGrams), 0);
        if (totalTarget <= 0) continue;

        const allocations = allocateWholeGramsByTarget(
          miRows,
          wholeGramPool,
          (row) => Number(row.targetGrams)
        );
        const newQtys: { mealId: number; qty: number }[] = miRows.map((row, index) => ({
          mealId: row.mealId,
          qty: allocations[index],
        }));

        // Update each MealIngredient with its new quantity
        for (const { mealId, qty } of newQtys) {
          await tx.mealIngredient.update({
            where: { mealId_ingredientId: { mealId, ingredientId } },
            data: { quantity: qty },
          });
        }

        const allocated = newQtys.reduce((s, r) => s + r.qty, 0);
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { stockWeightGrams: available - allocated },
        });
      }

      return tx.meal.findMany({
        where: { id: { in: mealIds } },
        include: mealInclude,
      });
    });

    res.json({ data: updatedMeals.map(attachCost), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}
