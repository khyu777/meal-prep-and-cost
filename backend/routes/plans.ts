// Express router for /api/plans endpoints — maps routes to controller functions

import { Router } from 'express';
import { validate } from '../middleware/validate';
import { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan } from '../controllers/plans-controller';
import { createPlanSchema, updatePlanSchema } from '../models/plan-schemas';

const router = Router();

router.get('/', getAllPlans);
router.get('/:id', getPlanById);
router.post('/', validate(createPlanSchema), createPlan);
router.put('/:id', validate(updatePlanSchema), updatePlan);
router.delete('/:id', deletePlan);

export default router;
