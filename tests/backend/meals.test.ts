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
      // $transaction executes the callback with the same shared mock objects
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
  quantity: 2,
  price: 12,
  weightPerQuantityGrams: 500,
  stockWeightGrams: 1000,
  createdAt: new Date('2024-01-01'),
};

const sampleMealIngredient = {
  mealId: 1,
  ingredientId: 1,
  quantity: 250,
  targetGrams: 250,
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
      expect(res.body.data[0].cost).toBe(3);
      expect(res.body.data[0].name).toBe('Grilled Chicken');
      expect(res.body.data[0].ingredients[0].ingredient.pricePerGram).toBe(0.012);
      expect(res.body.data[0].ingredients[0].ingredient.totalWeightGrams).toBe(1000);
    });
  });

  describe('GET /api/meals/:id', () => {
    it('returns a single meal with ingredients and computed cost', async () => {
      (mockPrisma.meal.findUnique as jest.Mock).mockResolvedValue(sampleMeal);

      const res = await request(buildApp()).get('/api/meals/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(res.body.data).toHaveProperty('cost');
      expect(res.body.data.cost).toBe(3);
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
          ingredients: [{ ingredientId: 1, quantity: 250 }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ error: null, status: 201 });
      expect(res.body.data).toHaveProperty('cost');
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockWeightGrams: { decrement: 250 } },
      });
    });

    it('returns 422 when ingredient stock is insufficient', async () => {
      (mockPrisma.ingredient.findUnique as jest.Mock).mockResolvedValue({
        ...sampleIngredient,
        stockWeightGrams: 100,
      });

      const res = await request(buildApp())
        .post('/api/meals')
        .send({
          name: 'Grilled Chicken',
          servings: 2,
          ingredients: [{ ingredientId: 1, quantity: 250 }],
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
          ingredients: [{ ingredientId: 1, quantity: 250 }],
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
          ingredients: [{ ingredientId: 1, quantity: 400 }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(res.body.data.name).toBe('Updated Chicken');
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockWeightGrams: { increment: 250 } },
      });
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockWeightGrams: { decrement: 400 } },
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
    it('deletes a meal and cascades to MealIngredient rows', async () => {
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
        data: { stockWeightGrams: { increment: 250 } },
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
    it('distributes stock plus selected meal quantities proportional to targetGrams', async () => {
      // Two meals each using the same ingredient with targetGrams 250 and 750
      const mi1 = { ...sampleMealIngredient, mealId: 1, quantity: 100, targetGrams: 250 };
      const mi2 = { ...sampleMealIngredient, mealId: 2, quantity: 100, targetGrams: 750 };

      (mockPrisma.mealIngredient.findMany as jest.Mock)
        .mockResolvedValueOnce([mi1, mi2]);   // target meals

      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [{ ...mi1, quantity: 300 }] },
        { ...sampleMeal, id: 2, ingredients: [{ ...mi2, quantity: 900 }] },
      ]);

      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      // Pool: 1000g remaining stock + 200g already assigned to selected meals.
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 300 } })
      );
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 900 } })
      );
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockWeightGrams: 0 },
      });
    });

    it('is idempotent when re-run because selected meal quantities are re-pooled', async () => {
      const ingredientWithNoRemainingStock = { ...sampleIngredient, stockWeightGrams: 0 };
      const mi1 = {
        ...sampleMealIngredient,
        mealId: 1,
        quantity: 300,
        targetGrams: 250,
        ingredient: ingredientWithNoRemainingStock,
      };
      const mi2 = {
        ...sampleMealIngredient,
        mealId: 2,
        quantity: 900,
        targetGrams: 750,
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
        expect.objectContaining({ data: { quantity: 300 } })
      );
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 900 } })
      );
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockWeightGrams: 0 },
      });
    });

    it('uses largest remainder allocation and leaves fractional grams in stock', async () => {
      const ingredientWithFractionalStock = { ...sampleIngredient, stockWeightGrams: 1000.6 };
      const mi1 = {
        ...sampleMealIngredient,
        mealId: 1,
        quantity: 0,
        targetGrams: 1,
        ingredient: ingredientWithFractionalStock,
      };
      const mi2 = {
        ...sampleMealIngredient,
        mealId: 2,
        quantity: 0,
        targetGrams: 2,
        ingredient: ingredientWithFractionalStock,
      };

      (mockPrisma.mealIngredient.findMany as jest.Mock).mockResolvedValueOnce([mi1, mi2]);
      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [{ ...mi1, quantity: 333 }] },
        { ...sampleMeal, id: 2, ingredients: [{ ...mi2, quantity: 667 }] },
      ]);

      const res = await request(buildApp())
        .post('/api/meals/auto-portion')
        .send({ mealIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 333 } })
      );
      expect(mockPrisma.mealIngredient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 667 } })
      );
      const stockUpdate = (mockPrisma.ingredient.update as jest.Mock).mock.calls[0][0];
      expect(stockUpdate.where).toEqual({ id: 1 });
      expect(stockUpdate.data.stockWeightGrams).toBeCloseTo(0.6);
    });

    it('does not update meals outside the selected meal IDs', async () => {
      const selected = { ...sampleMealIngredient, mealId: 1, quantity: 0, targetGrams: 250 };
      const outside = { ...sampleMealIngredient, mealId: 99, quantity: 800, targetGrams: 800 };

      (mockPrisma.mealIngredient.findMany as jest.Mock).mockResolvedValueOnce([selected]);
      (mockPrisma.mealIngredient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
        { ...sampleMeal, id: 1, ingredients: [{ ...selected, quantity: 1000 }] },
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
          where: { mealId_ingredientId: { mealId: outside.mealId, ingredientId: outside.ingredientId } },
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
