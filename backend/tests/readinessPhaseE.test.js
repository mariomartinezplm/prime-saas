/**
 * PRUEBAS — Fase E del plan de logros: Readiness diario, recordatorio y preferencias.
 *
 * El recordatorio es una notificación DENTRO de la app (no push). Mismo patrón que el resto de
 * backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import WellnessCheckin from '../models/WellnessCheckin.js';
import Notification from '../models/Notification.js';
import { santiagoToUtc } from '../utils/timezone.js';
import {
  sendReadinessReminders,
  reminderPreference,
  reminderKey,
  DEFAULT_REMINDER,
  READINESS_REMINDER_NOTIFICATION
} from '../services/readinessReminderService.js';
import { computeReadinessCandidates, findReadinessWindow, readinessWeekProgress } from '../services/achievements/readiness.js';
import { getReminderPreference, updateReminderPreference } from '../controllers/wellnessController.js';
import { ACHIEVEMENTS } from '../config/achievements.js';
import wellnessRouter from '../routes/wellnessRoutes.js';
import { authorize } from '../middleware/auth.js';

vi.mock('../services/achievements/index.js', () => ({
  triggerAchievementEvaluation: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// 14 de octubre de 2026, a la hora de Santiago indicada
const a = (hora, minuto = 0, dia = 14) => santiagoToUtc(2026, 10, dia, hora, minuto);

function escenario({ conPlan = [], hechos = [], pacientes = [] }) {
  vi.spyOn(ClientPlan, 'distinct').mockResolvedValue(conPlan);
  vi.spyOn(WellnessCheckin, 'distinct').mockResolvedValue(hechos);
  const buscar = vi.spyOn(User, 'find').mockImplementation(() => ({ select: () => ({ lean: () => Promise.resolve(pacientes) }) }));
  const avisos = [];
  vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
    if (avisos.some((n) => n.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
    avisos.push(doc);
    return doc;
  });
  return { avisos, buscar };
}

const paciente = (extra = {}) => ({ _id: nuevoId(), ...extra });

beforeEach(() => vi.restoreAllMocks());

describe('recordatorio diario del Readiness', () => {
  it('a la hora elegida, un paciente con plan que no lo completó recibe UN aviso amable y genérico', async () => {
    const p = paciente({ preferences: { readinessReminder: { enabled: true, hour: 19 } } });
    const { avisos } = escenario({ conPlan: [p._id], pacientes: [p] });

    const summary = await sendReadinessReminders({ now: a(19, 30) });

    expect(summary).toMatchObject({ sent: 1, duplicates: 0, failed: 0 });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ type: 'readiness_reminder', ...READINESS_REMINDER_NOTIFICATION, dedupeKey: reminderKey(String(p._id), '2026-10-14') });
    // sin cifras ni datos de salud, con enlace directo
    expect(avisos[0].body).not.toMatch(/\d|rojo|dolor|sueño/i);
    expect(avisos[0].link).toBe('/app/dashboard?readiness=1');
  });

  it('antes de la hora elegida NO se envía', async () => {
    const p = paciente({ preferences: { readinessReminder: { enabled: true, hour: 21 } } });
    const { avisos } = escenario({ conPlan: [p._id], pacientes: [p] });
    const summary = await sendReadinessReminders({ now: a(20, 59) });
    expect(summary.sent).toBe(0);
    expect(avisos).toHaveLength(0);
  });

  it('sin preferencia guardada usa el valor por defecto: 20:00', async () => {
    const p = paciente();
    const { avisos } = escenario({ conPlan: [p._id], pacientes: [p] });
    await sendReadinessReminders({ now: a(19, 59) });
    expect(avisos).toHaveLength(0);
    await sendReadinessReminders({ now: a(20, 0) });
    expect(avisos).toHaveLength(1);
    expect(DEFAULT_REMINDER).toEqual({ enabled: true, hour: 20 });
  });

  it('si ya completó el Readiness hoy, no hay recordatorio', async () => {
    const p = paciente();
    const { avisos, buscar } = escenario({ conPlan: [p._id], hechos: [p._id], pacientes: [p] });
    const summary = await sendReadinessReminders({ now: a(21) });
    expect(summary.sent).toBe(0);
    expect(avisos).toHaveLength(0);
    // ni siquiera se consulta a quien ya cumplió
    expect(buscar).not.toHaveBeenCalled();
  });

  it('sin plan vigente no se envía (no podría registrarlo)', async () => {
    const sinPlan = paciente();
    const { avisos, buscar } = escenario({ conPlan: [], pacientes: [sinPlan] });
    await sendReadinessReminders({ now: a(21) });
    expect(avisos).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('los recordatorios desactivados no se envían (la consulta los excluye y, por si acaso, también el código)', async () => {
    const p = paciente({ preferences: { readinessReminder: { enabled: false, hour: 20 } } });
    const { avisos, buscar } = escenario({ conPlan: [p._id], pacientes: [p] });
    await sendReadinessReminders({ now: a(21) });
    expect(buscar.mock.calls[0][0]).toMatchObject({ role: 'patient', isActive: true, 'preferences.readinessReminder.enabled': { $ne: false } });
    expect(avisos).toHaveLength(0);
  });

  it('el programador corre muchas veces el mismo día: un solo aviso, sin duplicados', async () => {
    const p = paciente();
    const { avisos } = escenario({ conPlan: [p._id], pacientes: [p] });

    const primero = await sendReadinessReminders({ now: a(20, 0) });
    const segundo = await sendReadinessReminders({ now: a(20, 10) });
    const tercero = await sendReadinessReminders({ now: a(22, 40) });

    expect(primero.sent).toBe(1);
    expect(segundo).toMatchObject({ sent: 0, duplicates: 1 });
    expect(tercero).toMatchObject({ sent: 0, duplicates: 1 });
    expect(avisos).toHaveLength(1);
  });

  it('al día siguiente se envía de nuevo, con otra clave', async () => {
    const p = paciente();
    const { avisos } = escenario({ conPlan: [p._id], pacientes: [p] });
    await sendReadinessReminders({ now: a(20, 5, 14) });
    await sendReadinessReminders({ now: a(20, 5, 15) });
    expect(avisos.map((n) => n.dedupeKey)).toEqual([reminderKey(String(p._id), '2026-10-14'), reminderKey(String(p._id), '2026-10-15')]);
  });

  it('usa el día y la hora de SANTIAGO, no los del servidor (UTC)', async () => {
    // 23:30 del 14 en Santiago ya es 15 en UTC
    const p = paciente();
    const { avisos } = escenario({ conPlan: [p._id], pacientes: [p] });
    await sendReadinessReminders({ now: a(23, 30, 14) });
    expect(avisos[0].dedupeKey).toBe(reminderKey(String(p._id), '2026-10-14'));
    expect(WellnessCheckin.distinct).toHaveBeenCalledWith('patient', { date: '2026-10-14' });
  });

  it('un error con un paciente no impide avisar a los demás', async () => {
    const [x, y] = [paciente(), paciente()];
    escenario({ conPlan: [x._id, y._id], pacientes: [x, y] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = Notification.create;
    let n = 0;
    vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
      n += 1;
      if (n === 1) throw new Error('falla puntual');
      return original ? doc : doc;
    });
    const summary = await sendReadinessReminders({ now: a(21) });
    expect(summary).toMatchObject({ sent: 1, failed: 1 });
  });

  it('reminderPreference: valores por defecto y valores guardados', () => {
    expect(reminderPreference(null)).toEqual({ enabled: true, hour: 20 });
    expect(reminderPreference({ preferences: { readinessReminder: { enabled: false, hour: 7 } } })).toEqual({ enabled: false, hour: 7 });
    expect(reminderPreference({ preferences: { readinessReminder: { hour: 0 } } })).toEqual({ enabled: true, hour: 0 });
  });
});

describe('preferencia del recordatorio (API)', () => {
  const req = (body) => ({ user: { _id: nuevoId() }, body });

  it('devuelve la preferencia (o la por defecto)', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ preferences: { readinessReminder: { enabled: true, hour: 18 } } }) });
    const res = fakeRes();
    await getReminderPreference(req(), res);
    expect(res.body.data.reminder).toEqual({ enabled: true, hour: 18 });
  });

  it('guarda solo lo que se envía y solo en el usuario autenticado', async () => {
    const update = vi.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: () => Promise.resolve({ preferences: { readinessReminder: { enabled: false, hour: 20 } } }) });
    const r = req({ enabled: false });
    const res = fakeRes();
    await updateReminderPreference(r, res);

    expect(update).toHaveBeenCalledWith(r.user._id, { $set: { 'preferences.readinessReminder.enabled': false } }, { new: true });
    expect(res.body.data.reminder.enabled).toBe(false);
  });

  it('rechaza valores inválidos sin guardar nada', async () => {
    const update = vi.spyOn(User, 'findByIdAndUpdate');
    for (const body of [{}, { enabled: 'si' }, { hour: 24 }, { hour: -1 }, { hour: 7.5 }, { hour: '8' }]) {
      const res = fakeRes();
      await updateReminderPreference(req(body), res);
      expect(res.statusCode).toBe(400);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it('solo los pacientes usan estas rutas (el personal recibe 403)', () => {
    const rutas = wellnessRouter.stack.filter((l) => l.route?.path === '/reminder');
    expect(rutas.map((r) => Object.keys(r.route.methods)[0]).sort()).toEqual(['get', 'put']);
    const res = fakeRes();
    const next = vi.fn();
    authorize('patient')({ user: { role: 'professional' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('logro "Una semana de Readiness" (hábito, no resultado)', () => {
  const dia = (n) => ({ _id: nuevoId(), date: `2026-10-${String(n).padStart(2, '0')}` });

  it('5 check-ins en una ventana de 7 días lo conceden', () => {
    const [candidate] = computeReadinessCandidates([dia(1), dia(2), dia(4), dia(5), dia(7)]);
    expect(candidate).toMatchObject({ key: 'readiness_week', periodKey: 'once' });
    expect(candidate.evidence.refs).toHaveLength(5);
    expect(candidate.evidence.values).toMatchObject({ checkins: 5, windowDays: 7, from: '2026-10-01', to: '2026-10-07' });
  });

  it('4 de 7 días no alcanzan; tampoco 5 repartidos en más de 7 días', () => {
    expect(computeReadinessCandidates([dia(1), dia(2), dia(3), dia(4)])).toEqual([]);
    expect(computeReadinessCandidates([dia(1), dia(3), dia(5), dia(8), dia(10)])).toEqual([]);
  });

  it('un día sin registro no es negativo: simplemente no cuenta (5 de 7 con huecos sí sirve)', () => {
    expect(findReadinessWindow([dia(2), dia(3), dia(5), dia(7), dia(8)])).toHaveLength(5);
  });

  it('los check-ins repetidos del mismo día cuentan una vez', () => {
    expect(computeReadinessCandidates([dia(1), dia(1), dia(2), dia(2), dia(3)])).toEqual([]);
  });

  it('no depende del resultado: solo mira la fecha (no usa puntajes ni semáforo)', () => {
    const conPuntaje = [1, 2, 3, 4, 5].map((n) => ({ ...dia(n), sleep: 1, stress: 1, energy: 1, mood: 1, soreness: 1 }));
    expect(computeReadinessCandidates(conPuntaje)).toHaveLength(1);
  });

  it('cruza el cambio de mes correctamente', () => {
    const fechas = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((date) => ({ _id: nuevoId(), date }));
    expect(computeReadinessCandidates(fechas)).toHaveLength(1);
  });

  it('el progreso muestra el mejor tramo de 7 días (máximo 5)', () => {
    expect(readinessWeekProgress([dia(1), dia(2), dia(3)])).toEqual({ best: 3, target: 5 });
    expect(readinessWeekProgress([1, 2, 3, 4, 5, 6, 7].map(dia))).toEqual({ best: 5, target: 5 });
  });

  it('el catálogo: texto aprobado, una sola vez, categoría Readiness diario y sin presión', () => {
    const def = ACHIEVEMENTS.readiness_week;
    expect(def).toMatchObject({ category: 'readiness', periodic: false, title: 'Una semana de Readiness' });
    expect(def.criteria).toMatch(/no importa el resultado/i);
    expect(JSON.stringify(def)).not.toMatch(/perdiste|racha rota|no pierdas/i);
  });
});
