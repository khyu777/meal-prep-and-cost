// Business logic for CRUD operations on Ingredient resources

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma-client';
import { serializeIngredient } from '../utils/ingredient-serializer';

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(255),
  unit: z.string().min(1).max(50),
  pricePerUnit: z.number().nonnegative(),
  stockUnits: z.number().nonnegative().optional(),
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
    const { name, unit, pricePerUnit, stockUnits } = req.body as z.infer<typeof createIngredientSchema>;
    const ingredient = await prisma.ingredient.create({
      data: { name, unit, pricePerUnit, stockUnits: stockUnits ?? 0 },
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
    const ingredient = await prisma.ingredient.update({ where: { id }, data });
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
