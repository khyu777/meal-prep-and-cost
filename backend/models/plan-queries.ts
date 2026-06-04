// Shared Prisma include clause for MealPlan queries with full nested data

import { Prisma } from '@prisma/client';

export const planInclude = {
  items: {
    include: {
      meal: {
        include: {
          ingredients: {
            include: { ingredient: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.MealPlanInclude;
