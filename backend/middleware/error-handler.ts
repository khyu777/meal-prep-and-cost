// Global Express error-handling middleware — catches all errors passed via next(err)

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      data: null,
      error: { message: 'Validation error', details: err.errors },
      status: 400,
    });
    return;
  }

  // Prisma P2025: record not found (e.g. update/delete on non-existent id)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({
      data: null,
      error: { message: 'Record not found' },
      status: 404,
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  // Never leak internal error details for 5xx responses
  const message = statusCode >= 500 ? 'Internal server error' : (err.message ?? 'Internal server error');

  res.status(statusCode).json({
    data: null,
    error: { message },
    status: statusCode,
  });
}
