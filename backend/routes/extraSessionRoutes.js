import express from 'express';
import {
  createExtraSession,
  getPatientExtraSessions
} from '../controllers/extraSessionController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('admin', 'professional'), createExtraSession);

// "me" antes que ":patientId" por la misma razón que en clientPlanRoutes.js
router.get('/patient/me', getPatientExtraSessions);
router.get('/patient/:patientId', getPatientExtraSessions);

export default router;
