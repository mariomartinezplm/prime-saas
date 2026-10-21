/**
 * PRUEBAS — Entrenamiento en curso, Incremento 1: sesión activa y relojes.
 * Parte 1: reglas puras (ventana de inicio, descanso). Parte 2: controlador con la base simulada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../services/clientPlanService.js', () => ({ hasActivePlan: vi.fn() }));

import { hasActivePlan } from '../services/clientPlanService.js';
import WorkoutSession from '../models/WorkoutSession.js';
import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import workoutRoutes from '../routes/workoutRoutes.js';
import { getActive, startWorkout, restAction, finishWorkout, sessionView } from '../controllers/workoutController.js';
import { santiagoToUtc } from '../utils/timezone.js';
import { startPhase, pickStartable, applyRestAction, remainingSec, settle, isStale, AUTO_CLOSE_MS, HOUR, MINUTE } from '../services/workoutService.js';

const id = () => new mongoose.Types.ObjectId();
// Martes 20 de octubre de 2026, hora de Chile
const at = (h, m = 0, s = 0) => santiagoToUtc(2026, 10, 20, h, m, s);
const cita = (over = {}) => ({ _id: id(), type: 'entrenamiento', status: 'scheduled', date: new Date(Date.UTC(2026, 9, 20)), startTime: '18:00', endTime: '19:00', ...over });

describe('ventana para iniciar', () => {
  it('desde 30 min antes hasta 3 h después de terminar la franja', () => {
    const c = cita();
    expect(startPhase(c, at(17, 29))).toBeNull();
    expect(startPhase(c, at(17, 30))).toBe('soon');
    expect(startPhase(c, at(17, 59))).toBe('soon');
    expect(startPhase(c, at(18, 0))).toBe('live');
    expect(startPhase(c, at(19, 0))).toBe('live');
    expect(startPhase(c, at(19, 1))).toBe('late');
    expect(startPhase(c, at(22, 0))).toBe('late');
    expect(startPhase(c, at(22, 1))).toBeNull();
  });

  it('solo citas de entrenamiento agendadas (no kinesiología, evaluación ni canceladas)', () => {
    for (const over of [{ type: 'kinesiologia' }, { type: 'evaluacion' }, { status: 'cancelled' }, { status: 'completed' }, { status: 'no-show' }]) {
      expect(startPhase(cita(over), at(18, 30))).toBeNull();
    }
  });

  it('usa la hora de Chile, no la del servidor', () => {
    // 18:00 en Chile (UTC-3 en octubre, horario de verano) no es 18:00 UTC
    const c = cita();
    expect(startPhase(c, new Date(Date.UTC(2026, 9, 20, 18, 0)))).toBeNull(); // 15:00 en Chile: aún no
    expect(startPhase(c, new Date(Date.UTC(2026, 9, 20, 21, 30)))).toBe('live');
  });

  it('elige la cita más cercana', () => {
    const tarde = cita({ startTime: '19:00', endTime: '20:00' });
    const temprano = cita();
    expect(pickStartable([tarde, temprano], at(18, 30)).appointment).toBe(temprano);
  });
});

describe('descanso derivado de instantes', () => {
  const idle = { state: 'idle', durationSec: 120, nextDurationSec: 120, version: 0 };

  it('2:00 iniciado a las 18:15:00 → 00:40 a las 18:16:20 → terminado a las 18:18', () => {
    const started = applyRestAction(idle, 'start', {}, at(18, 15, 0)).rest;
    expect(started.state).toBe('running');
    expect(remainingSec(started, at(18, 16, 20))).toBe(40);
    expect(remainingSec(started, at(18, 18, 0))).toBe(0);
    expect(settle(started, at(18, 18, 0)).state).toBe('done');
    expect(settle(started, at(18, 16, 20)).state).toBe('running');
  });

  it('pausar guarda lo que faltaba y reanudar parte desde ahí (el tiempo en pausa no corre)', () => {
    const running = applyRestAction(idle, 'start', { seconds: 120 }, at(18, 0, 0)).rest;
    const paused = applyRestAction(running, 'pause', {}, at(18, 0, 50)).rest;
    expect(paused).toMatchObject({ state: 'paused', remainingSec: 70 });
    expect(remainingSec(paused, at(18, 30, 0))).toBe(70);
    const resumed = applyRestAction(paused, 'resume', {}, at(18, 10, 0)).rest;
    expect(remainingSec(resumed, at(18, 10, 0))).toBe(70);
    expect(remainingSec(resumed, at(18, 10, 30))).toBe(40);
  });

  it('sumar 15 s alarga el descanso corriendo y el pausado; omitir lo cierra', () => {
    const running = applyRestAction(idle, 'start', { seconds: 60 }, at(18, 0, 0)).rest;
    const plus = applyRestAction(running, 'add', {}, at(18, 0, 10)).rest;
    expect(remainingSec(plus, at(18, 0, 10))).toBe(65);
    const paused = applyRestAction(plus, 'pause', {}, at(18, 0, 20)).rest;
    expect(applyRestAction(paused, 'add', {}, at(18, 0, 25)).rest.remainingSec).toBe(70);
    const skipped = applyRestAction(paused, 'skip', {}, at(18, 1)).rest;
    expect(skipped.state).toBe('idle');
    expect(applyRestAction(idle, 'add', {}, at(18, 1)).error).toBeTruthy();
    expect(applyRestAction(idle, 'skip', {}, at(18, 1)).error).toBeTruthy();
  });

  it('cambiar el PRÓXIMO descanso nunca altera uno activo', () => {
    const running = applyRestAction(idle, 'start', { seconds: 120 }, at(18, 0, 0)).rest;
    const changed = applyRestAction(running, 'set_next', { seconds: 45 }, at(18, 0, 30)).rest;
    expect(changed).toMatchObject({ state: 'running', durationSec: 120, nextDurationSec: 45 });
    expect(new Date(changed.dueAt).getTime()).toBe(new Date(running.dueAt).getTime());
    // el siguiente descanso usa los 45 s
    const done = settle(changed, at(18, 5));
    expect(applyRestAction(done, 'start', {}, at(18, 5)).rest.durationSec).toBe(45);
  });

  it('no se puede iniciar otro descanso mientras hay uno en marcha o en pausa', () => {
    const running = applyRestAction(idle, 'start', {}, at(18, 0)).rest;
    expect(applyRestAction(running, 'start', {}, at(18, 0, 5)).code).toBe('REST_ACTIVE');
  });

  it('valida los segundos (entero entre 5 y 1800) y la acción', () => {
    for (const bad of [0, 4, 1801, -10, 2.5, NaN]) expect(applyRestAction(idle, 'start', { seconds: bad }, at(18)).error).toBeTruthy();
    expect(applyRestAction(idle, 'start', { seconds: 30 }, at(18)).rest.durationSec).toBe(30);
    expect(applyRestAction(idle, 'bailar', {}, at(18)).code).toBe('UNKNOWN_ACTION');
  });

  it('cada cambio sube la versión', () => {
    const a = applyRestAction(idle, 'start', {}, at(18)).rest;
    const b = applyRestAction(a, 'pause', {}, at(18, 0, 5)).rest;
    expect([a.version, b.version]).toEqual([1, 2]);
  });
});

describe('sesión abandonada', () => {
  it('se considera abandonada solo tras 6 h sin actividad; una sesión de 2 h con actividad NO', () => {
    const now = at(23, 0);
    expect(isStale({ lastActivityAt: new Date(now.getTime() - (AUTO_CLOSE_MS - MINUTE)) }, now)).toBe(false);
    expect(isStale({ lastActivityAt: new Date(now.getTime() - (AUTO_CLOSE_MS + MINUTE)) }, now)).toBe(true);
    expect(AUTO_CLOSE_MS).toBe(6 * HOUR);
  });
});

// ── Controlador con la base simulada ─────────────────────────────────────────
const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const PACIENTE = { _id: id(), role: 'patient' };
const sesion = (over = {}) => {
  const base = { _id: id(), patient: PACIENTE._id, appointment: id(), startedAt: at(18, 0), lastActivityAt: at(18, 0), status: 'active', rest: { state: 'idle', durationSec: 120, nextDurationSec: 120, version: 0 }, ...over };
  base.save = vi.fn(async () => base);
  return base;
};
const lean = (v) => ({ select: () => lean(v), lean: () => Promise.resolve(v), sort: () => lean(v), then: (f) => Promise.resolve(v).then(f) });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(at(18, 30));
  hasActivePlan.mockReset();
  hasActivePlan.mockResolvedValue(true);
});

describe('POST /start', () => {
  const llamar = async (body, { existente = null, mismoInicio = null, appointment = cita() } = {}) => {
    vi.spyOn(WorkoutSession, 'findOne').mockImplementation((f) => Promise.resolve(f.clientId ? mismoInicio : existente));
    const create = vi.spyOn(WorkoutSession, 'create').mockImplementation(async (doc) => ({ _id: id(), rest: { state: 'idle', durationSec: 120, nextDurationSec: 120, version: 0 }, status: 'active', ...doc }));
    vi.spyOn(Appointment, 'findOne').mockReturnValue(lean(appointment));
    const updateAppt = vi.spyOn(Appointment, 'updateOne');
    const findByIdAndUpdate = vi.spyOn(Appointment, 'findByIdAndUpdate');
    vi.spyOn(ClientPlan, 'updateOne');
    const r = res();
    await startWorkout({ user: PACIENTE, body }, r);
    return { r, create, updateAppt, findByIdAndUpdate };
  };

  it('el inicio es la hora del servidor al pulsar, no la hora de la cita', async () => {
    const a = cita();
    const { r, create } = await llamar({ appointmentId: String(a._id), clientId: 'abcdefgh-1' }, { appointment: a });
    expect(r.statusCode).toBe(201);
    expect(create.mock.calls[0][0].startedAt).toEqual(at(18, 30));
    expect(r.body.data.session.startedAt).toEqual(at(18, 30));
    expect(r.body.data.session.startedAt).not.toEqual(at(18, 0));
  });

  it('NUNCA modifica la cita ni el plan', async () => {
    const a = cita();
    const { updateAppt, findByIdAndUpdate } = await llamar({ appointmentId: String(a._id), clientId: 'abcdefgh-1' }, { appointment: a });
    expect(updateAppt).not.toHaveBeenCalled();
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
    expect(ClientPlan.updateOne).not.toHaveBeenCalled();
  });

  it('reintentar el mismo inicio devuelve la misma sesión sin crear otra', async () => {
    const previa = sesion();
    const { r, create } = await llamar({ appointmentId: String(id()), clientId: 'abcdefgh-1' }, { mismoInicio: previa });
    expect(r.statusCode).toBe(200);
    expect(r.body.data.resumed).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('si ya hay una sesión activa la devuelve (nunca dos)', async () => {
    const activa = sesion({ lastActivityAt: at(18, 20) });
    const { r, create } = await llamar({ appointmentId: String(id()), clientId: 'otro-id-123' }, { existente: activa });
    expect(r.body.data.session.id).toBe(String(activa._id));
    expect(create).not.toHaveBeenCalled();
  });

  it('plan vencido: 403 y no se crea nada', async () => {
    hasActivePlan.mockResolvedValue(false);
    const { r, create } = await llamar({ appointmentId: String(id()), clientId: 'abcdefgh-1' });
    expect(r.statusCode).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('fuera de la ventana, otra persona o datos inválidos: no se crea', async () => {
    vi.setSystemTime(at(10, 0));
    const fuera = await llamar({ appointmentId: String(id()), clientId: 'abcdefgh-1' });
    expect(fuera.r.statusCode).toBe(409);
    vi.setSystemTime(at(18, 30));
    const ajena = await llamar({ appointmentId: String(id()), clientId: 'abcdefgh-1' }, { appointment: null });
    expect(ajena.r.statusCode).toBe(404);
    const mala = await llamar({ appointmentId: 'no-es-id', clientId: 'abcdefgh-1' });
    expect(mala.r.statusCode).toBe(400);
    const sinClave = await llamar({ appointmentId: String(id()) });
    expect(sinClave.r.statusCode).toBe(400);
    expect([fuera, ajena, mala, sinClave].every((x) => x.create.mock.calls.length === 0)).toBe(true);
  });
});

describe('GET /active', () => {
  it('con sesión de 2 h con actividad sigue activa (no se corta a los 60 min)', async () => {
    const s = sesion({ startedAt: at(16, 30), lastActivityAt: at(18, 20) });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const r = res();
    await getActive({ user: PACIENTE }, r);
    expect(r.body.data.session.status).toBe('active');
    expect(r.body.data.session.startedAt).toEqual(at(16, 30));
    expect(s.save).not.toHaveBeenCalled();
  });

  it('cierra una abandonada con fin = última actividad y avisa', async () => {
    const s = sesion({ startedAt: at(8, 0), lastActivityAt: at(8, 40) });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    vi.spyOn(Appointment, 'find').mockReturnValue(lean([]));
    const r = res();
    await getActive({ user: PACIENTE }, r);
    expect(s.status).toBe('auto_closed');
    expect(s.endedAt).toEqual(at(8, 40));
    expect(r.body.data.closedStale).toBe(true);
    expect(r.body.data.session).toBeNull();
  });

  it('entrega la hora del servidor y el descanso ya vencido figura como terminado', async () => {
    const s = sesion({ lastActivityAt: at(18, 29), rest: { state: 'running', dueAt: at(18, 29, 30), durationSec: 120, nextDurationSec: 120, version: 3 } });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const r = res();
    await getActive({ user: PACIENTE }, r);
    expect(r.body.data.serverNow).toEqual(at(18, 30));
    expect(r.body.data.session.rest).toMatchObject({ state: 'done', remainingSec: 0 });
  });

  it('sin sesión y con una cita en ventana, ofrece iniciar', async () => {
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(null);
    const a = cita();
    vi.spyOn(Appointment, 'find').mockReturnValue(lean([a]));
    const r = res();
    await getActive({ user: PACIENTE }, r);
    expect(r.body.data.startable).toMatchObject({ appointmentId: String(a._id), phase: 'live' });
  });
});

describe('POST /:id/rest y /finish', () => {
  it('una sesión de otra persona responde 404 y no se modifica nada', async () => {
    const find = vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(null);
    const upd = vi.spyOn(WorkoutSession, 'findOneAndUpdate');
    const r = res();
    await restAction({ user: PACIENTE, params: { id: String(id()) }, body: { action: 'start' } }, r);
    expect(r.statusCode).toBe(404);
    expect(find.mock.calls[0][0].patient).toBe(PACIENTE._id); // siempre acotado al dueño
    expect(upd).not.toHaveBeenCalled();
    const r2 = res();
    await finishWorkout({ user: PACIENTE, params: { id: 'basura' }, body: {} }, r2);
    expect(r2.statusCode).toBe(404);
  });

  it('iniciar descanso guarda el vencimiento y actualiza la actividad', async () => {
    const s = sesion();
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const upd = vi.spyOn(WorkoutSession, 'findOneAndUpdate').mockImplementation(async (f, u) => ({ ...s, ...u.$set }));
    const r = res();
    await restAction({ user: PACIENTE, params: { id: String(s._id) }, body: { action: 'start', seconds: 120 } }, r);
    expect(r.statusCode).toBe(200);
    expect(upd.mock.calls[0][1].$set.rest.dueAt).toEqual(at(18, 32));
    expect(upd.mock.calls[0][1].$set.lastActivityAt).toEqual(at(18, 30));
    expect(r.body.data.session.rest).toMatchObject({ state: 'running', remainingSec: 120 });
  });

  it('versión vieja (otra pestaña): 409 con el estado actual y sin guardar', async () => {
    const s = sesion({ rest: { state: 'running', dueAt: at(18, 35), durationSec: 300, nextDurationSec: 120, version: 5 } });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const upd = vi.spyOn(WorkoutSession, 'findOneAndUpdate');
    const r = res();
    await restAction({ user: PACIENTE, params: { id: String(s._id) }, body: { action: 'pause', expectedVersion: 4 } }, r);
    expect(r.statusCode).toBe(409);
    expect(r.body.code).toBe('STALE_VERSION');
    expect(r.body.data.session.rest.version).toBe(5);
    expect(upd).not.toHaveBeenCalled();
  });

  it('si otra pestaña ganó la carrera, la actualización condicionada falla con 409', async () => {
    const s = sesion();
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(s);
    const r = res();
    await restAction({ user: PACIENTE, params: { id: String(s._id) }, body: { action: 'start' } }, r);
    expect(r.statusCode).toBe(409);
  });

  it('acciones inválidas: 400', async () => {
    const r = res();
    await restAction({ user: PACIENTE, params: { id: String(id()) }, body: { action: 'volar' } }, r);
    expect(r.statusCode).toBe(400);
    const r2 = res();
    await restAction({ user: PACIENTE, params: { id: String(id()) }, body: { action: 'start', seconds: 2.5 } }, r2);
    expect(r2.statusCode).toBe(400);
  });

  it('finalizar: cierra el descanso, calcula la duración real (más de 1 h) y no toca la cita ni el plan', async () => {
    const s = sesion({ startedAt: at(16, 40), lastActivityAt: at(18, 25), rest: { state: 'running', dueAt: at(18, 40), durationSec: 600, nextDurationSec: 120, version: 2 } });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const apptUpdate = vi.spyOn(Appointment, 'updateOne');
    const planUpdate = vi.spyOn(ClientPlan, 'updateOne');
    const r = res();
    await finishWorkout({ user: PACIENTE, params: { id: String(s._id) } }, r);
    expect(r.statusCode).toBe(200);
    expect(s.status).toBe('finished');
    expect(s.rest.state).toBe('idle');
    expect(r.body.data.summary.durationSec).toBe(110 * 60); // 16:40 → 18:30
    expect(apptUpdate).not.toHaveBeenCalled();
    expect(planUpdate).not.toHaveBeenCalled();
  });

  it('finalizar dos veces no cambia nada la segunda', async () => {
    const s = sesion({ status: 'finished', endedAt: at(18, 0) });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const r = res();
    await finishWorkout({ user: PACIENTE, params: { id: String(s._id) } }, r);
    expect(s.save).not.toHaveBeenCalled();
    expect(r.body.data.summary.durationSec).toBe(0);
  });

  it('un descanso no puede actualizarse en una sesión terminada', async () => {
    const s = sesion({ status: 'finished', endedAt: at(18, 0) });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const r = res();
    await restAction({ user: PACIENTE, params: { id: String(s._id) }, body: { action: 'start' } }, r);
    expect(r.statusCode).toBe(409);
  });
});

describe('rutas', () => {
  it('todas exigen sesión y rol de paciente, y ninguna recibe el id de otro paciente', () => {
    const rutas = workoutRoutes.stack.filter((l) => l.route).map((l) => l.route.path);
    expect(rutas.sort()).toEqual(['/:id/finish', '/:id/rest', '/active', '/start']);
    expect(rutas.some((p) => /patientId/i.test(p))).toBe(false);
    // protect + authorize se aplican al router completo, antes de cualquier ruta
    const guards = workoutRoutes.stack.filter((l) => !l.route);
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it('el modelo garantiza una sola sesión activa por paciente', () => {
    const indices = WorkoutSession.schema.indexes();
    const unico = indices.find(([, opts]) => opts?.name === 'una_activa_por_paciente');
    expect(unico[1]).toMatchObject({ unique: true, partialFilterExpression: { status: 'active' } });
  });
});

describe('sessionView', () => {
  it('no expone el paciente ni datos internos', () => {
    const view = sessionView(sesion(), at(18, 30));
    expect(Object.keys(view).sort()).toEqual(['appointmentId', 'endedAt', 'id', 'lastActivityAt', 'rest', 'startedAt', 'status']);
  });
});
