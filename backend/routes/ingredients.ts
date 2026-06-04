// Express router for /api/ingredients endpoints — maps routes to controller functions

import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  getAllIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  createIngredientSchema,
  updateIngredientSchema,
} from '../controllers/ingredients-controller';

const router = Router();

router.get('/', getAllIngredients);
router.post('/', validate(createIngredientSchema), createIngredient);
router.put('/:id', validate(updateIngredientSchema), updateIngredient);
router.delete('/:id', deleteIngredient);

export default router;
