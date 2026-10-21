/**
 * PRUEBAS — Mi camino PRIME, parte 3: "Primera sesión completada" y "Primer registro de progreso".
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
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { computeFirstsCandidates, firstsStillMet, firstCompletedSession, RETRO_DAYS } from '../services/achievements/firsts.js';
import { evaluatePatientAchievements, reconcilePatientAchievements } from '../services/achievements/index.js';
import { buildOverview } from '../services/achievements/overview.js';

const id = () => new mongoose.Types.ObjectId();
const NOW = new Date('2026-10-20T15:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const cita = (type, status, date, extra = {}) => ({ _id: id(), type, status, date, startTime: '10:00', ...extra });

describe('regla de la primera sesión', () => {
  it('cuenta kinesiología y entrenamiento completados; no reservas, canceladas, ausencias ni evaluaciones', () => {
    const citas = [cita('kinesiologia', 'scheduled', daysAgo(5)), cita('entrenamiento', 'cancelled', daysAgo(4)), cita('entrenamiento', 'no-show', daysAgo(3)), cita('evaluacion', 'completed', daysAgo(2))];
    expect(computeFirstsCandidates(citas, {}, NOW)).toEqual([]);
    const real = cita('entrenamiento', 'completed', daysAgo(1));
    const out = computeFirstsCandidates([...citas, real], {}, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'first_session', periodKey: 'once', silent: false });
    expect(out[0].evidence.refs).toEqual([real._id]);
  });

  it('usa la más antigua aunque haya muchas, y devuelve un solo candidato', () => {
    const vieja = cita('kinesiologia', 'completed', daysAgo(3));
    const citas = [cita('entrenamiento', 'completed', daysAgo(1)), vieja, cita('entrenamiento', 'completed', daysAgo(2))];
    expect(firstCompletedSession(citas)._id).toBe(vieja._id);
    expect(computeFirstsCandidates(citas, {}, NOW).filter((c) => c.key === 'first_session')).toHaveLength(1);
  });
});

describe('regla del primer registro de progreso', () => {
  it('toma el registro más antiguo entre mediciones y ejercicios', () => {
    const m = { _id: id(), date: daysAgo(3) };
    const e = { _id: id(), date: daysAgo(6) };
    const out = computeFirstsCandidates([], { measurement: m, exercise: e }, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'first_progress', periodKey: 'once' });
    expect(out[0].evidence).toMatchObject({ refs: [e._id], refModel: 'ExerciseProgress' });
  });

  it('sin registros no concede nada', () => {
    expect(computeFirstsCandidates([], { measurement: null, exercise: null }, NOW)).toEqual([]);
    expect(computeFirstsCandidates([], undefined, NOW)).toEqual([]);
  });
});

describe('hechos antiguos se conceden en silencio', () => {
  it(`más de ${RETRO_DAYS} días: sin aviso ni animación; con fecha real`, () => {
    const antigua = cita('entrenamiento', 'completed', daysAgo(RETRO_DAYS + 1));
    const [c] = computeFirstsCandidates([antigua], {}, NOW);
    expect(c.silent).toBe(true);
    expect(c.awardedAt).toEqual(antigua.date);
    const [reciente] = computeFirstsCandidates([cita('entrenamiento', 'completed', daysAgo(RETRO_DAYS - 1))], {}, NOW);
    expect(reciente.silent).toBe(false);
  });
});

describe('firstsStillMet', () => {
  it('deja de cumplirse si ya no hay datos que lo respalden', () => {
    expect(firstsStillMet('first_session', [cita('entrenamiento', 'completed', daysAgo(1))], {})).toBe(true);
    expect(firstsStillMet('first_session', [cita('entrenamiento', 'scheduled', daysAgo(1))], {})).toBe(false);
    expect(firstsStillMet('first_progress', [], { measurement: { _id: id(), date: daysAgo(1) } })).toBe(true);
    expect(firstsStillMet('first_progress', [], {})).toBe(false);
  });
});

// ── Con el servicio y la base simulada ───────────────────────────────────────
const query = (value) => ({ select: () => query(value), sort: () => query(value), lean: () => Promise.resolve(value) });

function mundo({ citas = [], medicion = null, ejercicio = null }) {
  vi.spyOn(Appointment, 'find').mockImplementation(() => query(citas));
  vi.spyOn(ClientPlan, 'find').mockImplementation(() => query([]));
  vi.spyOn(AchievementPause, 'find').mockImplementation(() => query([]));
  vi.spyOn(WellnessCheckin, 'find').mockImplementation(() => query([]));
  vi.spyOn(Measurement, 'find').mockImplementation(() => query([]));
  vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => query([]));
  vi.spyOn(Measurement, 'findOne').mockImplementation(() => query(medicion));
  vi.spyOn(ExerciseProgress, 'findOne').mockImplementation(() => query(ejercicio));
  vi.spyOn(User, 'findById').mockImplementation(() => query(null));
  const rows = [];
  const key = (f) => `${f.patient}|${f.key}|${f.periodKey}`;
  vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
    const existing = rows.find((r) => key(r) === key(filter));
    if (update.$setOnInsert) {
      if (existing) return { value: existing, lastErrorObject: { updatedExisting: true } };
      const row = { _id: id(), ...filter, ...update.$setOnInsert };
      rows.push(row);
      return { value: row, lastErrorObject: { updatedExisting: false } };
    }
    return null;
  });
  vi.spyOn(AchievementAward, 'find').mockImplementation(async (f) => rows.filter((r) => String(r.patient) === String(f.patient) && f.key.$in.includes(r.key)));
  const avisos = [];
  vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
    if (avisos.some((a) => a.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
    avisos.push(doc);
    return doc;
  });
  return { rows, avisos };
}

beforeEach(() => vi.restoreAllMocks());

describe('evaluación completa', () => {
  it('concede cada primero una sola vez, con aviso genérico, aunque se evalúe muchas veces', async () => {
    const { rows, avisos } = mundo({ citas: [cita('entrenamiento', 'completed', daysAgo(1)), cita('entrenamiento', 'completed', daysAgo(2))], medicion: { _id: id(), date: daysAgo(1) } });
    const p = id();
    for (let i = 0; i < 3; i += 1) await evaluatePatientAchievements(p, { now: NOW });
    expect(rows.map((r) => r.key).sort()).toEqual(['first_progress', 'first_session']);
    expect(avisos).toHaveLength(2);
    expect(avisos[0].body).not.toMatch(/medici|sesi/i); // el aviso no lleva datos corporales ni clínicos
  });

  it('un primero antiguo queda en el historial sin aviso y ya "visto"', async () => {
    const { rows, avisos } = mundo({ citas: [cita('entrenamiento', 'completed', daysAgo(90))] });
    await evaluatePatientAchievements(id(), { now: NOW });
    expect(rows).toHaveLength(1);
    expect(avisos).toHaveLength(0);
    expect(rows[0].seenAt).toBeInstanceOf(Date);
    expect(rows[0].awardedAt).toEqual(daysAgo(90));
  });

  it('un registro de progreso borrado deja el logro en revisión, no lo retira', async () => {
    const m = { _id: id(), date: daysAgo(1) };
    const { rows } = mundo({ medicion: m });
    const p = id();
    await evaluatePatientAchievements(p, { now: NOW });
    expect(rows).toHaveLength(1);
    vi.spyOn(Measurement, 'findOne').mockImplementation(() => query(null)); // el registro se eliminó
    vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (f, u) => (u.$set ? Object.assign(rows[0], u.$set) : null));
    const r = await reconcilePatientAchievements(p, { now: NOW });
    expect(r.flagged).toEqual([{ key: 'first_progress', periodKey: 'once' }]);
    expect(rows).toHaveLength(1);
  });
});

describe('Mis logros', () => {
  const vacio = () => ({ appointments: [], plans: [], pauses: [], checkins: [], measurements: [], exercises: [], goal: null, awards: [], firstRecords: {} });
  it('"Primeros pasos" no aparece sin datos y aparece en cuanto hay una cita o un registro', () => {
    expect(buildOverview(vacio(), { now: NOW }).categories.find((c) => c.key === 'primeros')).toBeUndefined();
    const con = { ...vacio(), firstRecords: { measurement: { _id: id(), date: daysAgo(1) } } };
    const cat = buildOverview(con, { now: NOW }).categories.find((c) => c.key === 'primeros');
    expect(cat.items.map((i) => i.key)).toEqual(['first_session', 'first_progress']);
  });
});
