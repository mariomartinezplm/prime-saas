import express from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  getAppointmentICS,
  cancelAppointment,
  updateAppointment,
  deleteAppointment,
  bulkCreateAppointments
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Reserva masiva
router.post('/bulk', bulkCreateAppointments);

// Rutas de citas
router.route('/')
  .get(getAppointments)
  .post(createAppointment);

router.route('/:id')
  .get(getAppointment)
  .put(authorize('admin', 'professional'), updateAppointment)
  // Borrado definitivo: solo admin (un profesional cancela, no borra el registro)
  .delete(authorize('admin'), deleteAppointment);

router.get('/:id/ics', getAppointmentICS);
router.put('/:id/cancel', cancelAppointment);

export default router;
