import express from 'express';
import {
  getPauses,
  createPause,
  deletePause,
  getMyBodyGoal,
  updateMyBodyGoal,
  getPatientBodyGoal,
  updatePatientBodyGoal,
  getMyAchievements,
  getMyUnseen,
  markMyAchievementSeen,
  getPatientAchievements
} from '../controllers/achievementController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Mis logros: SOLO los del propio paciente (nunca se recibe el id de otro paciente)
router.get('/me', authorize('patient'), getMyAchievements);
router.get('/me/unseen', authorize('patient'), getMyUnseen);
router.post('/me/:awardId/seen', authorize('patient'), markMyAchievementSeen);

// Vista del personal: logros con evidencia y estado de revisión de un paciente al que tiene acceso
router.get('/patients/:patientId', authorize('admin', 'professional'), authorizePatientAccess('patientId'), getPatientAchievements);

// Pausas autorizadas: solo el personal, y solo de pacientes a los que tiene acceso (un paciente no ve ni
// toca las pausas: su motivo puede ser sensible).
router.get('/patients/:patientId/pauses', authorize('admin', 'professional'), authorizePatientAccess('patientId'), getPauses);
router.post('/patients/:patientId/pauses', authorize('admin', 'professional'), authorizePatientAccess('patientId'), createPause);
router.delete('/patients/:patientId/pauses/:periodKey', authorize('admin', 'professional'), authorizePatientAccess('patientId'), deletePause);

// Meta corporal: el propio paciente la define/desactiva; el personal con acceso puede hacerlo por él.
// Va ANTES de '/patients/…' para que Express no confunda 'body-goal' con un id.
router.get('/body-goal', authorize('patient'), getMyBodyGoal);
router.put('/body-goal', authorize('patient'), updateMyBodyGoal);
router.get('/patients/:patientId/body-goal', authorize('admin', 'professional'), authorizePatientAccess('patientId'), getPatientBodyGoal);
router.put('/patients/:patientId/body-goal', authorize('admin', 'professional'), authorizePatientAccess('patientId'), updatePatientBodyGoal);

export default router;
