import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import { sundayKey } from './sundayBookingReminderService.js';
import { notifyOnce } from './notificationService.js';
import { sendNotificationEmail } from './emailService.js';
import { santiagoParts } from '../utils/timezone.js';

/**
 * Recordatorio semanal para agendar horas: los lunes por la mañana (hora de Chile), campanita + correo.
 *
 * Reglas:
 *  - Solo lunes, desde las 08:00 hora de Chile (el programador corre cada 10 minutos; cada paciente recibe UNO por semana).
 *  - Solo a pacientes activos con un plan vigente que todavía tenga sesiones disponibles.
 *  - Si ya tiene una cita agendada esa semana (lunes a domingo), no se le avisa: ya agendó.
 *  - Un solo aviso por paciente por semana (clave `weekly-booking:<paciente>:<lunes>`): reintentos o varias pasadas no duplican.
 *  - Quien ya recibió el aviso del domingo por la noche (planes de 2 o 3 veces por semana) no recibe este además: sería el mismo
 *    recordatorio dos veces con 12 horas de diferencia.
 *  - Texto genérico y amable: sin datos de salud.
 */

export const WEEKLY_REMINDER_HOUR = 8;

export const WEEKLY_REMINDER = {
  title: 'Agenda tus horas de esta semana',
  body: 'Es lunes: reserva ahora tus sesiones de la semana para asegurar tu horario. Puedes agendar con hasta 4 horas de anticipación.',
  link: '/app/reservar'
};

export const weeklyKey = (patientId, monday) => `weekly-booking:${patientId}:${monday}`;
const pad = (n) => String(n).padStart(2, '0');

export async function sendWeeklyBookingReminders({ now = new Date(), limit = 1000 } = {}) {
  const summary = { checked: 0, sent: 0, duplicates: 0, failed: 0 };
  const p = santiagoParts(now);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 1 = lunes
  if (weekday !== 1 || p.hour < WEEKLY_REMINDER_HOUR) return summary;

  const monday = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const weekStart = new Date(`${monday}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const plans = await ClientPlan.find({ status: 'active', endDate: { $gte: now } })
    .select('patient sessionsTotal sessionsUsed unlimited')
    .lean();
  const withSessions = plans.filter((plan) => plan.unlimited || (plan.sessionsTotal ?? 0) > (plan.sessionsUsed ?? 0)).map((plan) => String(plan.patient));
  if (withSessions.length === 0) return summary;

  const alreadyBooked = new Set(
    (await Appointment.distinct('patient', { patient: { $in: withSessions }, status: 'scheduled', date: { $gte: weekStart, $lt: weekEnd } })).map(String)
  );
  const notBooked = [...new Set(withSessions)].filter((id) => !alreadyBooked.has(id));
  if (notBooked.length === 0) return summary;

  // Los que ya recibieron el aviso del domingo para esta misma semana
  const sundayNotified = new Set(
    (await Notification.find({ dedupeKey: { $in: notBooked.map((id) => sundayKey(id, monday)) } }).select('user').lean()).map((n) => String(n.user))
  );
  const candidates = notBooked.filter((id) => !sundayNotified.has(id));
  if (candidates.length === 0) return summary;

  const patients = await User.find({ _id: { $in: candidates }, role: 'patient', isActive: true }).select('_id email firstName').lean();

  for (const patient of patients.slice(0, limit)) {
    summary.checked += 1;
    try {
      const created = await notifyOnce(patient._id, 'weekly_booking_reminder', { ...WEEKLY_REMINDER, dedupeKey: weeklyKey(String(patient._id), monday) });
      if (!created) {
        summary.duplicates += 1;
        continue;
      }
      summary.sent += 1;
      if (patient.email) {
        // Un correo que no sale no debe tumbar la pasada (mismo criterio que el resto de los avisos)
        sendNotificationEmail({ user: patient, ...WEEKLY_REMINDER }).catch((error) => console.error('Error enviando correo semanal:', error.message));
      }
    } catch (error) {
      summary.failed += 1;
      console.error('Error enviando recordatorio semanal:', error.message);
    }
  }

  return summary;
}
