import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNotificationEmail } from './emailService.js';

// Tipos que además del registro in-app se espejan por email (Paso 19 de
// BLUEPRINT.md) — los que de verdad requieren que la persona se entere aunque
// no esté mirando la app en ese momento. 'appointment_booked'/'appointment_cancelled'
// quedan fuera a propósito: appointmentController ya manda su propio email
// específico (con más detalle) en el mismo momento; espejarlos aquí también
// duplicaría el correo.
const EMAIL_MIRRORED_TYPES = ['plan_expiring', 'plan_expired', 'wellness_alert', 'evolution_updated'];

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
