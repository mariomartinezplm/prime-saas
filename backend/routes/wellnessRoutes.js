import express from 'express';
import { createCheckin, getTodayCheckin } from '../controllers/wellnessController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Autoregistro exclusivo del paciente — no tiene sentido que el staff
// complete "¿cómo te sientes hoy?" en nombre de otra persona.
router.post('/', authorize('patient'), createCheckin);
router.get('/me', authorize('patient'), getTodayCheckin);

export default router;
