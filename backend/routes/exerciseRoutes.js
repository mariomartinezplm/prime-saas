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
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de ejercicios
router.route('/')
  .post(authorize('admin'), createExerciseProgress);

router.get('/patient/:patientId', getPatientExercises);
router.get('/progress/:patientId/:exerciseName', getExerciseProgressChart);
router.get('/pr/:patientId/:exerciseName', getPersonalRecord);
router.get('/list/:patientId', getExerciseList);
router.get('/stats/:patientId', getExerciseStats);

router.route('/:id')
  .get(getExerciseProgress)
  .put(authorize('admin'), updateExerciseProgress)
  .delete(authorize('admin'), deleteExerciseProgress);

export default router;
