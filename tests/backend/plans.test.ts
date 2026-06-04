// Tests for /api/plans routes using supertest and a mocked Prisma client

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../backend/middleware/error-handler';
import plansRouter from '../../backend/routes/plans';

jest.mock('../../backend/models/prisma-client', () => {
  const mealPlan = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mealPlanItem = { deleteMany: jest.fn(), createMany: jest.fn() };
  const meal = { findMany: jest.fn() };
  return {
    __esModule: true,
    default: {
      mealPlan,
      mealPlanItem,
      meal,
      // $transaction executes the callback with the same shared mock objects
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ mealPlan, mealPlanItem, meal })
      ),
    },
  };
});

import prisma from '../../backend/models/prisma-client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/plans', plansRouter);
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

const sampleMeal = {
  id: 1,
  name: 'Grilled Chicken',
  description: null,
  servings: 2,
  createdAt: new Date('2024-01-01'),
  ingredients: [
    { mealId: 1, ingredientId: 1, quantity: 250, ingredient: sampleIngredient },
  ],
};

const samplePlan = {
  id: 1,
  name: 'Week 1',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-07'),
  createdAt: new Date('2024-01-01'),
  items: [
    {
      planId: 1,
      mealId: 1,
      dayOfWeek: 1,
      servings: 2,
      snapshotCostPerServing: 1.5,
      meal: sampleMeal,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.meal.findMany as jest.Mock).mockResolvedValue([
    { id: 1, name: 'Grilled Chicken', servings: 2, ingredients: sampleMeal.ingredients },
  ]);
});

describe('Plans API', () => {
  describe('GET /api/plans', () => {
    it('returns a list of all meal plans with total cost and status 200', async () => {
      (mockPrisma.mealPlan.findMany as jest.Mock).mockResolvedValue([samplePlan]);

      const res = await request(buildApp()).get('/api/plans');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty('cost');
      expect(res.body.data[0].cost).toBe(3);
      expect(res.body.data[0].name).toBe('Week 1');
    });
  });

  describe('GET /api/plans/:id', () => {
    it('returns a single plan with meals, items, and total cost', async () => {
      (mockPrisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(samplePlan);

      const res = await request(buildApp()).get('/api/plans/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(res.body.data).toHaveProperty('cost');
      expect(res.body.data.cost).toBe(3);
      expect(res.body.data.name).toBe('Week 1');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('returns 404 when plan does not exist', async () => {
      (mockPrisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(buildApp()).get('/api/plans/999');

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(404);
    });
  });

  describe('POST /api/plans', () => {
    it('creates a plan with items and returns it with cost and status 201', async () => {
      (mockPrisma.mealPlan.create as jest.Mock).mockResolvedValue(samplePlan);

      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [{ mealId: 1, dayOfWeek: 1, servings: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ error: null, status: 201 });
      expect(res.body.data).toHaveProperty('cost');
    });

    it('returns 422 when scheduled servings exceed meal servings', async () => {
      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [{ mealId: 1, dayOfWeek: 1, servings: 3 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled();
    });

    it('returns 422 when total scheduled servings for one meal exceed meal servings across days', async () => {
      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [
            { mealId: 1, dayOfWeek: 1, servings: 1 },
            { mealId: 1, dayOfWeek: 2, servings: 2 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled();
    });

    it('returns 400 when items array is empty', async () => {
      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 when the same meal is scheduled twice on the same day', async () => {
      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [
            { mealId: 1, dayOfWeek: 1, servings: 1 },
            { mealId: 1, dayOfWeek: 1, servings: 1 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(mockPrisma.mealPlan.create).not.toHaveBeenCalled();
    });

    it('returns 400 when dayOfWeek is outside 0-6 range', async () => {
      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [{ mealId: 1, dayOfWeek: 7, servings: 2 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 when startDate or endDate is not a valid datetime', async () => {
      const res = await request(buildApp())
        .post('/api/plans')
        .send({
          name: 'Week 1',
          startDate: 'not-a-date',
          endDate: '2024-01-07T00:00:00.000Z',
          items: [{ mealId: 1, dayOfWeek: 1, servings: 2 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
    });
  });

  describe('PUT /api/plans/:id', () => {
    it('updates plan fields and replaces items when provided', async () => {
      const updatedPlan = { ...samplePlan, name: 'Updated Week' };
      (mockPrisma.mealPlanItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.mealPlanItem.createMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.mealPlan.update as jest.Mock).mockResolvedValue(updatedPlan);

      const res = await request(buildApp())
        .put('/api/plans/1')
        .send({
          name: 'Updated Week',
          items: [{ mealId: 1, dayOfWeek: 2, servings: 1 }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(res.body.data.name).toBe('Updated Week');
    });

    it('updates only scalar fields when items are not provided', async () => {
      const updatedPlan = { ...samplePlan, name: 'Renamed Week' };
      (mockPrisma.mealPlan.update as jest.Mock).mockResolvedValue(updatedPlan);

      const res = await request(buildApp())
        .put('/api/plans/1')
        .send({ name: 'Renamed Week' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ error: null, status: 200 });
      expect(mockPrisma.mealPlanItem.deleteMany).not.toHaveBeenCalled();
    });

    it('returns 404 when plan does not exist', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (mockPrisma.mealPlan.update as jest.Mock).mockRejectedValue(notFound);

      const res = await request(buildApp())
        .put('/api/plans/999')
        .send({ name: 'Ghost Plan' });

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 when replacement items duplicate the same meal and day', async () => {
      const res = await request(buildApp())
        .put('/api/plans/1')
        .send({
          items: [
            { mealId: 1, dayOfWeek: 1, servings: 1 },
            { mealId: 1, dayOfWeek: 1, servings: 1 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(mockPrisma.mealPlanItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.mealPlan.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/plans/:id', () => {
    it('deletes a plan and cascades to MealPlanItem rows', async () => {
      (mockPrisma.mealPlan.delete as jest.Mock).mockResolvedValue(samplePlan);

      const res = await request(buildApp()).delete('/api/plans/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { id: 1 },
        error: null,
        status: 200,
      });
    });

    it('returns 404 when plan does not exist', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (mockPrisma.mealPlan.delete as jest.Mock).mockRejectedValue(notFound);

      const res = await request(buildApp()).delete('/api/plans/999');

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
    });
  });
});
