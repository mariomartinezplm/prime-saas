import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNotificationEmail } from './emailService.js';
import { sendPushToUser } from './pushService.js';

// Tipos que además del registro in-app se espejan por email (Paso 19 de
// BLUEPRINT.md) — los que de verdad requieren que la persona se entere aunque
// no esté mirando la app en ese momento. 'appointment_booked'/'appointment_cancelled'
// quedan fuera a propósito: appointmentController ya manda su propio email
// específico (con más detalle) en el mismo momento; espejarlos aquí también
// duplicaría el correo.
const EMAIL_MIRRORED_TYPES = ['plan_expiring', 'plan_expired', 'wellness_alert', 'evolution_updated'];

// Tipos que además se envían como push al dispositivo (si la persona activó las notificaciones en él).
// El recordatorio del Readiness vence en 6 horas: si el teléfono estuvo apagado, no llega al día siguiente.
export const PUSH_TYPES = {
  readiness_reminder: { ttlSeconds: 6 * 60 * 60 },
  achievement_unlocked: { ttlSeconds: 24 * 60 * 60 }
};

// Crea la notificación in-app y, para los tipos importantes, la espeja por
// email — fire-and-forget para el email (mismo criterio que emailService: un
// correo que no sale nunca debe tumbar el flujo que la disparó), pero el
// registro in-app sí se espera (es lo que hace aparecer la campanita).
export async function notify(userId, type, { title, body, link } = {}) {
  const notification = await Notification.create({ user: userId, type, title, body, link });

  if (EMAIL_MIRRORED_TYPES.includes(type)) {
    User.findById(userId).select('email firstName').then((user) => {
      if (user?.email) {
        sendNotificationEmail({ user, title, body, link });
      }
    }).catch((error) => {
      console.error('Error al buscar destinatario para email de notificación:', error.message);
    });
  }

  return notification;
}

// Aviso "de una sola vez": si ya existe uno con la misma dedupeKey no crea otro y devuelve null.
// Es lo que impide duplicados cuando la página se recarga o el mismo evento se procesa dos veces.
// Solo in-app (sin correo): los avisos de logros y recordatorios no se espejan por email.
export async function notifyOnce(userId, type, { title, body, link, dedupeKey } = {}) {
  if (!dedupeKey) throw new Error('notifyOnce requiere una dedupeKey');
  let notification;
  try {
    notification = await Notification.create({ user: userId, type, title, body, link, dedupeKey });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }

  // Además del aviso dentro de la app, un push al dispositivo para los tipos que lo piden. Solo cuando el aviso
  // se creó AHORA (un duplicado no vuelve a empujar). Fire-and-forget: un push que falla no afecta nada.
  if (PUSH_TYPES[type]) {
    sendPushToUser(userId, { title, body, url: link, tag: type }, { ttlSeconds: PUSH_TYPES[type].ttlSeconds })
      .catch((error) => console.error('Error al enviar push:', error.message));
  }

  return notification;
}
