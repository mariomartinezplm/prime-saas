import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getActive, startWorkout, restAction, finishWorkout, getSummary, searchExercises, addBlock, saveSets, updateSet, deleteSet } from '../controllers/workoutController.js';

const router = express.Router();

// Entrenamiento en curso: solo el propio paciente. Ninguna ruta recibe el id de otro paciente.
router.use(protect);
router.use(authorize('patient'));

router.get('/active', getActive);
router.get('/exercises/search', searchExercises);
router.put('/sets/:setId', updateSet);
router.delete('/sets/:setId', deleteSet);
router.post('/start', startWorkout);
router.post('/:id/rest', restAction);
router.post('/:id/blocks', addBlock);
router.post('/:id/sets', saveSets);
router.post('/:id/finish', finishWorkout);
router.get('/:id/summary', getSummary);

export default router;
