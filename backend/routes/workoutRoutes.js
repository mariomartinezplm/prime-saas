import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getActive, startWorkout, restAction, finishWorkout } from '../controllers/workoutController.js';

const router = express.Router();

// Entrenamiento en curso: solo el propio paciente. Ninguna ruta recibe el id de otro paciente.
router.use(protect);
router.use(authorize('patient'));

router.get('/active', getActive);
router.post('/start', startWorkout);
router.post('/:id/rest', restAction);
router.post('/:id/finish', finishWorkout);

export default router;
