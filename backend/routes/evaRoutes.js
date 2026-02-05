import express from 'express';
import {
  createEVARecord,
  getPatientEVARecords,
  getEVARecord,
  updateEVARecord,
  deleteEVARecord,
  getPainEvolution,
  getAffectedAreas,
  getPainSummary
} from '../controllers/evaController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de EVA
router.route('/')
  .post(authorize('admin', 'professional'), createEVARecord);

router.get('/patient/:patientId', getPatientEVARecords);
router.get('/evolution/:patientId/:bodyArea', getPainEvolution);
router.get('/affected-areas/:patientId', getAffectedAreas);
router.get('/summary/:patientId', getPainSummary);

router.route('/:id')
  .get(getEVARecord)
  .put(authorize('admin', 'professional'), updateEVARecord)
  .delete(authorize('admin', 'professional'), deleteEVARecord);

export default router;
