/**
 * PRUEBAS — notificaciones push (Web Push + VAPID).
 *
 * `web-push` se simula: aquí se prueba NUESTRA lógica (configuración, validación, limpieza de dispositivos,
 * privacidad del contenido, permisos). El envío real a un navegador no se puede probar desde las pruebas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
    generateVAPIDKeys: vi.fn(() => ({ publicKey: 'x', privateKey: 'y' }))
  }
}));
import webpush from 'web-push';

import PushSubscription from '../models/PushSubscription.js';
import Notification from '../models/Notification.js';
import { pushConfigStatus, isPushConfigured } from '../utils/pushConfig.js';
import { sendPushToUser, saveSubscription, safeUrl, MAX_SUBSCRIPTIONS_PER_USER } from '../services/pushService.js';
import { notifyOnce, PUSH_TYPES } from '../services/notificationService.js';
import { getPushStatus, subscribe, unsubscribe, validSubscription } from '../controllers/pushController.js';
import pushRouter from '../routes/pushRoutes.js';
import { getHealth } from '../controllers/healthController.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// Claves con el formato real (87 y 43 caracteres base64url)
const PUBLICA = 'B'.repeat(87);
const PRIVADA = 'a'.repeat(43);
const ENV_OK = { VAPID_PUBLIC_KEY: PUBLICA, VAPID_PRIVATE_KEY: PRIVADA, VAPID_SUBJECT: 'mailto:contacto@primefh.cl' };
const sub = (n = 1) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/abc${n}`, keys: { p256dh: 'p256dh_key-1', auth: 'auth_key-1' } });

let envAntes;
beforeEach(() => {
  vi.restoreAllMocks();
  webpush.sendNotification.mockReset();
  webpush.setVapidDetails.mockReset();
  envAntes = { ...process.env };
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in envAntes)) delete process.env[k];
  Object.assign(process.env, envAntes);
});
const conVapid = () => Object.assign(process.env, ENV_OK);

describe('configuración VAPID', () => {
  it('off / incomplete / on, sin mostrar valores', () => {
    expect(pushConfigStatus({})).toBe('off');
    expect(pushConfigStatus({ VAPID_PUBLIC_KEY: PUBLICA })).toBe('incomplete');
    expect(pushConfigStatus({ ...ENV_OK, VAPID_SUBJECT: 'contacto' })).toBe('incomplete');
    expect(pushConfigStatus({ ...ENV_OK, VAPID_PUBLIC_KEY: 'corta' })).toBe('incomplete');
    expect(pushConfigStatus({ ...ENV_OK, VAPID_PRIVATE_KEY: 'corta' })).toBe('incomplete');
    expect(pushConfigStatus(ENV_OK)).toBe('on');
    expect(pushConfigStatus({ ...ENV_OK, VAPID_SUBJECT: 'https://app.primefh.cl' })).toBe('on');
    expect(isPushConfigured(ENV_OK)).toBe(true);
  });

  it('tolera comillas pegadas por error al cargar la variable', () => {
    expect(pushConfigStatus({ ...ENV_OK, VAPID_PUBLIC_KEY: `"${PUBLICA}"` })).toBe('on');
  });

  it('/api/health informa push sin exponer ninguna clave', () => {
    conVapid();
    const res = fakeRes();
    getHealth({}, res);
    expect(res.body.push).toBe('on');
    expect(JSON.stringify(res.body)).not.toContain(PRIVADA);
    expect(JSON.stringify(res.body)).not.toContain(PUBLICA);
  });
});

describe('validación de la suscripción', () => {
  it('acepta una suscripción real y rechaza endpoints o claves inválidas', () => {
    expect(validSubscription(sub())).toBe(true);
    expect(validSubscription(null)).toBe(false);
    expect(validSubscription({})).toBe(false);
    expect(validSubscription({ ...sub(), endpoint: 'http://inseguro.com/x' })).toBe(false);
    expect(validSubscription({ ...sub(), endpoint: 'javascript:alert(1)' })).toBe(false);
    expect(validSubscription({ ...sub(), endpoint: 'https://' + 'a'.repeat(2100) })).toBe(false);
    expect(validSubscription({ endpoint: sub().endpoint, keys: { p256dh: 'ok' } })).toBe(false);
    expect(validSubscription({ endpoint: sub().endpoint, keys: { p256dh: 'con espacios', auth: 'x' } })).toBe(false);
  });
});

describe('API de push', () => {
  it('sin claves VAPID: /status dice que no está disponible y subscribe responde 503 (no se simula nada)', async () => {
    const res = fakeRes();
    vi.spyOn(PushSubscription, 'countDocuments').mockResolvedValue(0);
    await getPushStatus({ user: { _id: nuevoId() } }, res);
    expect(res.body.data).toEqual({ configured: false, publicKey: null, subscribedDevices: 0 });

    const sin = fakeRes();
    const save = vi.spyOn(PushSubscription, 'findOneAndUpdate');
    await subscribe({ user: { _id: nuevoId() }, body: { subscription: sub() }, get: () => 'UA' }, sin);
    expect(sin.statusCode).toBe(503);
    expect(sin.body.code).toBe('PUSH_NOT_CONFIGURED');
    expect(save).not.toHaveBeenCalled();
  });

  it('con claves: /status entrega solo la clave PÚBLICA y la cantidad de dispositivos del usuario', async () => {
    conVapid();
    vi.spyOn(PushSubscription, 'countDocuments').mockResolvedValue(2);
    const res = fakeRes();
    const userId = nuevoId();
    await getPushStatus({ user: { _id: userId } }, res);
    expect(res.body.data).toEqual({ configured: true, publicKey: PUBLICA, subscribedDevices: 2 });
    expect(PushSubscription.countDocuments).toHaveBeenCalledWith({ user: userId });
    expect(JSON.stringify(res.body)).not.toContain(PRIVADA);
  });

  it('subscribe guarda el dispositivo del usuario autenticado y rechaza una suscripción inválida', async () => {
    conVapid();
    const guardar = vi.spyOn(PushSubscription, 'findOneAndUpdate').mockResolvedValue({});
    vi.spyOn(PushSubscription, 'find').mockReturnValue({ sort: () => ({ select: () => Promise.resolve([{ _id: 1 }]) }) });
    vi.spyOn(PushSubscription, 'countDocuments').mockResolvedValue(1);
    const userId = nuevoId();

    const ok = fakeRes();
    await subscribe({ user: { _id: userId }, body: { subscription: sub() }, get: () => 'Mozilla/5.0' }, ok);
    expect(ok.statusCode).toBe(201);
    expect(guardar).toHaveBeenCalledWith(
      { endpoint: sub().endpoint },
      { $set: expect.objectContaining({ user: userId, failureCount: 0, userAgent: 'Mozilla/5.0' }) },
      expect.anything()
    );
    // las claves de cifrado del navegador no vuelven en la respuesta
    expect(JSON.stringify(ok.body)).not.toContain('p256dh_key');

    guardar.mockClear();
    const mal = fakeRes();
    await subscribe({ user: { _id: userId }, body: { subscription: { endpoint: 'http://x' } }, get: () => '' }, mal);
    expect(mal.statusCode).toBe(400);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('unsubscribe solo borra la suscripción del propio usuario', async () => {
    const borrar = vi.spyOn(PushSubscription, 'deleteOne').mockResolvedValue({});
    vi.spyOn(PushSubscription, 'countDocuments').mockResolvedValue(0);
    const userId = nuevoId();
    const res = fakeRes();
    await unsubscribe({ user: { _id: userId }, body: { endpoint: sub().endpoint } }, res);
    expect(borrar).toHaveBeenCalledWith({ user: userId, endpoint: sub().endpoint });
    expect(res.statusCode).toBe(200);

    const mal = fakeRes();
    await unsubscribe({ user: { _id: userId }, body: { endpoint: 'no-es-url' } }, mal);
    expect(mal.statusCode).toBe(400);
  });

  it('todas las rutas exigen sesión (protect)', () => {
    expect(pushRouter.stack[0].name).toBe('protect');
    expect(pushRouter.stack.filter((l) => l.route)).toHaveLength(3);
  });

  it('un mismo navegador reasignado a otra persona: la suscripción cambia de dueño (upsert por endpoint)', async () => {
    const guardar = vi.spyOn(PushSubscription, 'findOneAndUpdate').mockResolvedValue({});
    vi.spyOn(PushSubscription, 'find').mockReturnValue({ sort: () => ({ select: () => Promise.resolve([]) }) });
    const nuevo = nuevoId();
    await saveSubscription(nuevo, sub(), 'UA');
    expect(guardar.mock.calls[0][0]).toEqual({ endpoint: sub().endpoint });
    expect(guardar.mock.calls[0][1].$set.user).toBe(nuevo);
  });

  it('se conservan como máximo 8 dispositivos por usuario (los más recientes)', async () => {
    vi.spyOn(PushSubscription, 'findOneAndUpdate').mockResolvedValue({});
    const todas = Array.from({ length: MAX_SUBSCRIPTIONS_PER_USER + 3 }, (_, i) => ({ _id: `id${i}` }));
    vi.spyOn(PushSubscription, 'find').mockReturnValue({ sort: () => ({ select: () => Promise.resolve(todas) }) });
    const borrar = vi.spyOn(PushSubscription, 'deleteMany').mockResolvedValue({});
    await saveSubscription(nuevoId(), sub(), 'UA');
    expect(borrar).toHaveBeenCalledWith({ _id: { $in: ['id8', 'id9', 'id10'] } });
  });
});

describe('envío de push', () => {
  const dispositivo = (n, extra = {}) => ({ _id: `d${n}`, endpoint: sub(n).endpoint, keys: sub(n).keys, failureCount: 0, ...extra });

  it('sin claves VAPID no intenta enviar nada', async () => {
    const find = vi.spyOn(PushSubscription, 'find');
    const result = await sendPushToUser(nuevoId(), { title: 'T', body: 'B' });
    expect(result).toEqual({ attempted: 0, accepted: 0, removed: 0, failed: 0 });
    expect(find).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('envía a todos los dispositivos del usuario con título y texto genéricos y una ruta interna', async () => {
    conVapid();
    vi.spyOn(PushSubscription, 'find').mockResolvedValue([dispositivo(1), dispositivo(2)]);
    vi.spyOn(PushSubscription, 'updateOne').mockResolvedValue({});
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await sendPushToUser(nuevoId(), { title: 'Nuevo logro desbloqueado', body: 'Tienes un reconocimiento nuevo.', url: '/app/logros', tag: 'achievement_unlocked' }, { ttlSeconds: 3600 });

    expect(result).toMatchObject({ attempted: 2, accepted: 2, removed: 0, failed: 0 });
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:contacto@primefh.cl', PUBLICA, PRIVADA);
    const [subscription, payload, options] = webpush.sendNotification.mock.calls[0];
    expect(subscription.endpoint).toBe(sub(1).endpoint);
    expect(JSON.parse(payload)).toEqual({ title: 'Nuevo logro desbloqueado', body: 'Tienes un reconocimiento nuevo.', url: '/app/logros', tag: 'achievement_unlocked' });
    expect(options).toMatchObject({ TTL: 3600 });
  });

  it('un 404 o 410 borra el dispositivo (ya no existe) y no cuenta como fallo', async () => {
    conVapid();
    vi.spyOn(PushSubscription, 'find').mockResolvedValue([dispositivo(1), dispositivo(2)]);
    vi.spyOn(PushSubscription, 'updateOne').mockResolvedValue({});
    const borrar = vi.spyOn(PushSubscription, 'deleteOne').mockResolvedValue({});
    webpush.sendNotification.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 })).mockResolvedValueOnce({});

    const result = await sendPushToUser(nuevoId(), { title: 'T', body: 'B' });

    expect(result).toMatchObject({ attempted: 2, accepted: 1, removed: 1, failed: 0 });
    expect(borrar).toHaveBeenCalledWith({ _id: 'd1' });
  });

  it('otros errores suman fallos y tras 5 seguidos se borra el dispositivo; nunca lanza', async () => {
    conVapid();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(PushSubscription, 'find').mockResolvedValue([dispositivo(1, { failureCount: 2 }), dispositivo(2, { failureCount: 4 })]);
    const actualizar = vi.spyOn(PushSubscription, 'updateOne').mockResolvedValue({});
    const borrar = vi.spyOn(PushSubscription, 'deleteOne').mockResolvedValue({});
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error('temporal'), { statusCode: 500 }));

    const result = await sendPushToUser(nuevoId(), { title: 'T', body: 'B' });

    expect(result).toMatchObject({ failed: 2, removed: 1, accepted: 0 });
    expect(actualizar).toHaveBeenCalledWith({ _id: 'd1' }, { $set: { failureCount: 3 } });
    expect(borrar).toHaveBeenCalledWith({ _id: 'd2' });
  });

  it('nunca envía una URL externa: solo rutas internas de la app', () => {
    expect(safeUrl('/app/dashboard?readiness=1')).toBe('/app/dashboard?readiness=1');
    expect(safeUrl('/app/logros')).toBe('/app/logros');
    expect(safeUrl('https://malo.com')).toBe('/app/dashboard');
    expect(safeUrl('//malo.com')).toBe('/app/dashboard');
    expect(safeUrl('/appx')).toBe('/app/dashboard');
    expect(safeUrl(undefined)).toBe('/app/dashboard');
  });

  it('recorta título y texto para que no crezcan', async () => {
    conVapid();
    vi.spyOn(PushSubscription, 'find').mockResolvedValue([dispositivo(1)]);
    vi.spyOn(PushSubscription, 'updateOne').mockResolvedValue({});
    webpush.sendNotification.mockResolvedValue({});
    await sendPushToUser(nuevoId(), { title: 'x'.repeat(500), body: 'y'.repeat(500), url: '/app/logros' });
    const payload = JSON.parse(webpush.sendNotification.mock.calls[0][1]);
    expect(payload.title).toHaveLength(100);
    expect(payload.body).toHaveLength(200);
  });
});

describe('avisos que además salen como push', () => {
  const pausa = () => new Promise((r) => setTimeout(r, 0));

  it('el recordatorio y el logro generan push UNA vez, solo cuando el aviso se creó ahora', async () => {
    conVapid();
    const creados = [];
    vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
      if (creados.some((n) => n.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
      creados.push(doc);
      return doc;
    });
    vi.spyOn(PushSubscription, 'find').mockResolvedValue([{ _id: 'd1', endpoint: sub(1).endpoint, keys: sub(1).keys, failureCount: 0 }]);
    vi.spyOn(PushSubscription, 'updateOne').mockResolvedValue({});
    webpush.sendNotification.mockResolvedValue({});

    const userId = nuevoId();
    const datos = { title: '¿Cómo estás hoy?', body: 'Tu Readiness está listo.', link: '/app/dashboard?readiness=1', dedupeKey: 'readiness:u:2026-10-14' };
    await notifyOnce(userId, 'readiness_reminder', datos);
    await notifyOnce(userId, 'readiness_reminder', datos); // duplicado
    await pausa();

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webpush.sendNotification.mock.calls[0][2]).toMatchObject({ TTL: PUSH_TYPES.readiness_reminder.ttlSeconds });
  });

  it('el recordatorio del domingo para agendar también sale al teléfono, con su propio vencimiento y llevando a Reservar', async () => {
    conVapid();
    vi.spyOn(Notification, 'create').mockImplementation(async (doc) => doc);
    vi.spyOn(PushSubscription, 'find').mockResolvedValue([{ _id: 'd1', endpoint: sub(1).endpoint, keys: sub(1).keys, failureCount: 0 }]);
    vi.spyOn(PushSubscription, 'updateOne').mockResolvedValue({});
    webpush.sendNotification.mockResolvedValue({});
    await notifyOnce(nuevoId(), 'sunday_booking_reminder', { title: 'Agenda tu semana de entrenamiento', body: 'Mañana empieza tu semana y te falta agendar 1 sesión.', link: '/app/reservar', dedupeKey: 'sunday-booking:p:2026-10-26' });
    await pausa();
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(PUSH_TYPES.sunday_booking_reminder.ttlSeconds).toBe(3 * 60 * 60);
    expect(webpush.sendNotification.mock.calls[0][2]).toMatchObject({ TTL: 3 * 60 * 60 });
    const payload = JSON.parse(webpush.sendNotification.mock.calls[0][1]);
    expect(payload).toMatchObject({ url: '/app/reservar', tag: 'sunday_booking_reminder' });
    expect(JSON.stringify(payload)).not.toMatch(/dolor|lesi|diagn/i); // sin datos de salud en la pantalla bloqueada
  });

  it('el aviso general de los lunes y los cumpleaños siguen sin push (no se pidió)', () => {
    expect(PUSH_TYPES.weekly_booking_reminder).toBeUndefined();
    expect(PUSH_TYPES.birthday_week).toBeUndefined();
  });

  it('un tipo que no está en la lista no genera push', async () => {
    conVapid();
    vi.spyOn(Notification, 'create').mockImplementation(async (doc) => doc);
    const find = vi.spyOn(PushSubscription, 'find');
    await notifyOnce(nuevoId(), 'plan_expiring', { title: 'T', body: 'B', dedupeKey: 'k' });
    await pausa();
    expect(find).not.toHaveBeenCalled();
  });

  it('si el push falla, el aviso dentro de la app igual se crea', async () => {
    conVapid();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Notification, 'create').mockImplementation(async (doc) => doc);
    vi.spyOn(PushSubscription, 'find').mockRejectedValue(new Error('base caída'));
    const result = await notifyOnce(nuevoId(), 'achievement_unlocked', { title: 'T', body: 'B', link: '/app/logros', dedupeKey: 'k2' });
    expect(result).toMatchObject({ type: 'achievement_unlocked' });
  });
});
