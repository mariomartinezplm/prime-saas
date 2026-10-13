import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import WellnessCheckin from '../models/WellnessCheckin.js';
import { notifyOnce } from './notificationService.js';
import { santiagoParts } from '../utils/timezone.js';

/**
 * Recordatorio diario del Readiness.
 *
 * Es una notificación DENTRO de la app (campanita). No es una notificación push del celular: esa
 * infraestructura no existe todavía y no se simula.
 *
 * Reglas:
 *  - Solo a pacientes activos con plan vigente (sin plan no pueden registrar el Readiness).
 *  - Respeta la preferencia: activado por defecto, a las 20:00 (hora de Santiago) salvo que elijan otra.
 *  - Si ya lo completaron hoy, no se envía.
 *  - Un solo aviso por paciente por día (clave `readiness:<paciente>:<día>`): recargar, reintentar o que el
 *    programador corra varias veces no duplica nada.
 *  - El texto es genérico y amable: sin cifras, sin datos de salud, sin presión.
 */

export const DEFAULT_REMINDER = { enabled: true, hour: 20 };

export const READINESS_REMINDER_NOTIFICATION = {
  title: '¿Cómo estás hoy?',
  body: 'Tu Readiness de hoy está listo para completarse. Te toma menos de un minuto.',
  link: '/app/dashboard?readiness=1'
};

export const reminderKey = (patientId, day) => `readiness:${patientId}:${day}`;
const pad = (n) => String(n).padStart(2, '0');

export function reminderPreference(user) {
  const pref = user?.preferences?.readinessReminder ?? {};
  return {
    enabled: pref.enabled !== false,
    hour: Number.isInteger(pref.hour) ? pref.hour : DEFAULT_REMINDER.hour
  };
}

export async function sendReadinessReminders({ now = new Date(), limit = 1000 } = {}) {
  const p = santiagoParts(now);
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const summary = { checked: 0, sent: 0, duplicates: 0, failed: 0 };

  const [withPlan, doneToday] = await Promise.all([
    ClientPlan.distinct('patient', { status: 'active', endDate: { $gte: now } }),
    WellnessCheckin.distinct('patient', { date: today })
  ]);
  const done = new Set(doneToday.map(String));
  const candidates = withPlan.filter((id) => !done.has(String(id)));
  if (candidates.length === 0) return summary;

  const patients = await User.find({
    _id: { $in: candidates },
    role: 'patient',
    isActive: true,
    'preferences.readinessReminder.enabled': { $ne: false }
  }).select('_id preferences').lean();

  for (const patient of patients.slice(0, limit)) {
    summary.checked += 1;
    const { enabled, hour } = reminderPreference(patient);
    if (!enabled || p.hour < hour) continue;

    try {
      const created = await notifyOnce(patient._id, 'readiness_reminder', {
        ...READINESS_REMINDER_NOTIFICATION,
        dedupeKey: reminderKey(String(patient._id), today)
      });
      if (created) summary.sent += 1;
      else summary.duplicates += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('Error enviando recordatorio de Readiness:', error.message);
    }
  }

  return summary;
}
