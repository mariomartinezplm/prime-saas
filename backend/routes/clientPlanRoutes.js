import express from 'express';
import {
  createClientPlan,
  getAllClientPlans,
  getPatientPlans,
  getBalance,
  cancelClientPlan,
  runExpireCheck
} from '../controllers/clientPlanController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'professional'), getAllClientPlans);
router.post('/', authorize('admin'), createClientPlan);
router.post('/expire-check', authorize('admin'), runExpireCheck);
router.put('/:id/cancel', authorize('admin'), cancelClientPlan);

// Rutas "me" van ANTES que las de :patientId (si no, Express las confunde con el parámetro).
// El controller ya resuelve al propio usuario cuando el rol es 'patient', así que
// estas rutas solo existen para tener una URL más limpia desde el frontend del paciente.
router.get('/patient/me', getPatientPlans);
router.get('/balance/me', getBalance);

// Pertenencia obligatoria: antes un profesional podía leer el plan y el saldo de
// CUALQUIER paciente, no solo de los suyos (Paso 04 de BLUEPRINT.md).
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientPlans);
router.get('/balance/:patientId', authorizePatientAccess('patientId'), getBalance);

export default router;
