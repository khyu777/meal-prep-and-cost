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
  const mealIngredient = { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() };
  const ingredient = { findUnique: jest.fn(), update: jest.fn() };
  return {
    __esModule: true,
    default: {
      meal,
      mealIngredient,
      ingredient,
      // $transaction executes the callback with the same shared mock objects
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ meal, mealIngredient, ingredient })
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
});
