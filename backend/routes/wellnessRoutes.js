import express from 'express';
import {
  createCheckin,
  getTodayCheckin,
  getPatientCheckins,
  getTrends
} from '../controllers/wellnessController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Autoregistro exclusivo del paciente — no tiene sentido que el staff
// complete "¿cómo te sientes hoy?" en nombre de otra persona.
router.post('/', authorize('patient'), createCheckin);
router.get('/me', authorize('patient'), getTodayCheckin);

// Antes de ':patientId' — si no, Express confundiría "trends" con un id.
router.get('/trends', authorize('admin', 'professional'), getTrends);
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientCheckins);

export default router;
