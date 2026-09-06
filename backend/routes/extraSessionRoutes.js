import express from 'express';
import {
  createExtraSession,
  getPatientExtraSessions
} from '../controllers/extraSessionController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('admin', 'professional'), createExtraSession);

// "me" antes que ":patientId" por la misma razón que en clientPlanRoutes.js
router.get('/patient/me', getPatientExtraSessions);
// Pertenencia obligatoria (Paso 04 de BLUEPRINT.md)
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientExtraSessions);

export default router;
