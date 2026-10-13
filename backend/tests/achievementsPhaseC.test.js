/**
 * PRUEBAS — Fase C del plan de logros: kinesiología (5 sesiones) y constancia mensual en entrenamiento.
 *
 * Parte 1: funciones puras (qué se concedería con estos datos).
 * Parte 2: el servicio con la base de datos simulada (idempotencia, correcciones, programador).
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import AchievementAward from '../models/AchievementAward.js';
import AchievementPause from '../models/AchievementPause.js';
import Notification from '../models/Notification.js';
import { santiagoToUtc } from '../utils/timezone.js';
import {
  computeKinesiologyCandidates,
  completedKinesiology,
  kinesiologyProgress,
  kinesiologyMilestoneStillMet
} from '../services/achievements/kinesiology.js';
import {
  computeConsistencyCandidates,
  consistencyProgress,
  periodKeyOfPlan,
  groupTrainingPlansByPeriod
} from '../services/achievements/consistency.js';
import {
  evaluatePatientAchievements,
  reconcilePatientAchievements,
  triggerAchievementEvaluation,
  runAchievementSweep
} from '../services/achievements/index.js';
import { ACHIEVEMENTS, GENERIC_NOTIFICATION } from '../config/achievements.js';

const nuevoId = () => new mongoose.Types.ObjectId();
let dia = 0;
const sesion = (type, status, extra = {}) => ({
  _id: nuevoId(),
  type,
  status,
  date: new Date(Date.UTC(2026, 9, 1 + dia++)),
  startTime: '10:00',
  ...extra
});
const kine = (status = 'completed', extra) => sesion('kinesiologia', status, extra);

// ── Planes ──────────────────────────────────────────────────────────────────
const finDeMes = (anio, mes) => new Date(santiagoToUtc(anio, mes + 1, 1).getTime() - 1);
const plan = (sessionsTotal, extra = {}) => ({
  _id: nuevoId(),
  serviceType: 'entrenamiento',
  sessionsTotal,
  unlimited: false,
  status: 'active',
  startDate: santiagoToUtc(2026, 10, 1),
  endDate: finDeMes(2026, 10),
  ...extra
});
const entreno = (p, status = 'completed', extra = {}) =>
  sesion('entrenamiento', status, { deduction: { source: 'clientPlan', refId: p._id }, ...extra });
const muchas = (n, fn) => Array.from({ length: n }, fn);

beforeEach(() => {
  vi.restoreAllMocks();
  dia = 0;
});

describe('kinesiología: "5 sesiones completadas"', () => {
  it('cinco sesiones completadas conceden el logro, con esas cinco como evidencia', () => {
    const citas = muchas(5, () => kine());
    const [candidate] = computeKinesiologyCandidates(citas);
    expect(candidate.key).toBe('kine_5');
    expect(candidate.periodKey).toBe('once');
    expect(candidate.evidence.refs).toHaveLength(5);
    expect(candidate.evidence.values).toEqual({ completed: 5, target: 5 });
  });

  it('cuatro no alcanzan', () => {
    expect(computeKinesiologyCandidates(muchas(4, () => kine()))).toEqual([]);
  });

  it('las citas futuras, canceladas, ausentes y las reservas NO cuentan', () => {
    const citas = [
      ...muchas(4, () => kine()),
      ...muchas(3, () => kine('scheduled')),
      ...muchas(3, () => kine('cancelled')),
      ...muchas(3, () => kine('no-show'))
    ];
    expect(computeKinesiologyCandidates(citas)).toEqual([]);
  });

  it('las evaluaciones y las sesiones de entrenamiento no cuentan como kinesiología', () => {
    const citas = [
      ...muchas(4, () => kine()),
      ...muchas(3, () => sesion('evaluacion', 'completed')),
      ...muchas(3, () => sesion('entrenamiento', 'completed'))
    ];
    expect(computeKinesiologyCandidates(citas)).toEqual([]);
  });

  it('la quinta sesión completada (después de una ausencia) sí lo concede', () => {
    const citas = [...muchas(4, () => kine()), kine('no-show')];
    expect(computeKinesiologyCandidates(citas)).toEqual([]);
    expect(computeKinesiologyCandidates([...citas, kine()])).toHaveLength(1);
  });

  it('una misma cita repetida cuenta una sola vez', () => {
    const repetida = kine();
    const citas = [...muchas(3, () => kine()), repetida, repetida];
    expect(completedKinesiology(citas)).toHaveLength(4);
    expect(computeKinesiologyCandidates(citas)).toEqual([]);
  });

  it('la evidencia son las 5 primeras sesiones, aunque haya más', () => {
    const citas = muchas(8, () => kine());
    const [candidate] = computeKinesiologyCandidates(citas);
    expect(candidate.evidence.refs).toHaveLength(5);
    expect(candidate.evidence.values.completed).toBe(8);
  });

  it('el progreso apunta al próximo hito y el hito se mantiene o deja de cumplirse', () => {
    expect(kinesiologyProgress(muchas(3, () => kine()))).toEqual({ completed: 3, nextKey: 'kine_5', nextTarget: 5 });
    expect(kinesiologyProgress(muchas(6, () => kine()))).toEqual({ completed: 6, nextKey: null, nextTarget: null });
    expect(kinesiologyMilestoneStillMet(muchas(5, () => kine()), 'kine_5')).toBe(true);
    expect(kinesiologyMilestoneStillMet(muchas(4, () => kine()), 'kine_5')).toBe(false);
  });

  it('el catálogo trae el mensaje aprobado y NO promete resultados médicos', () => {
    expect(ACHIEVEMENTS.kine_5.message).toBe('¡Primer gran hito! Has completado tus primeras 5 sesiones. Cada paso cuenta.');
    expect(ACHIEVEMENTS.kine_5.target).toBe(5);
  });
});

describe('constancia mensual en entrenamiento', () => {
  it('plan de 8: ocho sesiones completadas del mes conceden "Mes de constancia"', () => {
    const p = plan(8);
    const [candidate] = computeConsistencyCandidates([p], muchas(8, () => entreno(p)));
    expect(candidate).toMatchObject({ key: 'consistency_month', periodKey: '2026-10' });
    expect(candidate.evidence.values).toMatchObject({ completed: 8, target: 8 });
  });

  it('plan de 8: siete NO alcanzan; plan de 12: el objetivo es 12', () => {
    const p8 = plan(8);
    expect(computeConsistencyCandidates([p8], muchas(7, () => entreno(p8)))).toEqual([]);

    const p12 = plan(12);
    expect(computeConsistencyCandidates([p12], muchas(8, () => entreno(p12)))).toEqual([]);
    expect(computeConsistencyCandidates([p12], muchas(11, () => entreno(p12)))).toEqual([]);
    expect(computeConsistencyCandidates([p12], muchas(12, () => entreno(p12)))).toHaveLength(1);
  });

  it('también aplica a los planes de 4 y de 16 sesiones (objetivo = su total)', () => {
    const p4 = plan(4);
    const p16 = plan(16);
    expect(computeConsistencyCandidates([p4], muchas(4, () => entreno(p4)))).toHaveLength(1);
    expect(computeConsistencyCandidates([p16], muchas(15, () => entreno(p16)))).toEqual([]);
    expect(computeConsistencyCandidates([p16], muchas(16, () => entreno(p16)))).toHaveLength(1);
  });

  it('las reservas, canceladas y ausencias NO cuentan, aunque el plan marque las sesiones como usadas', () => {
    const p = plan(8, { sessionsUsed: 8 });
    const citas = [
      ...muchas(5, () => entreno(p)),
      ...muchas(2, () => entreno(p, 'scheduled')),
      entreno(p, 'no-show'),
      entreno(p, 'cancelled')
    ];
    expect(computeConsistencyCandidates([p], citas)).toEqual([]);
  });

  it('solo cuentan las sesiones descontadas de ESE plan (no las de otro mes ni las extra)', () => {
    const octubre = plan(8);
    const noviembre = plan(8, { startDate: santiagoToUtc(2026, 11, 1), endDate: finDeMes(2026, 11) });
    const citas = [
      ...muchas(5, () => entreno(octubre)),
      ...muchas(5, () => entreno(noviembre)),
      ...muchas(3, () => sesion('entrenamiento', 'completed', { deduction: { source: 'extraSession', refId: nuevoId() } })),
      ...muchas(3, () => sesion('entrenamiento', 'completed'))
    ];
    expect(computeConsistencyCandidates([octubre, noviembre], citas)).toEqual([]);
    expect(consistencyProgress([octubre, noviembre], citas, '2026-10')).toMatchObject({ completed: 5, target: 8, met: false });
  });

  it('cada sesión cuenta una sola vez', () => {
    const p = plan(4);
    const repetida = entreno(p);
    const citas = [repetida, repetida, repetida, entreno(p), entreno(p)];
    expect(consistencyProgress([p], citas, '2026-10').completed).toBe(3);
    expect(computeConsistencyCandidates([p], citas)).toEqual([]);
  });

  it('cada mes es su propio periodo: dos meses cumplidos son dos logros distintos', () => {
    const octubre = plan(4);
    const noviembre = plan(4, { startDate: santiagoToUtc(2026, 11, 1), endDate: finDeMes(2026, 11) });
    const citas = [...muchas(4, () => entreno(octubre)), ...muchas(4, () => entreno(noviembre))];
    expect(computeConsistencyCandidates([octubre, noviembre], citas).map((c) => c.periodKey)).toEqual(['2026-10', '2026-11']);
  });

  it('el periodo es el mes (hora de Santiago) en que termina el ciclo: normal y "de fecha a fecha"', () => {
    expect(periodKeyOfPlan(plan(8))).toBe('2026-10');
    // ciclo del 10 de octubre al 9 de noviembre → termina en noviembre
    const rolling = plan(8, { startDate: santiagoToUtc(2026, 10, 10), endDate: new Date(santiagoToUtc(2026, 11, 10).getTime() - 1) });
    expect(periodKeyOfPlan(rolling)).toBe('2026-11');
    // último instante de octubre en Chile (UTC ya es noviembre): sigue siendo octubre
    expect(periodKeyOfPlan({ endDate: new Date(santiagoToUtc(2026, 11, 1).getTime() - 1) })).toBe('2026-10');
  });

  it('cambio de plan en el mes: manda el plan vigente y cuentan las sesiones hechas con el anterior', () => {
    const anterior = plan(8, { status: 'cancelled', startDate: santiagoToUtc(2026, 10, 1) });
    const nuevo = plan(4, { startDate: santiagoToUtc(2026, 10, 15) });
    const citas = [...muchas(3, () => entreno(anterior)), entreno(nuevo)];
    const [candidate] = computeConsistencyCandidates([anterior, nuevo], citas);
    expect(candidate.periodKey).toBe('2026-10');
    expect(candidate.evidence.values).toMatchObject({ completed: 4, target: 4 });

    // si el plan nuevo exige 8 y solo hay 4 sesiones, no se concede
    const nuevo8 = plan(8, { startDate: santiagoToUtc(2026, 10, 15) });
    expect(computeConsistencyCandidates([anterior, nuevo8], [...muchas(3, () => entreno(anterior)), entreno(nuevo8)])).toEqual([]);
  });

  it('un mes sin plan, un plan "próximo" o cancelado sin reemplazo no generan logro', () => {
    expect(computeConsistencyCandidates([], [])).toEqual([]);
    const proximo = plan(4, { status: 'upcoming' });
    expect(computeConsistencyCandidates([proximo], muchas(4, () => entreno(proximo)))).toEqual([]);
    const cancelado = plan(4, { status: 'cancelled' });
    expect(computeConsistencyCandidates([cancelado], muchas(4, () => entreno(cancelado)))).toEqual([]);
  });

  it('los planes ilimitados y los de kinesiología quedan fuera', () => {
    const ilimitado = plan(0, { unlimited: true });
    expect(computeConsistencyCandidates([ilimitado], muchas(10, () => entreno(ilimitado)))).toEqual([]);
    const kinePlan = plan(5, { serviceType: 'kinesiologia' });
    expect(computeConsistencyCandidates([kinePlan], muchas(5, () => entreno(kinePlan)))).toEqual([]);
  });

  it('agrupa por periodo en orden', () => {
    const noviembre = plan(4, { endDate: finDeMes(2026, 11) });
    const octubre = plan(4);
    expect(groupTrainingPlansByPeriod([noviembre, octubre]).map((g) => g.periodKey)).toEqual(['2026-10', '2026-11']);
  });
});

// ── Servicio con la base de datos simulada ──────────────────────────────────
const query = (value) => ({ select: () => query(value), lean: () => Promise.resolve(value) });

function datos({ citas = [], planes = [] }) {
  vi.spyOn(Appointment, 'find').mockImplementation(() => query(citas));
  vi.spyOn(ClientPlan, 'find').mockImplementation(() => query(planes));
  vi.spyOn(AchievementPause, 'find').mockImplementation(() => query([]));
}

function almacen(inicial = []) {
  const rows = [...inicial];
  const llave = (f) => `${f.patient}|${f.key}|${f.periodKey}`;
  vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (filter, update, options = {}) => {
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
  vi.spyOn(AchievementAward, 'exists').mockImplementation(async (f) => (rows.some((r) => llave(r) === llave({ ...f, patient: f.patient })) ? { _id: 1 } : null));
  return rows;
}

function avisos() {
  const rows = [];
  vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
    if (rows.some((r) => r.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
    rows.push(doc);
    return doc;
  });
  return rows;
}

describe('evaluatePatientAchievements', () => {
  it('concede kine_5 y "Mes de constancia" una sola vez, aunque se evalúe muchas veces', async () => {
    const patientId = nuevoId();
    const p = plan(4);
    datos({ citas: [...muchas(5, () => kine()), ...muchas(4, () => entreno(p))], planes: [p] });
    const filas = almacen();
    const notifs = avisos();

    const first = await evaluatePatientAchievements(patientId);
    await evaluatePatientAchievements(patientId);
    await evaluatePatientAchievements(patientId);

    expect(first.granted.map((g) => g.key).sort()).toEqual(['consistency_month', 'kine_5']);
    expect(filas).toHaveLength(2);
    expect(notifs).toHaveLength(2);
    expect(notifs[0]).toMatchObject({ title: GENERIC_NOTIFICATION.title, body: GENERIC_NOTIFICATION.body });
  });

  it('con datos insuficientes no concede nada ni avisa', async () => {
    const p = plan(8);
    datos({ citas: [...muchas(4, () => kine()), ...muchas(7, () => entreno(p))], planes: [p] });
    const filas = almacen();
    const notifs = avisos();

    const result = await evaluatePatientAchievements(nuevoId());

    expect(result).toEqual({ candidates: 0, granted: [] });
    expect(filas).toHaveLength(0);
    expect(notifs).toHaveLength(0);
  });

  it('dryRun informa lo que concedería SIN conceder ni avisar', async () => {
    datos({ citas: muchas(5, () => kine()), planes: [] });
    const filas = almacen();
    const notifs = avisos();

    const result = await evaluatePatientAchievements(nuevoId(), { dryRun: true });

    expect(result.granted).toEqual([{ key: 'kine_5', periodKey: 'once' }]);
    expect(filas).toHaveLength(0);
    expect(notifs).toHaveLength(0);
  });
});

describe('reconcilePatientAchievements: correcciones', () => {
  it('si una sesión se corrige y el logro ya no se cumple, queda EN REVISIÓN (no se borra) y se restaura al volver a cumplirse', async () => {
    const patientId = nuevoId();
    const citas = muchas(5, () => kine());
    datos({ citas, planes: [] });
    const filas = almacen();
    avisos();
    await evaluatePatientAchievements(patientId);
    expect(filas[0].status).toBe('active');

    // el profesional corrige una sesión a "ausente"
    citas[2].status = 'no-show';
    const flagged = await reconcilePatientAchievements(patientId);
    expect(flagged.flagged).toEqual([{ key: 'kine_5', periodKey: 'once' }]);
    expect(filas).toHaveLength(1);
    expect(filas[0].status).toBe('under_review');
    expect(filas[0].reviewNote).toMatch(/^\[auto\]/);

    // evaluar de nuevo NO concede un segundo logro
    await evaluatePatientAchievements(patientId);
    expect(filas).toHaveLength(1);

    // la corrección se revierte
    citas[2].status = 'completed';
    const restored = await reconcilePatientAchievements(patientId);
    expect(restored.restored).toEqual([{ key: 'kine_5', periodKey: 'once' }]);
    expect(filas[0].status).toBe('active');
    expect(filas[0].reviewNote).toBeUndefined();
  });

  it('una revisión puesta por una persona no se restaura sola', async () => {
    const patientId = nuevoId();
    datos({ citas: muchas(5, () => kine()), planes: [] });
    const filas = almacen([
      { _id: nuevoId(), patient: patientId, key: 'kine_5', periodKey: 'once', status: 'under_review', reviewNote: 'Revisado por Andrea: falta una sesión' }
    ]);

    const result = await reconcilePatientAchievements(patientId);

    expect(result.restored).toEqual([]);
    expect(filas[0].status).toBe('under_review');
  });

  it('también revisa los meses de constancia', async () => {
    const patientId = nuevoId();
    const p = plan(4);
    const citas = muchas(4, () => entreno(p));
    datos({ citas, planes: [p] });
    const filas = almacen();
    avisos();
    await evaluatePatientAchievements(patientId);

    citas[0].status = 'scheduled';
    const result = await reconcilePatientAchievements(patientId);

    expect(result.flagged).toEqual([{ key: 'consistency_month', periodKey: '2026-10' }]);
    expect(filas[0].status).toBe('under_review');
  });
});

describe('triggerAchievementEvaluation y programador', () => {
  it('nunca lanza error: lo registra para no tumbar la operación que lo disparó', async () => {
    vi.spyOn(Appointment, 'find').mockImplementation(() => { throw new Error('base caída'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(triggerAchievementEvaluation(nuevoId())).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it('la pasada del programador revisa a los pacientes con citas tocadas hace poco y sigue si uno falla', async () => {
    const buenos = [nuevoId(), nuevoId()];
    const malo = nuevoId();
    vi.spyOn(Appointment, 'distinct').mockResolvedValue([malo, ...buenos]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let llamada = 0;
    vi.spyOn(Appointment, 'find').mockImplementation(() => {
      llamada += 1;
      if (llamada === 1) throw new Error('un paciente con datos raros');
      return query(llamada % 2 === 0 ? muchas(5, () => kine()) : []);
    });
    vi.spyOn(ClientPlan, 'find').mockImplementation(() => query([]));
    vi.spyOn(AchievementPause, 'find').mockImplementation(() => query([]));
    almacen();
    avisos();

    const summary = await runAchievementSweep({ now: new Date('2026-10-14T12:00:00Z') });

    expect(summary.patients).toBe(3);
    expect(summary.failed).toBe(1);
    expect(Appointment.distinct).toHaveBeenCalledWith('patient', { updatedAt: { $gte: new Date('2026-10-11T12:00:00Z') } });
  });
});
