import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import { getVapidConfig, isPushConfigured } from '../utils/pushConfig.js';

/**
 * Notificaciones push del dispositivo (Web Push + VAPID).
 *
 * Qué significa "enviado": el servicio de push del navegador (Google, Mozilla, Apple) ACEPTÓ el mensaje. No
 * confirma que se mostró ni que el dispositivo estaba encendido: eso no lo informa nadie. Por eso `sent` se
 * llama "accepted" y la app nunca afirma "se entregó".
 *
 * Privacidad: el contenido que se envía es solo el título y el texto genéricos de la notificación (visibles en
 * la pantalla bloqueada) y una ruta interna. Nunca datos clínicos ni corporales.
 */

export { isPushConfigured };

export const MAX_SUBSCRIPTIONS_PER_USER = 8;
const MAX_FAILURES = 5;

// Se configura en cada envío (es barato) en vez de guardarlo: así un cambio de variables se toma sin estado viejo.
function ensureConfigured() {
  if (!isPushConfigured()) return false;
  const { publicKey, privateKey, subject } = getVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

// Solo rutas internas de la app: nunca una URL externa que alguien pudiera inyectar
export const safeUrl = (url) => (typeof url === 'string' && /^\/app(\/|\?|$)/.test(url) ? url : '/app/dashboard');

export async function saveSubscription(userId, subscription, userAgent) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        user: userId,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : undefined,
        failureCount: 0
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Tope por usuario: se conservan las más recientes
  const all = await PushSubscription.find({ user: userId }).sort({ updatedAt: -1 }).select('_id');
  const extra = all.slice(MAX_SUBSCRIPTIONS_PER_USER);
  if (extra.length > 0) await PushSubscription.deleteMany({ _id: { $in: extra.map((s) => s._id) } });
}

export const removeSubscription = (userId, endpoint) => PushSubscription.deleteOne({ user: userId, endpoint });

export const countSubscriptions = (userId) => PushSubscription.countDocuments({ user: userId });

/**
 * Envía un push a todos los dispositivos suscritos del usuario.
 * payload: { title, body, url, tag }   options: { ttlSeconds }
 * Devuelve { attempted, accepted, removed, failed }. Nunca lanza error: un push que falla no debe tumbar nada.
 */
export async function sendPushToUser(userId, payload, { ttlSeconds = 24 * 60 * 60 } = {}) {
  const summary = { attempted: 0, accepted: 0, removed: 0, failed: 0 };
  if (!ensureConfigured()) return summary;

  let subscriptions;
  try {
    subscriptions = await PushSubscription.find({ user: userId });
  } catch (error) {
    console.error('Error al leer suscripciones push:', error.message);
    return summary;
  }
  if (subscriptions.length === 0) return summary;

  const body = JSON.stringify({
    title: String(payload.title ?? '').slice(0, 100),
    body: String(payload.body ?? '').slice(0, 200),
    url: safeUrl(payload.url),
    tag: payload.tag ? String(payload.tag).slice(0, 60) : undefined
  });

  for (const sub of subscriptions) {
    summary.attempted += 1;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        body,
        { TTL: ttlSeconds, urgency: 'normal' }
      );
      summary.accepted += 1;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { failureCount: 0, lastSuccessAt: new Date() } });
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        // El navegador ya no existe o se dio de baja: se borra para no insistir
        await PushSubscription.deleteOne({ _id: sub._id });
        summary.removed += 1;
      } else {
        summary.failed += 1;
        const failures = (sub.failureCount ?? 0) + 1;
        if (failures >= MAX_FAILURES) {
          await PushSubscription.deleteOne({ _id: sub._id });
          summary.removed += 1;
        } else {
          await PushSubscription.updateOne({ _id: sub._id }, { $set: { failureCount: failures } });
        }
        console.error('Error al enviar push:', error?.statusCode ?? '', error?.message);
      }
    }
  }

  return summary;
}
