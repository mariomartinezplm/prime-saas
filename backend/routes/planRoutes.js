import express from 'express';
import {
  createPlan,
  getPlans,
  getPlan,
  getActivePlan,
  updatePlan,
  deletePlan
} from '../controllers/planController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Obtener plan activo de un paciente (accesible para todos)
router.get('/active/:patientId', getActivePlan);

// CRUD de planes
router.route('/')
  .get(getPlans)
  .post(authorize('admin', 'professional'), createPlan);

router.route('/:id')
  .get(getPlan)
  .put(authorize('admin', 'professional'), updatePlan)
  .delete(authorize('admin'), deletePlan);

export default router;
