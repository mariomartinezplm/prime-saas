import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { startOfDay, endOfDay } from 'date-fns';
import { nowInSantiago } from '../utils/timezone.js';

export { nowInSantiago };

export const MAX_PATIENTS_PER_SLOT = 4;        // Máximo 4 pacientes simultáneos por profesional (lo que pueden agendar los pacientes)
export const MAX_PATIENTS_WITH_OVERBOOK = 5;   // Con 1 sobrecupo del equipo: máximo 5 por profesional en cualquier hora (nadie puede pasar de 5)
export const PATIENT_BOOK_AHEAD_HOURS = 2;     // Pacientes: mínimo 2h de anticipación para agendar (el personal agenda en cualquier momento)
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
    status: { $ne: 'cancelled' },
    // Los pacientes "sobre cupo" no ocupan lugar en el máximo
    outsideCapacity: { $ne: true }
  });
}

// ¿Quién puede agendar el sobrecupo (el 5.º paciente de una hora)? El administrador en cualquier agenda; un profesional, solo en la suya.
// Los pacientes nunca: solo pueden agendar hasta 4.
export function canOverbookFor(user, professionalId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'professional' && String(user._id) === String(professionalId);
}

// Qué pasa al agendar en un horario que ya tiene `count` pacientes:
//   'ok'            hay cupo normal (menos de 4)
//   'overbook'      ya hay 4 y quien agenda puede usar el sobrecupo → la cita queda marcada como sobrecupo
//   'needs-overbook' ya hay 4 y quien agenda no puede usar el sobrecupo
//   'full'          ya hay 5: nadie puede agendar más (ni el administrador)
export function capacityVerdict(count, mayOverbook) {
  if (count >= MAX_PATIENTS_WITH_OVERBOOK) return 'full';
  if (count >= MAX_PATIENTS_PER_SLOT) return mayOverbook ? 'overbook' : 'needs-overbook';
  return 'ok';
}

// ¿Este paciente puede agendar aunque el horario esté lleno (y no cuenta en el máximo)?
export async function isExemptFromCapacity(patientId) {
  if (!patientId) return false;
  const patient = await User.findById(patientId, 'exemptFromCapacity role');
  return !!patient && patient.role === 'patient' && patient.exemptFromCapacity === true;
}
