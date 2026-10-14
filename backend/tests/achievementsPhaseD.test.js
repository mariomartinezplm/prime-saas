/**
 * PRUEBAS — Fase D del plan de logros: rachas de 3, 6 y 12 meses y pausas autorizadas.
 *
 * Reglas aprobadas: la racha son meses CONSECUTIVOS con "Mes de constancia". Un mes sin plan, con plan
 * ilimitado o con pausa autorizada no suma ni corta; un mes en curso nunca se da por perdido; solo un mes con
 * plan, ya cerrado, sin llegar al objetivo y sin pausa, reinicia la racha. No se inventan sesiones.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import AchievementAward from '../models/AchievementAward.js';
import AchievementPause from '../models/AchievementPause.js';
import WellnessCheckin from '../models/WellnessCheckin.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import UserModel from '../models/User.js';
import Notification from '../models/Notification.js';
import { santiagoToUtc } from '../utils/timezone.js';
import {
  monthStates,
  metRuns,
  computeStreakCandidates,
  streakMilestoneStillMet,
  streakProgress
} from '../services/achievements/streaks.js';
import { evaluatePatientAchievements, reconcilePatientAchievements } from '../services/achievements/index.js';
import { getPauses, createPause, deletePause } from '../controllers/achievementController.js';
import achievementRouter from '../routes/achievementRoutes.js';
import { authorize, authorizePatientAccess } from '../middleware/auth.js';
import * as achievementsIndex from '../services/achievements/index.js';
import { ACHIEVEMENTS } from '../config/achievements.js';

const nuevoId = () => new mongoose.Types.ObjectId();
let dia = 0;

// Un mes de entrenamiento: plan de `total` sesiones y `hechas` sesiones completadas
function mes(anio, numero, hechas, { total = 4, plan: extraPlan = {} } = {}) {
  const plan = {
    _id: nuevoId(),
    serviceType: 'entrenamiento',
    sessionsTotal: total,
    unlimited: false,
    status: 'expired',
    startDate: santiagoToUtc(anio, numero, 1),
    endDate: new Date(santiagoToUtc(anio, numero + 1, 1).getTime() - 1),
    ...extraPlan
  };
  const citas = Array.from({ length: hechas }, () => ({
    _id: nuevoId(),
    type: 'entrenamiento',
    status: 'completed',
    date: new Date(Date.UTC(anio, numero - 1, 1 + dia++ % 28)),
    deduction: { source: 'clientPlan', refId: plan._id }
  }));
  return { plan, citas };
}

// Une varios meses en { plans, citas }
function historia(...meses) {
  return { plans: meses.map((m) => m.plan), citas: meses.flatMap((m) => m.citas) };
}
const OK = (anio, numero) => mes(anio, numero, 4);
const FALLO = (anio, numero) => mes(anio, numero, 3);
const AHORA = new Date('2026-12-20T12:00:00Z');
const claves = (candidates) => candidates.map((c) => c.key);

beforeEach(() => {
  vi.restoreAllMocks();
  dia = 0;
});

describe('rachas: meses consecutivos con constancia', () => {
  it('tres meses seguidos conceden "3 meses en movimiento" (y solo ese)', () => {
    const { plans, citas } = historia(OK(2026, 8), OK(2026, 9), OK(2026, 10));
    expect(claves(computeStreakCandidates(plans, citas, [], AHORA))).toEqual(['streak_3']);
  });

  it('dos meses no alcanzan', () => {
    const { plans, citas } = historia(OK(2026, 9), OK(2026, 10));
    expect(computeStreakCandidates(plans, citas, [], AHORA)).toEqual([]);
  });

  it('un mes con plan, cerrado y sin llegar al objetivo REINICIA la racha', () => {
    const { plans, citas } = historia(OK(2026, 6), OK(2026, 7), FALLO(2026, 8), OK(2026, 9), OK(2026, 10));
    expect(computeStreakCandidates(plans, citas, [], AHORA)).toEqual([]);
    expect(streakProgress(plans, citas, [], AHORA)).toMatchObject({ current: 2, longest: 2 });
  });

  it('una pausa autorizada en el mes perdido NO la corta (ni suma ese mes)', () => {
    const { plans, citas } = historia(OK(2026, 8), FALLO(2026, 9), OK(2026, 10), OK(2026, 11));
    expect(computeStreakCandidates(plans, citas, [], AHORA)).toEqual([]);
    const conPausa = computeStreakCandidates(plans, citas, [{ periodKey: '2026-09' }], AHORA);
    expect(claves(conPausa)).toEqual(['streak_3']);
    // el mes en pausa no se cuenta como cumplido
    expect(conPausa[0].evidence.values.months).toEqual(['2026-08', '2026-10', '2026-11']);
  });

  it('una pausa en un mes en que sí cumplió igual cuenta como cumplido', () => {
    const { plans, citas } = historia(OK(2026, 9), OK(2026, 10), OK(2026, 11));
    expect(claves(computeStreakCandidates(plans, citas, [{ periodKey: '2026-10' }], AHORA))).toEqual(['streak_3']);
  });

  it('un mes SIN plan (vacaciones, tiempo sin contratar) no corta ni suma', () => {
    // no hay plan en septiembre ni octubre
    const { plans, citas } = historia(OK(2026, 6), OK(2026, 7), OK(2026, 8), OK(2026, 11));
    const result = computeStreakCandidates(plans, citas, [], AHORA);
    expect(claves(result)).toEqual(['streak_3']);
    expect(metRuns(monthStates(plans, citas, [], AHORA))).toEqual([['2026-06', '2026-07', '2026-08', '2026-11']]);
  });

  it('no se inventan meses: un hueco no completa una racha', () => {
    const { plans, citas } = historia(OK(2026, 7), OK(2026, 11));
    expect(computeStreakCandidates(plans, citas, [], AHORA)).toEqual([]);
  });

  it('un mes en curso (todavía sin llegar al objetivo) no cuenta ni corta', () => {
    const hoy = new Date('2026-11-10T12:00:00Z');
    const { plans, citas } = historia(OK(2026, 8), OK(2026, 9), OK(2026, 10), mes(2026, 11, 2, { plan: { status: 'active' } }));
    const states = monthStates(plans, citas, [], hoy);
    expect(states.at(-1)).toMatchObject({ periodKey: '2026-11', state: 'pending', completed: 2, target: 4 });
    expect(claves(computeStreakCandidates(plans, citas, [], hoy))).toEqual(['streak_3']);
    // y no se pierde: si lo completa, suma
    const completo = historia(OK(2026, 8), OK(2026, 9), OK(2026, 10), mes(2026, 11, 4, { plan: { status: 'active' } }));
    expect(streakProgress(completo.plans, completo.citas, [], hoy)).toMatchObject({ current: 4, longest: 4 });
  });

  it('el mismo mes cerrado SÍ cuenta como perdido cuando el mes termina sin completarse', () => {
    const { plans, citas } = historia(mes(2026, 11, 2, { plan: { status: 'expired' } }));
    expect(monthStates(plans, citas, [], AHORA)[0].state).toBe('missed');
  });

  it('un plan ilimitado, un plan solo "próximo" y uno cancelado son neutrales', () => {
    const ilimitado = mes(2026, 10, 0, { total: 0, plan: { unlimited: true } });
    const proximo = mes(2026, 11, 0, { plan: { status: 'upcoming' } });
    const cancelado = mes(2026, 9, 0, { plan: { status: 'cancelled' } });
    const states = monthStates([ilimitado.plan, proximo.plan, cancelado.plan], [], [], AHORA);
    expect(states.map((s) => [s.periodKey, s.state])).toEqual([['2026-09', 'neutral'], ['2026-10', 'neutral'], ['2026-11', 'neutral']]);
  });

  it('seis y doce meses seguidos conceden "6 meses de compromiso" y "Un año en PRIME"', () => {
    const seis = historia(...[1, 2, 3, 4, 5, 6].map((m) => OK(2026, m)));
    expect(claves(computeStreakCandidates(seis.plans, seis.citas, [], AHORA))).toEqual(['streak_3', 'streak_6']);

    const doce = historia(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => OK(2026, m)), OK(2025, 12));
    const result = computeStreakCandidates(doce.plans, doce.citas, [], AHORA);
    expect(claves(result)).toEqual(['streak_3', 'streak_6', 'streak_12']);
    expect(result[2].evidence.values).toMatchObject({ target: 12 });
    expect(result[2].evidence.values.months).toHaveLength(12);
  });

  it('once meses no alcanzan para "Un año en PRIME"', () => {
    const once = historia(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => OK(2026, m)));
    expect(claves(computeStreakCandidates(once.plans, once.citas, [], AHORA))).toEqual(['streak_3', 'streak_6']);
  });

  it('la racha en curso y el próximo hito se explican con el progreso', () => {
    const { plans, citas } = historia(OK(2026, 9), OK(2026, 10));
    expect(streakProgress(plans, citas, [], AHORA)).toEqual({ current: 2, longest: 2, nextKey: 'streak_3', nextMonths: 3 });
    const larga = historia(...[1, 2, 3, 4, 5, 6, 7].map((m) => OK(2026, m)));
    expect(streakProgress(larga.plans, larga.citas, [], AHORA)).toMatchObject({ longest: 7, nextKey: 'streak_12' });
  });

  it('quitar la pausa hace que el hito deje de cumplirse', () => {
    const { plans, citas } = historia(OK(2026, 8), FALLO(2026, 9), OK(2026, 10), OK(2026, 11));
    expect(streakMilestoneStillMet(plans, citas, [{ periodKey: '2026-09' }], AHORA, 'streak_3')).toBe(true);
    expect(streakMilestoneStillMet(plans, citas, [], AHORA, 'streak_3')).toBe(false);
    expect(streakMilestoneStillMet(plans, citas, [], AHORA, 'inventado')).toBe(false);
  });

  it('el catálogo: nombres aprobados, una sola vez, y sin lenguaje de presión ni de pérdida', () => {
    expect(ACHIEVEMENTS.streak_3.title).toBe('3 meses en movimiento');
    expect(ACHIEVEMENTS.streak_6.title).toBe('6 meses de compromiso');
    expect(ACHIEVEMENTS.streak_12.title).toBe('Un año en PRIME');
    for (const k of ['streak_3', 'streak_6', 'streak_12']) {
      expect(ACHIEVEMENTS[k].periodic).toBe(false);
      expect(ACHIEVEMENTS[k].category).toBe('trayectoria');
      expect(JSON.stringify(ACHIEVEMENTS[k])).not.toMatch(/perdiste|no pierdas|racha rota|fallaste/i);
    }
  });
});

// ── Servicio con la base simulada ───────────────────────────────────────────
const query = (value) => ({ select: () => query(value), lean: () => Promise.resolve(value) });

function almacen() {
  const rows = [];
  const llave = (f) => `${f.patient}|${f.key}|${f.periodKey}`;
  vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
    const existing = rows.find((r) => llave(r) === llave(filter));
    if (update.$setOnInsert) {
      if (existing) return { value: existing, lastErrorObject: { updatedExisting: true } };
      const row = { _id: nuevoId(), ...filter, ...update.$setOnInsert };
      rows.push(row);
      return { value: row, lastErrorObject: { updatedExisting: false } };
    }
    const target = rows.find((r) => String(r.patient) === String(filter.patient) && r.key === filter.key && r.periodKey === filter.periodKey && (!filter.status || r.status === filter.status));
    if (!target) return null;
    Object.assign(target, update.$set);
    if (update.$unset) for (const k of Object.keys(update.$unset)) delete target[k];
    return target;
  });
  vi.spyOn(AchievementAward, 'find').mockImplementation(async (filter) => rows.filter((r) => String(r.patient) === String(filter.patient) && filter.key.$in.includes(r.key)));
  const notifs = [];
  vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
    if (notifs.some((n) => n.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
    notifs.push(doc);
    return doc;
  });
  return { rows, notifs };
}

function datos({ plans, citas, pausas = [] }) {
  vi.spyOn(Appointment, 'find').mockImplementation(() => query(citas));
  vi.spyOn(ClientPlan, 'find').mockImplementation(() => query(plans));
  const state = { pausas };
  vi.spyOn(AchievementPause, 'find').mockImplementation(() => query(state.pausas));
  vi.spyOn(WellnessCheckin, 'find').mockImplementation(() => query([]));
  vi.spyOn(Measurement, 'find').mockImplementation(() => query([]));
  vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => query([]));
  vi.spyOn(UserModel, 'findById').mockImplementation(() => query(null));
  return state;
}

describe('servicio: rachas con pausas', () => {
  it('concede la racha una sola vez y revisa (sin borrar) si se quita la pausa que la sostenía', async () => {
    const patientId = nuevoId();
    const { plans, citas } = historia(OK(2026, 8), FALLO(2026, 9), OK(2026, 10), OK(2026, 11));
    const state = datos({ plans, citas, pausas: [{ periodKey: '2026-09' }] });
    const { rows, notifs } = almacen();

    const primero = await evaluatePatientAchievements(patientId, { now: AHORA });
    await evaluatePatientAchievements(patientId, { now: AHORA });

    const rachas = rows.filter((r) => r.key.startsWith('streak_'));
    expect(primero.granted.map((g) => g.key)).toContain('streak_3');
    expect(rachas).toHaveLength(1);
    expect(rachas[0]).toMatchObject({ category: 'trayectoria', periodKey: 'once', status: 'active' });
    expect(rachas[0].evidence.values.months).toEqual(['2026-08', '2026-10', '2026-11']);
    expect(notifs.filter((n) => n.dedupeKey.includes('streak_3'))).toHaveLength(1);

    // el profesional quita la pausa
    state.pausas = [];
    const result = await reconcilePatientAchievements(patientId, { now: AHORA });
    expect(result.flagged).toContainEqual({ key: 'streak_3', periodKey: 'once' });
    expect(rachas[0].status).toBe('under_review');
    expect(rows.filter((r) => r.key === 'streak_3')).toHaveLength(1);

    // y si se vuelve a poner, se restaura sola
    state.pausas = [{ periodKey: '2026-09' }];
    const again = await reconcilePatientAchievements(patientId, { now: AHORA });
    expect(again.restored).toContainEqual({ key: 'streak_3', periodKey: 'once' });
    expect(rachas[0].status).toBe('active');
  });

  it('sin datos suficientes no concede ninguna racha', async () => {
    const { plans, citas } = historia(OK(2026, 9), OK(2026, 10));
    datos({ plans, citas });
    const { rows } = almacen();
    await evaluatePatientAchievements(nuevoId(), { now: AHORA });
    expect(rows.filter((r) => r.key.startsWith('streak_'))).toHaveLength(0);
  });
});

// ── Pausas: API ─────────────────────────────────────────────────────────────
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const PACIENTE = nuevoId();
const STAFF = { _id: nuevoId(), role: 'professional' };
const req = (body = {}, params = {}) => ({ user: STAFF, params: { patientId: PACIENTE.toString(), ...params }, body });

describe('pausas autorizadas (API)', () => {
  beforeEach(() => {
    vi.spyOn(achievementsIndex, 'triggerAchievementEvaluation').mockResolvedValue(undefined);
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => Promise.resolve({ role: 'patient' }) });
  });

  it('si el id no es de un paciente (otro rol o inexistente) responde 404 y no toca nada', async () => {
    const create = vi.spyOn(AchievementPause, 'create').mockResolvedValue({});
    const del = vi.spyOn(AchievementPause, 'findOneAndDelete').mockResolvedValue({});
    const find = vi.spyOn(AchievementPause, 'find');
    for (const found of [{ role: 'professional' }, { role: 'admin' }, null]) {
      UserModel.findById.mockReturnValue({ select: () => Promise.resolve(found) });
      const a = fakeRes();
      await createPause(req({ periodKey: '2026-10', reason: 'x' }), a);
      const b = fakeRes();
      await deletePause(req({}, { periodKey: '2026-10' }), b);
      const c = fakeRes();
      await getPauses(req(), c);
      expect([a.statusCode, b.statusCode, c.statusCode]).toEqual([404, 404, 404]);
    }
    expect(create).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  it('exige un mes válido (AAAA-MM) y un motivo', async () => {
    const create = vi.spyOn(AchievementPause, 'create').mockResolvedValue({});
    for (const body of [{ reason: 'x' }, { periodKey: 'once', reason: 'x' }, { periodKey: '2026-13', reason: 'x' }, { periodKey: 'octubre', reason: 'x' }]) {
      const res = fakeRes();
      await createPause(req(body), res);
      expect(res.statusCode).toBe(400);
    }
    const res = fakeRes();
    await createPause(req({ periodKey: '2026-10', reason: '   ' }), res);
    expect(res.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('registra la pausa con quién la creó y vuelve a evaluar al paciente', async () => {
    const create = vi.spyOn(AchievementPause, 'create').mockResolvedValue({ periodKey: '2026-10' });
    const res = fakeRes();
    await createPause(req({ periodKey: '2026-10', reason: '  Lesión de rodilla  ' }), res);

    expect(res.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith({ patient: PACIENTE.toString(), periodKey: '2026-10', reason: 'Lesión de rodilla', createdBy: STAFF._id });
    expect(achievementsIndex.triggerAchievementEvaluation).toHaveBeenCalledWith(PACIENTE.toString());
  });

  it('un mes ya pausado responde 409', async () => {
    vi.spyOn(AchievementPause, 'create').mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const res = fakeRes();
    await createPause(req({ periodKey: '2026-10', reason: 'x' }), res);
    expect(res.statusCode).toBe(409);
  });

  it('quitar una pausa que no existe da 404; si existe, se borra y se revisa al paciente', async () => {
    const find = vi.spyOn(AchievementPause, 'findOneAndDelete').mockResolvedValueOnce(null);
    const noExiste = fakeRes();
    await deletePause(req({}, { periodKey: '2026-10' }), noExiste);
    expect(noExiste.statusCode).toBe(404);

    find.mockResolvedValueOnce({ periodKey: '2026-10' });
    const ok = fakeRes();
    await deletePause(req({}, { periodKey: '2026-10' }), ok);
    expect(ok.statusCode).toBe(200);
    expect(find).toHaveBeenLastCalledWith({ patient: PACIENTE.toString(), periodKey: '2026-10' });
    expect(achievementsIndex.triggerAchievementEvaluation).toHaveBeenCalled();

    const malMes = fakeRes();
    await deletePause(req({}, { periodKey: 'once' }), malMes);
    expect(malMes.statusCode).toBe(400);
  });

  it('lista las pausas del paciente pedido', async () => {
    const chain = { sort: () => chain, populate: () => Promise.resolve([{ periodKey: '2026-10' }]) };
    const find = vi.spyOn(AchievementPause, 'find').mockReturnValue(chain);
    const res = fakeRes();
    await getPauses(req(), res);
    expect(find).toHaveBeenCalledWith({ patient: PACIENTE.toString() });
    expect(res.body.data.pauses).toHaveLength(1);
  });
});

describe('pausas: permisos (solo personal con acceso al paciente)', () => {
  it('las tres rutas pasan por protect, authorize(admin, professional) y authorizePatientAccess', () => {
    const rutas = achievementRouter.stack.filter((l) => l.route && l.route.path.includes('pauses'));
    expect(rutas).toHaveLength(3);
    for (const layer of rutas) expect(layer.route.stack.length).toBe(3);
    expect(achievementRouter.stack[0].name).toBe('protect');
  });

  it('un paciente no pasa authorize(admin, professional): 403', () => {
    const res = fakeRes();
    const next = vi.fn();
    authorize('admin', 'professional')({ user: { role: 'patient' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('un profesional no accede a las pausas de un paciente de otro profesional: 404', async () => {
    const otroPaciente = nuevoId();
    vi.spyOn((await import('../models/User.js')).default, 'findById').mockReturnValue({
      select: () => Promise.resolve({ _id: otroPaciente, role: 'patient', isActive: true, assignedProfessionalId: nuevoId() })
    });
    const res = fakeRes();
    const next = vi.fn();
    await authorizePatientAccess('patientId')({ user: { _id: nuevoId(), role: 'professional' }, params: { patientId: otroPaciente.toString() }, body: {} }, res, next);
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });
});
