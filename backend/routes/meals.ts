// Express router for /api/meals endpoints — maps routes to controller functions

import { Router } from 'express';
import { validate } from '../middleware/validate';
import { getAllMeals, getMealById, createMeal, updateMeal, deleteMeal } from '../controllers/meals-controller';
import { createMealSchema, updateMealSchema } from '../models/meal-schemas';

const router = Router();

router.get('/', getAllMeals);
router.get('/:id', getMealById);
router.post('/', validate(createMealSchema), createMeal);
router.put('/:id', validate(updateMealSchema), updateMeal);
router.delete('/:id', deleteMeal);

export default router;
