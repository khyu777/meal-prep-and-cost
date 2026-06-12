// Business logic for CRUD operations on MealPlan resources, including total cost computation

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../models/prisma-client';
import { computeMealCost } from '../utils/cost-calculator';
import { createPlanSchema, updatePlanSchema } from '../models/plan-schemas';
import { planInclude } from '../models/plan-queries';

interface MealServingLimit {
  id: number;
  name: string;
  servings: number;
}

type PlanWithItems = Prisma.MealPlanGetPayload<{ include: typeof planInclude }>;
type PlanItemWithMeal = PlanWithItems['items'][number];

function attachCost(plan: PlanWithItems) {
  const itemsWithMealCost = plan.items.map((item: PlanItemWithMeal) => ({
    ...item,
    snapshotCostPerServing: Number(item.snapshotCostPerServing),
    meal: { ...item.meal, cost: computeMealCost(item.meal.ingredients) },
  }));
  const cost = Math.round(
    itemsWithMealCost.reduce((sum, item) => sum + item.snapshotCostPerServing * item.servings, 0) * 100
  ) / 100;
  return { ...plan, items: itemsWithMealCost, cost };
}

async function computeSnapshotCosts(
  tx: Prisma.TransactionClient,
  mealIds: number[]
): Promise<Map<number, number>> {
  const meals = await tx.meal.findMany({
    where: { id: { in: mealIds } },
    select: {
      id: true,
      servings: true,
      ingredients: { include: { ingredient: true } },
    },
  });
  const map = new Map<number, number>();
  for (const meal of meals) {
    const totalCost = computeMealCost(meal.ingredients);
    map.set(meal.id, meal.servings > 0 ? totalCost / meal.servings : 0);
  }
  return map;
}

async function validatePlanItemServings(
  tx: Prisma.TransactionClient,
  items: { mealId: number; servings: number }[]
): Promise<void> {
  const mealIds = [...new Set(items.map((item) => item.mealId))];
  const meals: MealServingLimit[] = await tx.meal.findMany({
    where: { id: { in: mealIds } },
    select: { id: true, name: true, servings: true },
  });
  const mealsById = new Map<number, MealServingLimit>(meals.map((meal) => [meal.id, meal]));
  const servingsByMealId = new Map<number, number>();

  for (const item of items) {
    const meal = mealsById.get(item.mealId);
    if (!meal) {
      throw Object.assign(new Error(`Meal ${item.mealId} not found`), { statusCode: 400 });
    }
    const totalServings = (servingsByMealId.get(item.mealId) ?? 0) + item.servings;
    servingsByMealId.set(item.mealId, totalServings);
    if (totalServings > meal.servings) {
      throw Object.assign(
        new Error(`"${meal.name}" only makes ${meal.servings} servings`),
        { statusCode: 422 }
      );
    }
  }
}

export async function getAllPlans(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await prisma.mealPlan.findMany({
      orderBy: { createdAt: 'asc' },
      include: planInclude,
    });
    res.json({ data: plans.map(attachCost), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function getPlanById(
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
    const plan = await prisma.mealPlan.findUnique({
      where: { id },
      include: planInclude,
    });
    if (!plan) {
      res.status(404).json({ data: null, error: { message: 'Plan not found' }, status: 404 });
      return;
    }
    res.json({ data: attachCost(plan), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function createPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, startDate, endDate, items } =
      req.body as z.infer<typeof createPlanSchema>;

    const plan = await prisma.$transaction(async (tx) => {
      await validatePlanItemServings(tx, items);
      const mealIds = [...new Set(items.map((i) => i.mealId))];
      const snapshotCosts = await computeSnapshotCosts(tx, mealIds);

      return tx.mealPlan.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          items: {
            create: items.map((item) => ({
              mealId: item.mealId,
              dayOfWeek: item.dayOfWeek,
              servings: item.servings,
              snapshotCostPerServing: snapshotCosts.get(item.mealId) ?? 0,
            })),
          },
        },
        include: planInclude,
      });
    });

    res.status(201).json({ data: attachCost(plan), error: null, status: 201 });
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(
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
    const { name, startDate, endDate, items } =
      req.body as z.infer<typeof updatePlanSchema>;

    const updated = await prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await validatePlanItemServings(tx, items);
        const mealIds = [...new Set(items.map((i) => i.mealId))];
        const snapshotCosts = await computeSnapshotCosts(tx, mealIds);
        await tx.mealPlanItem.deleteMany({ where: { planId: id } });
        await tx.mealPlanItem.createMany({
          data: items.map((item) => ({
            planId: id,
            mealId: item.mealId,
            dayOfWeek: item.dayOfWeek,
            servings: item.servings,
            snapshotCostPerServing: snapshotCosts.get(item.mealId) ?? 0,
          })),
        });
      }
      return tx.mealPlan.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(startDate !== undefined && { startDate: new Date(startDate) }),
          ...(endDate !== undefined && { endDate: new Date(endDate) }),
        },
        include: planInclude,
      });
    });

    res.json({ data: attachCost(updated), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function deletePlan(
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
    await prisma.mealPlan.delete({ where: { id } });
    res.json({ data: { id }, error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}
