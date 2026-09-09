import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getAuthUrl,
  handleCallback,
  disconnect,
  getStatus,
  syncAppointment
} from '../controllers/googleCalendarController.js';

const router = express.Router();

// Solo staff (admin/profesional) sincroniza su propio calendario. Los
// pacientes tienen su propia vía sin OAuth: descargar el .ics (Paso 28.B).
router.use(protect, authorize('admin', 'professional'));

router.get('/auth-url', getAuthUrl);
router.post('/callback', handleCallback);
router.post('/disconnect', disconnect);
router.get('/status', getStatus);
router.post('/sync/:appointmentId', syncAppointment);

export default router;
