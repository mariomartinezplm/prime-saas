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
import { rescheduleAppointment } from '../controllers/rescheduleController.js';
import { getTeamAppointments } from '../controllers/teamCalendarController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Reserva masiva
router.post('/bulk', bulkCreateAppointments);

// Agenda de los demás profesionales (solo lectura, solo el equipo). Va antes de /:id para que no se confunda con un id.
router.get('/team', authorize('admin', 'professional'), getTeamAppointments);

// Rutas de citas
router.route('/')
  .get(getAppointments)
  .post(createAppointment);

router.route('/:id')
  .get(getAppointment)
  .put(authorize('admin', 'professional'), updateAppointment)
  // Borrado definitivo: kinesiólogos (de sus pacientes) y administrador; el paciente no puede
  .delete(authorize('admin', 'professional'), deleteAppointment);

router.get('/:id/ics', getAppointmentICS);
router.put('/:id/cancel', cancelAppointment);
// «Cambiar hora»: el paciente mueve su cita a otra hora, a tiempo
router.put('/:id/reschedule', rescheduleAppointment);

export default router;
