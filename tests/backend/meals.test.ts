// Tests for /api/meals routes using supertest and a mocked Prisma client

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../backend/middleware/error-handler';
import mealsRouter from '../../backend/routes/meals';

jest.mock('../../backend/models/prisma-client', () => {
  const meal = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mealIngredient = { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn(), update: jest.fn() };
  const mealPlanItem = { findMany: jest.fn() };
  const ingredient = { findUnique: jest.fn(), update: jest.fn() };
  return {
    __esModule: true,
    default: {
      meal,
      mealIngredient,
      mealPlanItem,
      ingredient,
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ meal, mealIngredient, mealPlanItem, ingredient })
      ),
    },
  };
});

import prisma from '../../backend/models/prisma-client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/meals', mealsRouter);
  app.use(errorHandler);
  return app;
}

const sampleIngredient = {
  id: 1,
  name: 'Chicken Breast',
  unit: 'lb',
  pricePerUnit: 5,
  stockUnits: 2,
  createdAt: new Date('2024-01-01'),
};

const sampleMealIngredient = {
  mealId: 1,
  ingredientId: 1,
  quantity: 0.5,
  targetUnits: 0.5,
  ingredient: sampleIngredient,
};

const sampleMeal = {
  id: 1,
  name: 'Grilled Chicken',
  description: 'Healthy meal',
  servings: 2,
  createdAt: new Date('2024-01-01'),
  ingredients: [sampleMealIngredient],
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.ingredient.findUnique as jest.Mock).mockResolvedValue(sampleIngredient);
  (mockPrisma.ingredient.update as jest.Mock).mockResolvedValue(sampleIngredient);
  (mockPrisma.mealIngredient.findMany as jest.Mock).mockResolvedValue([sampleMealIngredient]);
  (mockPrisma.mealPlanItem.findMany as jest.Mock).mockResolvedValue([]);
});

describe('Meals API', () => {
  describe('GET /api/meals', () => {
    it('returns a list of all meals with computed cost and status 200', async () => {
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([sampleMeal]);

      const res = await request(buildApp()).get('/api/meals');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty('cost');
      // cost = 0.5 units × $5/unit = $2.50
      expect(res.body.data[0].cost).toBe(2.5);
      expect(res.body.data[0].name).toBe('Grilled Chicken');
      expect(res.body.data[0].ingredients[0].ingredient.pricePerUnit).toBe(5);
    });
  });

  describe('GET /api/meals/:id', () => {
    it('returns a single meal with ingredients and computed cost', async () => {
      (mockPrisma.meal.findUnique as jest.Mock).mockResolvedValue(sampleMeal);

      const res = await request(buildApp()).get('/api/meals/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(res.body.data).toHaveProperty('cost');
      expect(res.body.data.cost).toBe(2.5);
      expect(res.body.data.name).toBe('Grilled Chicken');
    });

    it('returns 404 when meal does not exist', async () => {
      (mockPrisma.meal.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(buildApp()).get('/api/meals/999');

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(404);
    });
  });

  describe('POST /api/meals', () => {
    it('creates a meal with ingredients and returns it with cost and status 201', async () => {
      (mockPrisma.meal.create as jest.Mock).mockResolvedValue(sampleMeal);

      const res = await request(buildApp())
        .post('/api/meals')
        .send({
          name: 'Grilled Chicken',
          servings: 2,
          ingredients: [{ ingredientId: 1, quantity: 0.5 }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ error: null, status: 201 });
      expect(res.body.data).toHaveProperty('cost');
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockUnits: { decrement: 0.5 } },
      });
    });

    it('returns 422 when ingredient stock is insufficient', async () => {
      (mockPrisma.ingredient.findUnique as jest.Mock).mockResolvedValue({
        ...sampleIngredient,
        stockUnits: 0.25,
      });

      const res = await request(buildApp())
        .post('/api/meals')
        .send({
          name: 'Grilled Chicken',
          servings: 2,
          ingredients: [{ ingredientId: 1, quantity: 0.5 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(mockPrisma.meal.create).not.toHaveBeenCalled();
    });

    it('returns 400 when ingredients array is empty', async () => {
      const res = await request(buildApp())
        .post('/api/meals')
        .send({ name: 'Grilled Chicken', servings: 2, ingredients: [] });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 when servings is not a positive integer', async () => {
      const res = await request(buildApp())
        .post('/api/meals')
        .send({
          name: 'Grilled Chicken',
          servings: 0,
          ingredients: [{ ingredientId: 1, quantity: 0.5 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
    });
  });

  describe('PUT /api/meals/:id', () => {
    it('updates meal fields and replaces ingredients when provided', async () => {
      const updatedMeal = { ...sampleMeal, name: 'Updated Chicken' };
      (mockPrisma.mealIngredient.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.mealIngredient.createMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.meal.update as jest.Mock).mockResolvedValue(updatedMeal);

      const res = await request(buildApp())
        .put('/api/meals/1')
        .send({
          name: 'Updated Chicken',
          ingredients: [{ ingredientId: 1, quantity: 0.8 }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(res.body.data.name).toBe('Updated Chicken');
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockUnits: { increment: 0.5 } },
      });
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockUnits: { decrement: 0.8 } },
      });
    });

    it('updates only scalar fields when ingredients are not provided', async () => {
      const updatedMeal = { ...sampleMeal, servings: 4 };
      (mockPrisma.meal.update as jest.Mock).mockResolvedValue(updatedMeal);

      const res = await request(buildApp())
        .put('/api/meals/1')
        .send({ servings: 4 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(mockPrisma.mealIngredient.deleteMany).not.toHaveBeenCalled();
    });

    it('returns 422 when shrinking servings below what a plan already schedules', async () => {
      (mockPrisma.mealPlanItem.findMany as jest.Mock).mockResolvedValue([
        { planId: 1, mealId: 1, dayOfWeek: 0, servings: 2 },
        { planId: 1, mealId: 1, dayOfWeek: 3, servings: 2 },
      ]);

      const res = await request(buildApp())
        .put('/api/meals/1')
        .send({ servings: 3 });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(mockPrisma.meal.update).not.toHaveBeenCalled();
    });

    it('returns 404 when meal does not exist', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (mockPrisma.meal.update as jest.Mock).mockRejectedValue(notFound);

      const res = await request(buildApp())
        .put('/api/meals/999')
        .send({ name: 'Ghost Meal' });

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
    });
  });

  describe('DELETE /api/meals/:id', () => {
    it('deletes a meal and restores ingredient stock', async () => {
      (mockPrisma.meal.delete as jest.Mock).mockResolvedValue(sampleMeal);

      const res = await request(buildApp()).delete('/api/meals/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { id: 1 },
        error: null,
        status: 200,
      });
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockUnits: { increment: 0.5 } },
      });
    });

    it('returns 404 when meal does not exist', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (mockPrisma.meal.delete as jest.Mock).mockRejectedValue(notFound);

      const res = await request(buildApp()).delete('/api/meals/999');

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
    });
  });

  describe('POST /api/meals/auto-portion', () => {
    it('distributes stock plus selected meal quantities proportional to targetUnits', async () => {
      // Two meals each using the same ingredient with targetUnits 0.25 and 0.75
      const mi1 = { ...sampleMealIngredient, mealId: 1, quantity: 0.1, targetUnits: 0.25 };
      const mi2 = { ...sampleMealIngredient, mealId: 2, quantity: 0.1, targetUnits: 0.75 };

      (mockPrisma.mealIngredient.findMany as jest.Mock)
        .mockResolvedValueOnce([mi1, mi2]);

      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [{ ...mi1, quantity: 0.5 }] },
        { ...sampleMeal, id: 2, ingredients: [{ ...mi2, quantity: 1.5 }] },
      ]);

      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      // Pool: 2 stockUnits + 0.2 already assigned = 2.2 units total
      // mi1 gets 0.25/1.0 × 2.2 = 0.55; mi2 gets 0.75/1.0 × 2.2 = 1.65
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 0.55 } })
      );
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 1.65 } })
      );
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockUnits: 0 },
      });
    });

    it('is idempotent when re-run because selected meal quantities are re-pooled', async () => {
      const ingredientWithNoRemainingStock = { ...sampleIngredient, stockUnits: 0 };
      const mi1 = {
        ...sampleMealIngredient,
        mealId: 1,
        quantity: 0.55,
        targetUnits: 0.25,
        ingredient: ingredientWithNoRemainingStock,
      };
      const mi2 = {
        ...sampleMealIngredient,
        mealId: 2,
        quantity: 1.65,
        targetUnits: 0.75,
        ingredient: ingredientWithNoRemainingStock,
      };

      (mockPrisma.mealIngredient.findMany as jest.Mock).mockResolvedValueOnce([mi1, mi2]);
      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [mi1] },
        { ...sampleMeal, id: 2, ingredients: [mi2] },
      ]);

      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 0.55 } })
      );
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 1.65 } })
      );
    });

    it('uses largest-remainder allocation and leaves fractional units in stock', async () => {
      // 1.006 units available, split 1:2 ratio → 0.34 + 0.67 = 1.01, leftover ≈ 0
      const ingredientWithFractionalStock = { ...sampleIngredient, stockUnits: 1.006 };
      const mi1 = {
        ...sampleMealIngredient,
        mealId: 1,
        quantity: 0,
        targetUnits: 1,
        ingredient: ingredientWithFractionalStock,
      };
      const mi2 = {
        ...sampleMealIngredient,
        mealId: 2,
        quantity: 0,
        targetUnits: 2,
        ingredient: ingredientWithFractionalStock,
      };

      (mockPrisma.mealIngredient.findMany as jest.Mock).mockResolvedValueOnce([mi1, mi2]);
      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [{ ...mi1, quantity: 0.33 }] },
        { ...sampleMeal, id: 2, ingredients: [{ ...mi2, quantity: 0.67 }] },
      ]);

      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 0.33 } })
      );
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 0.67 } })
      );
      // 1.006 − 1.00 = 0.006 remainder stays in stock
      const stockCall = (mockPrisma.ingredient.update as jest.Mock).mock.calls[0][0];
      expect(stockCall.where).toEqual({ id: 1 });
      expect(stockCall.data.stockUnits).toBeCloseTo(0.006, 3);
    });

    it('does not update meals outside the selected meal IDs', async () => {
      const selected = { ...sampleMealIngredient, mealId: 1, quantity: 0, targetUnits: 0.25 };

      (mockPrisma.mealIngredient.findMany as jest.Mock).mockResolvedValueOnce([selected]);
      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [{ ...selected, quantity: 2 }] },
      ]);

      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [1] });

      expect(res.status).toBe(200);
      expect(mockPrisma.mealIngredient.findMany).toHaveBeenCalledWith({
        where: { mealId: { in: [1] } },
        include: { ingredient: true },
      });
      expect(mockPrisma.mealIngredient.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { mealId_ingredientId: { mealId: 99, ingredientId: 1 } },
        })
      );
    });

    it('returns 400 when mealIds is empty', async () => {
      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
    });
  });
});
