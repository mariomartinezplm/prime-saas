import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import Appointment from '../models/Appointment.js';
import { notifyOnce } from './notificationService.js';
import { sendNotificationEmail } from './emailService.js';
import { santiagoParts } from '../utils/timezone.js';

/**
 * Recordatorio de los domingos por la noche (hora de Chile) para quienes vienen 2 o 3 veces por semana: campanita + correo, si
 * todavía no agendaron todas las sesiones de la semana que empieza mañana.
 *
 * Reglas:
 *  - Solo domingo, entre las 20:00 y las 22:00 hora de Chile (el programador corre cada 10 minutos). Pasadas las 22:00 ya no se
 *    manda: un aviso a medianoche por un servidor que estuvo caído sería peor que no mandarlo.
 *  - Solo planes de entrenamiento NO ilimitados de 8 sesiones al mes (2 por semana) o de 12 (3 por semana), con el plan
 *    vigente. Los demás planes no tienen una frecuencia semanal clara y siguen con el aviso general de los lunes.
 *  - Cuenta las citas de entrenamiento de la semana que empieza mañana (lunes a domingo) que no están canceladas. Si faltan para
 *    llegar a las de su frecuencia, y le quedan sesiones en el plan, se le avisa cuántas le faltan.
 *  - Un solo aviso por paciente por semana (clave `sunday-booking:<paciente>:<lunes>`).
 *  - Texto amable y genérico: sin datos de salud.
 */

export const SUNDAY_REMINDER_FROM_HOUR = 20;
export const SUNDAY_REMINDER_UNTIL_HOUR = 22;
export const SESSIONS_PER_WEEK = { 8: 2, 12: 3 };
const SUNDAY = 0;

export const sundayKey = (patientId, monday) => `sunday-booking:${patientId}:${monday}`;
const pad = (n) => String(n).padStart(2, '0');

export const sundayMessage = (missing) => ({
  title: 'Agenda tu semana de entrenamiento',
  body: missing === 1
    ? 'Mañana empieza tu semana y te falta agendar 1 sesión. Reserva ahora para asegurar tu horario; puedes agendar con hasta 4 horas de anticipación.'
    : `Mañana empieza tu semana y te faltan ${missing} sesiones por agendar. Reserva ahora para asegurar tu horario; puedes agendar con hasta 4 horas de anticipación.`,
  link: '/app/reservar'
});

export async function sendSundayBookingReminders({ now = new Date(), limit = 1000 } = {}) {
  const summary = { checked: 0, sent: 0, duplicates: 0, failed: 0 };
  const p = santiagoParts(now);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  if (weekday !== SUNDAY || p.hour < SUNDAY_REMINDER_FROM_HOUR || p.hour >= SUNDAY_REMINDER_UNTIL_HOUR) return summary;

  // La semana que viene: el lunes es mañana
  const mondayDate = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const monday = `${mondayDate.getUTCFullYear()}-${pad(mondayDate.getUTCMonth() + 1)}-${pad(mondayDate.getUTCDate())}`;
  const weekStart = new Date(`${monday}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const plans = await ClientPlan.find({
    status: 'active',
    serviceType: 'entrenamiento',
    unlimited: { $ne: true },
    sessionsTotal: { $in: Object.keys(SESSIONS_PER_WEEK).map(Number) },
    endDate: { $gte: now }
  }).select('patient sessionsTotal sessionsUsed').lean();

  // Por paciente: cuántas sesiones por semana le tocan y cuántas le quedan en el plan
  const wanted = new Map();
  for (const plan of plans) {
    const remaining = (plan.sessionsTotal ?? 0) - (plan.sessionsUsed ?? 0);
    if (remaining <= 0) continue;
    wanted.set(String(plan.patient), { perWeek: SESSIONS_PER_WEEK[plan.sessionsTotal], remaining });
  }
  if (wanted.size === 0) return summary;

  const booked = await Appointment.find({
    patient: { $in: [...wanted.keys()] },
    type: 'entrenamiento',
    status: { $ne: 'cancelled' },
    date: { $gte: weekStart, $lt: weekEnd }
  }).select('patient').lean();
  const bookedCount = new Map();
  for (const appointment of booked) bookedCount.set(String(appointment.patient), (bookedCount.get(String(appointment.patient)) ?? 0) + 1);

  const missingBy = new Map();
  for (const [patientId, { perWeek, remaining }] of wanted) {
    const missing = Math.min(perWeek - (bookedCount.get(patientId) ?? 0), remaining);
    if (missing > 0) missingBy.set(patientId, missing);
  }
  if (missingBy.size === 0) return summary;

  const patients = await User.find({ _id: { $in: [...missingBy.keys()] }, role: 'patient', isActive: true, isProspect: { $ne: true } })
    .select('_id email firstName').lean();

  for (const patient of patients.slice(0, limit)) {
    summary.checked += 1;
    try {
      const message = sundayMessage(missingBy.get(String(patient._id)));
      const created = await notifyOnce(patient._id, 'sunday_booking_reminder', { ...message, dedupeKey: sundayKey(String(patient._id), monday) });
      if (!created) {
        summary.duplicates += 1;
        continue;
      }
      summary.sent += 1;
      if (patient.email) {
        // Un correo que no sale no debe tumbar la pasada (mismo criterio que el resto de los avisos)
        sendNotificationEmail({ user: patient, ...message }).catch((error) => console.error('Error enviando correo del domingo:', error.message));
      }
    } catch (error) {
      summary.failed += 1;
      console.error('Error enviando recordatorio del domingo:', error.message);
    }
  }

  return summary;
}
