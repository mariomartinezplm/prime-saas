import express from 'express';
import { listPlans, getLastSession, createPlan, updatePlan, deletePlan } from '../controllers/trainingPlanController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Leer: el equipo (de sus pacientes) y el propio paciente (solo lo visible). Pertenencia verificada en la ruta.
router.get('/patient/:patientId', authorize('admin', 'professional', 'patient'), authorizePatientAccess('patientId'), listPlans);
// Escribir: solo el equipo
router.get('/patient/:patientId/last-session', authorize('admin', 'professional'), authorizePatientAccess('patientId'), getLastSession);
router.post('/patient/:patientId', authorize('admin', 'professional'), authorizePatientAccess('patientId'), createPlan);
router.put('/:id', authorize('admin', 'professional'), updatePlan);
router.delete('/:id', authorize('admin', 'professional'), deletePlan);

export default router;
