// Tests for /api/ingredients routes using supertest and a mocked Prisma client

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../backend/middleware/error-handler';
import ingredientsRouter from '../../backend/routes/ingredients';

// Mock the Prisma client before any imports resolve it
jest.mock('../../backend/models/prisma-client', () => ({
  __esModule: true,
  default: {
    ingredient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import prisma from '../../backend/models/prisma-client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ingredients', ingredientsRouter);
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Ingredients API', () => {
  describe('GET /api/ingredients', () => {
    it('returns a list of all ingredients with status 200', async () => {
      (mockPrisma.ingredient.findMany as jest.Mock).mockResolvedValue([sampleIngredient]);

      const res = await request(buildApp()).get('/api/ingredients');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: [{ name: 'Chicken Breast', totalWeightGrams: 1000, pricePerGram: 0.012 }],
        error: null,
        status: 200,
      });
    });
  });

  describe('POST /api/ingredients', () => {
    it('creates a new ingredient and returns it with status 201', async () => {
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue(sampleIngredient);

      const res = await request(buildApp())
        .post('/api/ingredients')
        .send({ name: 'Chicken Breast', quantity: 2, price: 12, weightPerQuantityGrams: 500 });

      expect(res.status).toBe(201);
      expect(mockPrisma.ingredient.create).toHaveBeenCalledWith({
        data: {
          name: 'Chicken Breast',
          quantity: 2,
          price: 12,
          weightPerQuantityGrams: 500,
          stockWeightGrams: 1000,
        },
      });
      expect(res.body).toMatchObject({
        data: { name: 'Chicken Breast', stockWeightGrams: 1000, pricePerGram: 0.012 },
        error: null,
        status: 201,
      });
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(buildApp())
        .post('/api/ingredients')
        .send({ name: 'Chicken Breast' });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(400);
    });

    it('returns 400 when price is not positive', async () => {
      const res = await request(buildApp())
        .post('/api/ingredients')
        .send({ name: 'Chicken Breast', quantity: 2, price: -1, weightPerQuantityGrams: 500 });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(400);
    });

    it('returns 400 when weightPerQuantityGrams is not positive', async () => {
      const res = await request(buildApp())
        .post('/api/ingredients')
        .send({ name: 'Chicken Breast', quantity: 2, price: 12, weightPerQuantityGrams: 0 });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(400);
    });

    it('returns 400 when pricePerGram is submitted instead of calculated', async () => {
      const res = await request(buildApp())
        .post('/api/ingredients')
        .send({
          name: 'Chicken Breast',
          quantity: 2,
          price: 12,
          weightPerQuantityGrams: 500,
          pricePerGram: 0.012,
        });

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(400);
      expect(mockPrisma.ingredient.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/ingredients/:id', () => {
    it('updates an existing ingredient and returns the updated record', async () => {
      const updated = { ...sampleIngredient, name: 'Updated Chicken' };
      (mockPrisma.ingredient.findUnique as jest.Mock).mockResolvedValue(sampleIngredient);
      (mockPrisma.ingredient.update as jest.Mock).mockResolvedValue(updated);

      const res = await request(buildApp())
        .put('/api/ingredients/1')
        .send({ name: 'Updated Chicken', quantity: 3 });

      expect(res.status).toBe(200);
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated Chicken', quantity: 3, stockWeightGrams: 1500 },
      });
      expect(res.body).toMatchObject({
        data: { name: 'Updated Chicken' },
        error: null,
        status: 200,
      });
    });

    it('returns 404 when ingredient does not exist', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (mockPrisma.ingredient.update as jest.Mock).mockRejectedValue(notFound);

      const res = await request(buildApp())
        .put('/api/ingredients/999')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(404);
    });
  });

  describe('DELETE /api/ingredients/:id', () => {
    it('deletes an ingredient and returns the deleted id', async () => {
      (mockPrisma.ingredient.delete as jest.Mock).mockResolvedValue(sampleIngredient);

      const res = await request(buildApp()).delete('/api/ingredients/1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { id: 1 },
        error: null,
        status: 200,
      });
    });

    it('returns 404 when ingredient does not exist', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (mockPrisma.ingredient.delete as jest.Mock).mockRejectedValue(notFound);

      const res = await request(buildApp()).delete('/api/ingredients/999');

      expect(res.status).toBe(404);
      expect(res.body.data).toBeNull();
      expect(res.body.status).toBe(404);
    });
  });
});
