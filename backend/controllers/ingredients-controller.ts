// Business logic for CRUD operations on Ingredient resources

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma-client';
import { serializeIngredient } from '../utils/ingredient-serializer';

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.number().positive(),
  price: z.number().positive(),
  weightPerQuantityGrams: z.number().positive(),
}).strict();

export const updateIngredientSchema = createIngredientSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export async function getAllIngredients(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: ingredients.map(serializeIngredient), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function createIngredient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, quantity, price, weightPerQuantityGrams } = req.body as z.infer<typeof createIngredientSchema>;
    const stockWeightGrams = quantity * weightPerQuantityGrams;
    const ingredient = await prisma.ingredient.create({
      data: { name, quantity, price, weightPerQuantityGrams, stockWeightGrams },
    });
    res.status(201).json({ data: serializeIngredient(ingredient), error: null, status: 201 });
  } catch (err) {
    next(err);
  }
}

export async function updateIngredient(
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
    const data = req.body as z.infer<typeof updateIngredientSchema>;
    const weightFieldChanged =
      data.quantity !== undefined || data.weightPerQuantityGrams !== undefined;
    const updateData: typeof data & { stockWeightGrams?: number } = { ...data };

    if (weightFieldChanged) {
      const current = await prisma.ingredient.findUnique({ where: { id } });
      if (!current) {
        res.status(404).json({ data: null, error: { message: 'Ingredient not found' }, status: 404 });
        return;
      }
      const oldTotalWeight = Number(current.quantity) * Number(current.weightPerQuantityGrams);
      const nextQuantity = data.quantity ?? Number(current.quantity);
      const nextWeightPerQuantityGrams =
        data.weightPerQuantityGrams ?? Number(current.weightPerQuantityGrams);
      const newTotalWeight = nextQuantity * nextWeightPerQuantityGrams;
      // Preserve consumed grams — only adjust stock by the change in total weight
      updateData.stockWeightGrams = Number(current.stockWeightGrams) + (newTotalWeight - oldTotalWeight);
    }

    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: updateData,
    });
    res.json({ data: serializeIngredient(ingredient), error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}

export async function deleteIngredient(
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
    await prisma.ingredient.delete({ where: { id } });
    res.json({ data: { id }, error: null, status: 200 });
  } catch (err) {
    next(err);
  }
}
