import express from 'express';
import { actOnGoal, createGoalCheckin, createPatientGoal, getCatalog, getPatientGoals, getPatientSources } from '../controllers/goalController.js';
import { protect, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren sesión; la pertenencia (paciente solo lo suyo, profesional solo sus pacientes) se verifica en el servidor
router.use(protect);

router.get('/catalog', getCatalog);
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientGoals);
router.get('/patient/:patientId/sources', authorizePatientAccess('patientId'), getPatientSources);
router.post('/patient/:patientId', authorizePatientAccess('patientId'), createPatientGoal);
// Las rutas por id de objetivo comprueban la pertenencia dentro del controlador (el objetivo trae a su paciente)
router.post('/:goalId/action', actOnGoal);
router.post('/:goalId/checkins', createGoalCheckin);

export default router;
