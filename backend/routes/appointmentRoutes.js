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
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de disponibilidad (accesible para todos los usuarios autenticados)
router.get('/availability/:professionalId/:date', getAvailability);

// Info del plan y restricciones del paciente (solo el propio paciente, su profesional o admin)
router.get('/plan-info/:patientId', authorizePatientAccess('patientId'), getPlanInfo);

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

router.put('/:id/cancel', cancelAppointment);

export default router;
