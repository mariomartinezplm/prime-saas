import Appointment from '../models/Appointment.js';
import { startOfDay, endOfDay } from 'date-fns';
import { nowInSantiago } from '../utils/timezone.js';

export { nowInSantiago };

export const MAX_PATIENTS_PER_SLOT = 4;        // Máximo 4 pacientes simultáneos por profesional
export const PATIENT_BOOK_AHEAD_HOURS = 4;     // Pacientes: mínimo 4h de anticipación para agendar
export const PATIENT_CANCEL_AHEAD_HOURS = 4;   // Pacientes: mínimo 4h de anticipación para cancelar sin perder la sesión
export const BULK_BOOKING_MAX_ITEMS = 20;      // Tope de citas por reserva masiva

// Cuenta las citas que se solapan con el slot de 1 hora que empieza en
// targetStartTime — mismo criterio en todo el sistema: (cita.inicio < slot.fin)
// Y (cita.fin > slot.inicio). Única fuente de verdad para "¿cuántos pacientes
// hay en este horario?", usada tanto al validar una reserva como al listar
// los slots disponibles.
export async function countOverlappingAppointments(professionalId, date, targetStartTime) {
  const targetDate = new Date(date);
  const [hours, minutes] = targetStartTime.split(':').map(Number);
  const targetEndTime = `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return Appointment.countDocuments({
    professional: professionalId,
    date: { $gte: startOfDay(targetDate), $lte: endOfDay(targetDate) },
    startTime: { $lt: targetEndTime },
    endTime: { $gt: targetStartTime },
    status: { $ne: 'cancelled' }
  });
}
