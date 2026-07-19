import express from 'express';
import {
  createClientPlan,
  getAllClientPlans,
  getPatientPlans,
  getBalance,
  cancelClientPlan,
  runExpireCheck
} from '../controllers/clientPlanController.js';
import { protect, authorize } from '../middleware/auth.js';

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

router.get('/patient/:patientId', getPatientPlans);
router.get('/balance/:patientId', getBalance);

export default router;
