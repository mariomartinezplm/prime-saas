import express from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  cancelAppointment,
  updateAppointment,
  getAvailability,
  deleteAppointment,
  bulkCreateAppointments,
  getPlanInfo
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de disponibilidad (accesible para todos los usuarios autenticados)
router.get('/availability/:professionalId/:date', getAvailability);

// Info del plan y restricciones del paciente
router.get('/plan-info/:patientId', getPlanInfo);

// Reserva masiva
router.post('/bulk', bulkCreateAppointments);

// Rutas de citas
router.route('/')
  .get(getAppointments)
  .post(createAppointment);

router.route('/:id')
  .get(getAppointment)
  .put(authorize('admin', 'professional'), updateAppointment)
  .delete(authorize('admin', 'professional'), deleteAppointment);

router.put('/:id/cancel', cancelAppointment);

export default router;
