import express from 'express';
import {
  createExerciseProgress,
  getPatientExercises,
  getExerciseProgress,
  updateExerciseProgress,
  deleteExerciseProgress,
  getExerciseProgressChart,
  getPersonalRecord,
  getExerciseList,
  getExerciseStats
} from '../controllers/exerciseController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de ejercicios
router.route('/')
  .post(authorize('admin', 'professional', 'patient'), createExerciseProgress);

// Pertenencia verificada en la ruta (Paso 04 de BLUEPRINT.md)
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientExercises);
router.get('/progress/:patientId/:exerciseName', authorizePatientAccess('patientId'), getExerciseProgressChart);
router.get('/pr/:patientId/:exerciseName', authorizePatientAccess('patientId'), getPersonalRecord);
router.get('/list/:patientId', authorizePatientAccess('patientId'), getExerciseList);
router.get('/stats/:patientId', authorizePatientAccess('patientId'), getExerciseStats);

router.route('/:id')
  .get(getExerciseProgress)
  .put(authorize('admin', 'professional', 'patient'), updateExerciseProgress)
  .delete(authorize('admin', 'professional'), deleteExerciseProgress);

export default router;
