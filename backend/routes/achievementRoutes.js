import express from 'express';
import { getPauses, createPause, deletePause } from '../controllers/achievementController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Pausas autorizadas: solo el personal, y solo de pacientes a los que tiene acceso (un paciente no ve ni
// toca las pausas: su motivo puede ser sensible).
router.get('/patients/:patientId/pauses', authorize('admin', 'professional'), authorizePatientAccess('patientId'), getPauses);
router.post('/patients/:patientId/pauses', authorize('admin', 'professional'), authorizePatientAccess('patientId'), createPause);
router.delete('/patients/:patientId/pauses/:periodKey', authorize('admin', 'professional'), authorizePatientAccess('patientId'), deletePause);

export default router;
