/**
 * PRUEBAS — Fase G del plan de logros: evolución corporal (peso) y fuerza (récords de carga).
 *
 * Reglas aprobadas — peso: solo con una meta activa; referencia real y fechada; un hito exige DOS mediciones
 * separadas por 14 días o más; una vez por umbral. Fuerza: mismo ejercicio y unidad, ≥3 registros previos, +2,5 %,
 * un aviso por ejercicio y semana, datos completos.
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
import { santiagoToUtc } from '../utils/timezone.js';
import { dayOf, isoWeekOf } from '../services/achievements/dates.js';
import {
  computeBodyCandidates,
  referenceOf,
  bodyMilestoneStillMet,
  bodyProgress,
  isActiveGoal,
  BODY_MILESTONES
} from '../services/achievements/body.js';
import {
  computeStrengthCandidates,
  allStrengthRecords,
  strengthRecordStillValid,
  normalizeExerciseName,
  strengthSummary
} from '../services/achievements/strength.js';
import { evaluatePatientAchievements, reconcilePatientAchievements } from '../services/achievements/index.js';
import { grantAchievement } from '../services/achievementService.js';
import {
  getMyBodyGoal,
  updateMyBodyGoal,
  updatePatientBodyGoal,
  getPatientBodyGoal,
  goalView
} from '../controllers/achievementController.js';
import achievementRouter from '../routes/achievementRoutes.js';
import { ACHIEVEMENTS, isValidPeriodKeyForKind, periodKindOf } from '../config/achievements.js';

vi.mock('../services/achievements/index.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, triggerAchievementEvaluation: vi.fn(async () => {}) };
});
import { triggerAchievementEvaluation } from '../services/achievements/index.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const claves = (c) => c.map((x) => x.key);

// ── Datos de prueba ─────────────────────────────────────────────────────────
const medicion = (dia, weight, mes = 10) => ({ _id: nuevoId(), date: santiagoToUtc(2026, mes, dia, 12), weight });
const meta = (extra = {}) => ({ direction: 'lose', enabled: true, startedAt: santiagoToUtc(2026, 10, 1, 9), ...extra });

describe('fechas (día de Chile y semana ISO)', () => {
  it('el día no se corre por la zona horaria del servidor', () => {
    // 23:30 del 14 en Santiago ya es 15 en UTC
    expect(dayOf(santiagoToUtc(2026, 10, 14, 23, 30))).toBe('2026-10-14');
    expect(dayOf(santiagoToUtc(2026, 10, 14, 12))).toBe('2026-10-14');
  });
  it('semanas ISO, incluidos los bordes de año', () => {
    expect(isoWeekOf('2026-01-01')).toBe('2026-W01');
    expect(isoWeekOf('2025-12-29')).toBe('2026-W01');
    expect(isoWeekOf('2026-12-31')).toBe('2026-W53');
    expect(isoWeekOf('2027-01-03')).toBe('2026-W53');
    expect(isoWeekOf('2026-10-12')).toBe('2026-W42');
    expect(isoWeekOf('2026-10-18')).toBe('2026-W42');
    expect(isoWeekOf('2026-10-19')).toBe('2026-W43');
  });
});

describe('evolución corporal: reglas del hito', () => {
  it('bajar: dos mediciones con 1 kg o más, separadas por 14 días, conceden "1 kg de evolución" (con evidencia real)', () => {
    const ref = medicion(1, 80);
    const a = medicion(10, 78.9);
    const b = medicion(25, 78.7);
    const result = computeBodyCandidates([ref, a, b], meta());

    expect(claves(result)).toEqual(['body_1kg']);
    expect(result[0].evidence.refs).toEqual([ref._id, a._id, b._id]);
    expect(result[0].evidence.values).toMatchObject({
      direction: 'lose',
      milestoneKg: 1,
      referenceWeight: 80,
      referenceDate: '2026-10-01',
      confirmedBy: [{ weight: 78.9, date: '2026-10-10' }, { weight: 78.7, date: '2026-10-25' }]
    });
  });

  it('una sola medición NO basta, aunque muestre el cambio', () => {
    expect(computeBodyCandidates([medicion(1, 80), medicion(10, 77)], meta())).toEqual([]);
  });

  it('dos mediciones con menos de 14 días de diferencia NO bastan; con exactamente 14 días SÍ', () => {
    const ref = medicion(1, 80);
    expect(computeBodyCandidates([ref, medicion(10, 78), medicion(23, 78)], meta())).toEqual([]);
    expect(claves(computeBodyCandidates([ref, medicion(10, 78), medicion(24, 78)], meta()))).toEqual(['body_1kg']);
  });

  it('una medición baja aislada entre mediciones sin cambio NO concede (no es una tendencia)', () => {
    expect(computeBodyCandidates([medicion(1, 80), medicion(10, 78), medicion(20, 80.2), medicion(30, 80.1)], meta())).toEqual([]);
  });

  it('subir: respeta el objetivo individual', () => {
    const result = computeBodyCandidates([medicion(1, 60), medicion(8, 61.2), medicion(25, 61.5)], meta({ direction: 'gain' }));
    expect(claves(result)).toEqual(['body_1kg']);
    expect(result[0].evidence.values.direction).toBe('gain');
  });

  it('bajar de peso con la meta de SUBIR (o al revés) no concede nada', () => {
    const bajando = [medicion(1, 80), medicion(10, 77), medicion(28, 76.5)];
    expect(computeBodyCandidates(bajando, meta({ direction: 'gain' }))).toEqual([]);
    const subiendo = [medicion(1, 60), medicion(10, 63), medicion(28, 63.5)];
    expect(computeBodyCandidates(subiendo, meta({ direction: 'lose' }))).toEqual([]);
  });

  it('sin meta, con la meta desactivada, o con "mantener", no se evalúa nada (no se asume que bajar sea el objetivo)', () => {
    const datos = [medicion(1, 80), medicion(10, 70), medicion(28, 69)];
    expect(computeBodyCandidates(datos, null)).toEqual([]);
    expect(computeBodyCandidates(datos, meta({ enabled: false }))).toEqual([]);
    expect(computeBodyCandidates(datos, meta({ direction: 'maintain' }))).toEqual([]);
    expect(computeBodyCandidates(datos, meta({ direction: undefined }))).toEqual([]);
    expect(isActiveGoal(meta())).toBe(true);
    expect(isActiveGoal(meta({ enabled: false }))).toBe(false);
  });

  it('los umbrales 1, 3, 5 y 10 kg son acumulativos y cada uno exige su propia confirmación', () => {
    const base = [medicion(1, 90)];
    const con = (peso) => computeBodyCandidates([...base, medicion(5, peso), medicion(25, peso)], meta());
    expect(claves(con(89.5))).toEqual([]);
    expect(claves(con(88.9))).toEqual(['body_1kg']);
    expect(claves(con(85.5))).toEqual(['body_1kg', 'body_3kg']); // 4,5 kg: aún no llega a 5
    expect(claves(con(84.9))).toEqual(['body_1kg', 'body_3kg', 'body_5kg']);
    expect(claves(con(79))).toEqual(['body_1kg', 'body_3kg', 'body_5kg', 'body_10kg']);
    expect(BODY_MILESTONES.map((m) => m.kg)).toEqual([1, 3, 5, 10]);
  });

  it('el peso que sube y baja alrededor del umbral produce los MISMOS candidatos (el índice único evita repetirlos)', () => {
    const datos = [medicion(1, 80), medicion(8, 78.9), medicion(15, 79.2), medicion(22, 78.8), medicion(29, 79.1), medicion(31, 78.5)];
    const una = computeBodyCandidates(datos, meta());
    const otra = computeBodyCandidates([...datos, medicion(20, 79.4, 11)], meta());
    expect(claves(una)).toEqual(['body_1kg']);
    expect(claves(otra)).toEqual(['body_1kg']);
    expect(una[0].periodKey).toBe('once');
  });

  it('la referencia es la ÚLTIMA medición hasta el día en que empezó la meta; las anteriores no cuentan', () => {
    const vieja = medicion(2, 95, 9);
    const ref = medicion(30, 80, 9);
    const goal = meta({ startedAt: santiagoToUtc(2026, 10, 1, 9) });
    expect(referenceOf([vieja, ref, medicion(10, 78)], goal)._id).toBe(ref._id);
    // la medición muy vieja no hace que "ya hayas bajado 15 kg"
    expect(computeBodyCandidates([vieja, ref, medicion(10, 79.5), medicion(30, 79.4)], goal)).toEqual([]);
  });

  it('si no hay medición hasta el inicio de la meta, la referencia es la primera posterior', () => {
    const primera = medicion(5, 80);
    expect(referenceOf([medicion(20, 78), primera], meta())._id).toBe(primera._id);
  });

  it('las mediciones sin peso o sin fecha se ignoran (no se inventa nada)', () => {
    const datos = [medicion(1, 80), { _id: nuevoId(), date: santiagoToUtc(2026, 10, 10, 12) }, { _id: nuevoId(), weight: 70 }, medicion(12, 0)];
    expect(computeBodyCandidates(datos, meta())).toEqual([]);
    expect(referenceOf([], meta())).toBeNull();
  });

  it('tras corregir una medición, el hito deja de cumplirse; con otra meta o sin meta no se puede juzgar', () => {
    const datos = [medicion(1, 80), medicion(10, 78), medicion(28, 78)];
    expect(bodyMilestoneStillMet(datos, meta(), 'body_1kg', 'lose')).toBe(true);
    datos[2].weight = 80; // se corrigió
    expect(bodyMilestoneStillMet(datos, meta(), 'body_1kg', 'lose')).toBe(false);
    // la persona cambió su meta o la desactivó: no se marca "en revisión" por eso
    expect(bodyMilestoneStillMet(datos, meta({ direction: 'gain' }), 'body_1kg', 'lose')).toBe(true);
    expect(bodyMilestoneStillMet(datos, meta({ enabled: false }), 'body_1kg', 'lose')).toBe(true);
    expect(bodyMilestoneStillMet(datos, null, 'body_1kg', 'lose')).toBe(true);
    expect(bodyMilestoneStillMet(datos, meta(), 'inventado')).toBe(false);
  });

  it('el progreso explica el cambio hacia la meta y el próximo hito', () => {
    expect(bodyProgress([], null)).toEqual({ active: false });
    expect(bodyProgress([], meta())).toMatchObject({ active: true, hasReference: false });
    const p = bodyProgress([medicion(1, 80), medicion(10, 78.4)], meta());
    expect(p).toMatchObject({ active: true, hasReference: true, referenceWeight: 80, progressKg: 1.6, nextKey: 'body_1kg', nextKg: 1 });
  });

  it('el catálogo no celebra la rapidez ni sugiere que un peso menor sea siempre mejor', () => {
    for (const m of BODY_MILESTONES) {
      const def = ACHIEVEMENTS[m.key];
      expect(def.category).toBe('cuerpo');
      expect(def.periodic).toBe(false);
      expect(def.criteria).toMatch(/meta corporal activa/i);
      expect(def.criteria).toMatch(/14 días/);
      expect(JSON.stringify(def)).not.toMatch(/r[aá]pid|cuanto antes|menos es mejor|delgad|perfecto|obes/i);
    }
  });
});

// ── Fuerza ──────────────────────────────────────────────────────────────────
const AHORA = santiagoToUtc(2026, 10, 14, 12);
let orden = 0;
const ejercicio = (nombre, weight, reps, dia, { mes = 10, unit = 'kg', sets = 3 } = {}) => ({
  _id: new mongoose.Types.ObjectId(`${(1000 + orden++).toString(16).padStart(8, '0')}${'0'.repeat(16)}`),
  exerciseName: nombre,
  weight,
  reps,
  sets,
  weightUnit: unit,
  date: santiagoToUtc(2026, mes, dia, 12)
});
// 3 registros previos de 100 kg, de septiembre
const base = (nombre = 'Sentadilla') => [ejercicio(nombre, 100, 5, 1, { mes: 9 }), ejercicio(nombre, 100, 5, 8, { mes: 9 }), ejercicio(nombre, 100, 5, 15, { mes: 9 })];

describe('fuerza: récord personal de carga', () => {
  it('con 3 registros previos, una carga 2,5 % o más mayor concede el récord (con la evidencia)', () => {
    const nuevo = ejercicio('Sentadilla', 105, 5, 13);
    const [candidate] = computeStrengthCandidates([...base(), nuevo], AHORA);

    expect(candidate).toMatchObject({ key: 'strength_pr', periodKey: 'sentadilla@2026-W42' });
    expect(candidate.evidence.refs).toEqual([nuevo._id]);
    expect(candidate.evidence.values).toMatchObject({ exercise: 'Sentadilla', previousBest: 100, weight: 105, unit: 'kg', reps: 5, date: '2026-10-13' });
  });

  it('umbral exacto: 102,5 kg (2,5 %) sí; 102 kg (2 %) no', () => {
    expect(computeStrengthCandidates([...base(), ejercicio('Sentadilla', 102.5, 5, 13)], AHORA)).toHaveLength(1);
    expect(computeStrengthCandidates([...base(), ejercicio('Sentadilla', 102, 5, 13)], AHORA)).toEqual([]);
  });

  it('con menos de 3 registros previos NO hay récord (no se inventan marcas históricas)', () => {
    const dos = base().slice(0, 2);
    expect(computeStrengthCandidates([...dos, ejercicio('Sentadilla', 120, 5, 13)], AHORA)).toEqual([]);
    expect(computeStrengthCandidates([ejercicio('Sentadilla', 120, 5, 13)], AHORA)).toEqual([]);
  });

  it('el nombre se normaliza (mayúsculas, tildes, espacios) pero otro ejercicio es otra marca', () => {
    expect(normalizeExerciseName('  Sentadilla  Búlgara ')).toBe('sentadilla-bulgara');
    expect(normalizeExerciseName('SENTADILLA')).toBe(normalizeExerciseName('sentadilla '));
    const mezclado = [...base('sentadilla'), ejercicio('  SENTADILLA ', 106, 5, 13)];
    expect(computeStrengthCandidates(mezclado, AHORA)).toHaveLength(1);
    // un ejercicio distinto con su propia historia vacía no hereda la marca
    expect(computeStrengthCandidates([...base('Sentadilla'), ejercicio('Prensa', 200, 5, 13)], AHORA)).toEqual([]);
  });

  it('kilos y libras NO se comparan', () => {
    expect(computeStrengthCandidates([...base(), ejercicio('Sentadilla', 300, 5, 13, { unit: 'lbs' })], AHORA)).toEqual([]);
  });

  it('un registro sin repeticiones o sin peso no cuenta (datos incompletos)', () => {
    const incompleto = { ...ejercicio('Sentadilla', 120, 5, 13), reps: undefined };
    const sinPeso = { ...ejercicio('Sentadilla', 0, 5, 13) };
    expect(computeStrengthCandidates([...base(), incompleto], AHORA)).toEqual([]);
    expect(computeStrengthCandidates([...base(), sinPeso], AHORA)).toEqual([]);
    // y un registro incompleto tampoco cuenta como "previo"
    const dosCompletos = [...base().slice(0, 2), { ...base()[2], reps: undefined }];
    expect(computeStrengthCandidates([...dosCompletos, ejercicio('Sentadilla', 120, 5, 13)], AHORA)).toEqual([]);
  });

  it('dos récords en la misma semana dan UN solo aviso; otra semana, otro', () => {
    const datos = [...base(), ejercicio('Sentadilla', 105, 5, 12), ejercicio('Sentadilla', 112, 5, 14), ejercicio('Sentadilla', 120, 5, 20)];
    // misma semana (lun 12 y mié 14): un solo aviso, el primer récord
    const dosEnUnaSemana = computeStrengthCandidates(datos.slice(0, 5), santiagoToUtc(2026, 10, 18, 12));
    expect(dosEnUnaSemana.map((c) => c.periodKey)).toEqual(['sentadilla@2026-W42']);
    expect(dosEnUnaSemana[0].evidence.values.weight).toBe(105);
    // otra semana (mar 20): otro récord, con su propia clave
    expect(allStrengthRecords(datos).map((r) => r.periodKey)).toEqual(['sentadilla@2026-W42', 'sentadilla@2026-W43']);
  });

  it('un récord viejo (más de 7 días) no genera aviso retroactivo, pero sí sirve de base de comparación', () => {
    const viejo = ejercicio('Sentadilla', 110, 5, 20, { mes: 9 });
    expect(computeStrengthCandidates([...base(), viejo], AHORA)).toEqual([]);
    // el récord viejo (110) es ahora la marca a superar: 112 no alcanza el 2,5 %, 113 sí
    expect(computeStrengthCandidates([...base(), viejo, ejercicio('Sentadilla', 112, 5, 13)], AHORA)).toEqual([]);
    expect(computeStrengthCandidates([...base(), viejo, ejercicio('Sentadilla', 113, 5, 13)], AHORA)).toHaveLength(1);
  });

  it('igualar o bajar la marca no es récord', () => {
    expect(computeStrengthCandidates([...base(), ejercicio('Sentadilla', 100, 5, 13), ejercicio('Sentadilla', 90, 8, 14)], AHORA)).toEqual([]);
  });

  it('un registro corregido se revalida: si ya no es récord, deja de ser válido', () => {
    const nuevo = ejercicio('Sentadilla', 105, 5, 13);
    const datos = [...base(), nuevo];
    expect(strengthRecordStillValid(datos, 'sentadilla@2026-W42')).toBe(true);
    nuevo.weight = 101; // se corrigió el peso
    expect(strengthRecordStillValid(datos, 'sentadilla@2026-W42')).toBe(false);
    expect(allStrengthRecords([])).toEqual([]);
  });

  it('el resumen por ejercicio entrega la mejor marca y cuántos registros hay', () => {
    expect(strengthSummary([...base(), ejercicio('Sentadilla', 105, 5, 13)])[0]).toEqual({ exercise: 'Sentadilla', unit: 'kg', best: 105, records: 4 });
  });

  it('el catálogo: texto con técnica e indicaciones del profesional, sin presión por subir carga', () => {
    const def = ACHIEVEMENTS.strength_pr;
    expect(def.message).toMatch(/buena técnica/);
    expect(def.message).toMatch(/indicaciones de tu profesional/);
    expect(def.criteria).toMatch(/2,5 %/);
    expect(def.criteria).toMatch(/3 registros previos/);
    expect(periodKindOf(def)).toBe('exercise-week');
    expect(JSON.stringify(def)).not.toMatch(/no pares|sin dolor|m[aá]s peso siempre|ahora m[aá]s/i);
  });
});

describe('periodos por ejercicio y semana', () => {
  it('validación de la clave según el tipo de periodo', () => {
    expect(isValidPeriodKeyForKind('exercise-week', 'sentadilla@2026-W42')).toBe(true);
    expect(isValidPeriodKeyForKind('exercise-week', 'press-de-banca@2026-W05')).toBe(true);
    expect(isValidPeriodKeyForKind('exercise-week', 'Sentadilla@2026-W42')).toBe(false);
    expect(isValidPeriodKeyForKind('exercise-week', 'sentadilla@2026-10')).toBe(false);
    expect(isValidPeriodKeyForKind('exercise-week', 'once')).toBe(false);
    expect(isValidPeriodKeyForKind('once', 'once')).toBe(true);
    expect(isValidPeriodKeyForKind('month', '2026-10')).toBe(true);
    expect(isValidPeriodKeyForKind('mes-inventado', 'once')).toBe(false);
  });

  it('grantAchievement acepta la clave de ejercicio-semana y rechaza una de otro tipo', async () => {
    vi.restoreAllMocks();
    vi.spyOn(AchievementAward, 'findOneAndUpdate').mockResolvedValue({ value: {}, lastErrorObject: { updatedExisting: true } });
    await expect(grantAchievement({ patientId: nuevoId(), key: 'strength_pr', periodKey: 'sentadilla@2026-W42' })).resolves.toMatchObject({ created: false });
    await expect(grantAchievement({ patientId: nuevoId(), key: 'strength_pr', periodKey: 'once' })).rejects.toThrow(/ejercicio y semana/);
    await expect(grantAchievement({ patientId: nuevoId(), key: 'body_1kg', periodKey: '2026-10' })).rejects.toThrow(/una sola vez/);
  });
});

// ── Servicio: evaluación completa con la base simulada ──────────────────────
const query = (value) => ({ select: () => query(value), lean: () => Promise.resolve(value) });

function montar({ medidas = [], ejercicios = [], goal = null }) {
  vi.restoreAllMocks();
  vi.spyOn(Appointment, 'find').mockImplementation(() => query([]));
  vi.spyOn(ClientPlan, 'find').mockImplementation(() => query([]));
  vi.spyOn(AchievementPause, 'find').mockImplementation(() => query([]));
  vi.spyOn(WellnessCheckin, 'find').mockImplementation(() => query([]));
  vi.spyOn(Measurement, 'find').mockImplementation(() => query(medidas));
  vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => query(ejercicios));
  vi.spyOn(User, 'findById').mockImplementation(() => query(goal ? { preferences: { bodyGoal: goal } } : null));
  vi.spyOn(AchievementAward, 'countDocuments').mockResolvedValue(0);
  const filas = [];
  const llave = (f) => `${f.patient}|${f.key}|${f.periodKey}`;
  vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
    const existing = filas.find((r) => llave(r) === llave(filter));
    if (update.$setOnInsert) {
      if (existing) return { value: existing, lastErrorObject: { updatedExisting: true } };
      const row = { _id: nuevoId(), ...filter, ...update.$setOnInsert };
      filas.push(row);
      return { value: row, lastErrorObject: { updatedExisting: false } };
    }
    const target = filas.find((r) => String(r.patient) === String(filter.patient) && r.key === filter.key && r.periodKey === filter.periodKey && (!filter.status || r.status === filter.status));
    if (!target) return null;
    Object.assign(target, update.$set);
    return target;
  });
  vi.spyOn(AchievementAward, 'find').mockImplementation(async (f) => filas.filter((r) => String(r.patient) === String(f.patient) && f.key.$in.includes(r.key)));
  const avisos = [];
  vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
    if (avisos.some((n) => n.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
    avisos.push(doc);
    return doc;
  });
  return { filas, avisos };
}

describe('servicio: peso y fuerza', () => {
  it('con meta activa concede el hito de peso UNA vez aunque se evalúe muchas veces; el aviso es genérico', async () => {
    const { filas, avisos } = montar({ medidas: [medicion(1, 80), medicion(10, 78.5), medicion(26, 78.4)], goal: meta() });
    const patientId = nuevoId();
    await evaluatePatientAchievements(patientId, { now: AHORA });
    await evaluatePatientAchievements(patientId, { now: AHORA });

    expect(filas.map((f) => f.key)).toEqual(['body_1kg']);
    expect(filas[0].category).toBe('cuerpo');
    expect(avisos).toHaveLength(1);
    expect(JSON.stringify({ t: avisos[0].title, b: avisos[0].body })).not.toMatch(/kg|peso|78|80/i);
  });

  it('sin meta definida no concede nada de peso, aunque haya cambios enormes', async () => {
    const { filas } = montar({ medidas: [medicion(1, 80), medicion(10, 60), medicion(26, 59)], goal: null });
    await evaluatePatientAchievements(nuevoId(), { now: AHORA });
    expect(filas).toEqual([]);
  });

  it('con la meta desactivada, los hitos ya ganados se conservan y no se juzgan', async () => {
    const patientId = nuevoId();
    const { filas } = montar({ medidas: [medicion(1, 80), medicion(10, 78.5), medicion(26, 78.4)], goal: meta() });
    await evaluatePatientAchievements(patientId, { now: AHORA });
    User.findById.mockImplementation(() => query({ preferences: { bodyGoal: meta({ enabled: false }) } }));
    const result = await reconcilePatientAchievements(patientId, { now: AHORA });
    expect(result.flagged).toEqual([]);
    expect(filas[0].status).toBe('active');
  });

  it('un récord de fuerza concede el logro y avisa; el 4.º de la semana se concede SIN aviso (tope de 3)', async () => {
    const ejercicios = ['Sentadilla', 'Prensa', 'Peso muerto', 'Remo'].flatMap((n) => [...base(n), ejercicio(n, 110, 5, 13)]);
    const { filas, avisos } = montar({ ejercicios });
    await evaluatePatientAchievements(nuevoId(), { now: AHORA });

    expect(filas.filter((f) => f.key === 'strength_pr')).toHaveLength(4);
    expect(avisos).toHaveLength(3);
    expect(filas.find((f) => f.key === 'strength_pr').category).toBe('fuerza');
  });

  it('si ya hubo 3 avisos de récords esta semana, los nuevos se conceden en silencio', async () => {
    const { filas, avisos } = montar({ ejercicios: [...base('Sentadilla'), ejercicio('Sentadilla', 110, 5, 13)] });
    AchievementAward.countDocuments.mockResolvedValue(3);
    await evaluatePatientAchievements(nuevoId(), { now: AHORA });
    expect(filas).toHaveLength(1);
    expect(avisos).toHaveLength(0);
  });

  it('un registro corregido que ya no es récord deja el logro EN REVISIÓN (no se borra) y se puede restaurar', async () => {
    const nuevo = ejercicio('Sentadilla', 110, 5, 13);
    const ejercicios = [...base('Sentadilla'), nuevo];
    const patientId = nuevoId();
    const { filas } = montar({ ejercicios });
    await evaluatePatientAchievements(patientId, { now: AHORA });
    expect(filas).toHaveLength(1);

    nuevo.weight = 100;
    const result = await reconcilePatientAchievements(patientId, { now: AHORA });
    expect(result.flagged).toEqual([{ key: 'strength_pr', periodKey: 'sentadilla@2026-W42' }]);
    expect(filas).toHaveLength(1);
    expect(filas[0].status).toBe('under_review');

    // y evaluar otra vez NO duplica
    await evaluatePatientAchievements(patientId, { now: AHORA });
    expect(filas).toHaveLength(1);
  });
});

// ── Meta corporal (API) ─────────────────────────────────────────────────────
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

describe('meta corporal (API)', () => {
  const PACIENTE = nuevoId();
  const usuario = (goal) => ({ _id: PACIENTE, role: 'patient', preferences: { bodyGoal: goal } });
  const mockUser = (goal, { role = 'patient' } = {}) => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ ...usuario(goal), role }) });
    return vi.spyOn(User, 'findByIdAndUpdate').mockImplementation(() => ({ select: () => Promise.resolve(usuario({ direction: 'lose', enabled: true, startedAt: new Date() })) }));
  };
  const req = (body, user = { _id: PACIENTE, role: 'patient' }) => ({ user, params: { patientId: PACIENTE.toString() }, body });

  beforeEach(() => { vi.restoreAllMocks(); triggerAchievementEvaluation.mockClear(); });

  it('sin meta: valores por defecto (sin dirección, activada)', async () => {
    mockUser(undefined);
    const res = fakeRes();
    await getMyBodyGoal(req(), res);
    expect(res.body.data.goal).toEqual({ direction: null, enabled: true, startedAt: null });
    expect(goalView(null)).toEqual({ direction: null, enabled: true, startedAt: null });
  });

  it('define la meta: guarda la dirección, fija el inicio de la referencia y vuelve a evaluar', async () => {
    const update = mockUser(undefined);
    const res = fakeRes();
    await updateMyBodyGoal(req({ direction: 'lose' }), res);

    expect(res.statusCode).toBe(200);
    const [id, cambios] = update.mock.calls[0];
    expect(id).toBe(PACIENTE);
    expect(cambios.$set['preferences.bodyGoal.direction']).toBe('lose');
    expect(cambios.$set['preferences.bodyGoal.startedAt']).toBeInstanceOf(Date);
    expect(triggerAchievementEvaluation).toHaveBeenCalledWith(PACIENTE);
  });

  it('cambiar de meta REINICIA la referencia; repetir la misma no', async () => {
    const empezo = new Date('2026-09-01T12:00:00Z');
    const update = mockUser({ direction: 'lose', enabled: true, startedAt: empezo });

    await updateMyBodyGoal(req({ direction: 'gain' }), fakeRes());
    expect(update.mock.calls[0][1].$set['preferences.bodyGoal.startedAt']).toBeInstanceOf(Date);

    update.mockClear();
    await updateMyBodyGoal(req({ direction: 'lose' }), fakeRes());
    expect(update.mock.calls[0][1].$set['preferences.bodyGoal.startedAt']).toBeUndefined();
  });

  it('desactivar la meta no evalúa nada; volver a activarla reinicia la referencia', async () => {
    const update = mockUser({ direction: 'lose', enabled: true, startedAt: new Date('2026-09-01T12:00:00Z') });
    await updateMyBodyGoal(req({ enabled: false }), fakeRes());
    expect(update.mock.calls[0][1].$set['preferences.bodyGoal.enabled']).toBe(false);
    expect(triggerAchievementEvaluation).not.toHaveBeenCalled();

    update.mockClear();
    mockUser({ direction: 'lose', enabled: false, startedAt: new Date('2026-09-01T12:00:00Z') });
    const reactivar = vi.mocked(User.findByIdAndUpdate);
    await updateMyBodyGoal(req({ enabled: true }), fakeRes());
    expect(reactivar.mock.calls[0][1].$set['preferences.bodyGoal.startedAt']).toBeInstanceOf(Date);
    expect(triggerAchievementEvaluation).toHaveBeenCalled();
  });

  it('quitar la meta (direction null) borra dirección e inicio', async () => {
    const update = mockUser({ direction: 'lose', enabled: true, startedAt: new Date() });
    await updateMyBodyGoal(req({ direction: null }), fakeRes());
    expect(update.mock.calls[0][1].$unset).toMatchObject({ 'preferences.bodyGoal.direction': '', 'preferences.bodyGoal.startedAt': '' });
  });

  it('rechaza valores inválidos sin guardar', async () => {
    const update = mockUser(undefined);
    for (const body of [{}, { direction: 'adelgazar' }, { direction: 5 }, { enabled: 'si' }]) {
      const res = fakeRes();
      await updateMyBodyGoal(req(body), res);
      expect(res.statusCode).toBe(400);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it('el personal solo gestiona a un PACIENTE (otro rol responde 404)', async () => {
    const update = mockUser(undefined, { role: 'admin' });
    const res = fakeRes();
    await updatePatientBodyGoal(req({ direction: 'gain' }, { _id: nuevoId(), role: 'professional' }), res);
    expect(res.statusCode).toBe(404);
    expect(update).not.toHaveBeenCalled();

    const lectura = fakeRes();
    await getPatientBodyGoal(req({}, { _id: nuevoId(), role: 'professional' }), lectura);
    expect(lectura.statusCode).toBe(404);
  });

  it('las rutas: la propia (solo paciente) y las de personal (con acceso al paciente)', () => {
    const rutas = achievementRouter.stack.filter((l) => l.route && l.route.path.endsWith('body-goal'));
    expect(rutas.map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`).sort()).toEqual([
      'get /body-goal',
      'get /patients/:patientId/body-goal',
      'put /body-goal',
      'put /patients/:patientId/body-goal'
    ]);
    // propia: authorize + manejador; de personal: authorize + acceso + manejador
    for (const l of rutas) expect(l.route.stack.length).toBe(l.route.path.startsWith('/patients') ? 3 : 2);
  });
});
