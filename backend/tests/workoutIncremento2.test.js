/**
 * PRUEBAS — Entrenamiento en curso, Incremento 2: registro de ejercicios, superseries y triseries.
 * Parte 1: reglas puras. Parte 2: controlador con la base simulada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../services/clientPlanService.js', () => ({ hasActivePlan: vi.fn() }));
vi.mock('../services/achievements/index.js', async (orig) => ({ ...(await orig()), triggerAchievementEvaluation: vi.fn(async () => undefined) }));
vi.mock('../services/notificationService.js', () => ({ notify: vi.fn(async () => undefined), notifyOnce: vi.fn(async () => undefined) }));

import { hasActivePlan } from '../services/clientPlanService.js';
import { triggerAchievementEvaluation } from '../services/achievements/index.js';
import { notify } from '../services/notificationService.js';
import WorkoutSession from '../models/WorkoutSession.js';
import ExerciseProgress from '../models/Exercise.js';
import { addBlock, saveSets, updateSet, deleteSet, searchExercises, finishWorkout, getSummary } from '../controllers/workoutController.js';
import { exerciseKey, cleanExerciseName, searchExercises as searchHistory } from '../services/exerciseNames.js';
import { validateBlockInput, validateSetInput, buildSummary } from '../services/workoutSets.js';
import { allStrengthRecords, computeStrengthCandidates } from '../services/achievements/strength.js';
import { santiagoToUtc } from '../utils/timezone.js';

const id = () => new mongoose.Types.ObjectId();
const at = (d, h = 12) => santiagoToUtc(2026, 10, d, h);

describe('identidad de los ejercicios', () => {
  it('mayúsculas, tildes y espacios no crean otro ejercicio; los nombres distintos NUNCA se unen', () => {
    expect(exerciseKey('Sentadilla Búlgara ')).toBe(exerciseKey('  sentadilla   bulgara'));
    expect(exerciseKey('Sentadilla búlgara')).not.toBe(exerciseKey('Sentadilla trasera'));
    expect(exerciseKey('Sentadilla')).not.toBe(exerciseKey('Sentadilla búlgara'));
  });
  it('limpia el nombre que se guarda y rechaza los inválidos', () => {
    expect(cleanExerciseName('  press   militar ')).toBe('Press militar');
    for (const bad of ['', ' ', 'a', '---', 'x'.repeat(61), null, undefined, 42]) expect(cleanExerciseName(bad)).toBeNull();
  });
});

describe('búsqueda en el historial propio', () => {
  const h = (name, extra = {}) => ({ key: exerciseKey(name), name, count: 5, days: 3, lastDate: at(18), last: { reps: 10, weight: 20, weightUnit: 'kg', durationSec: null, modality: 'weight' }, ...extra });
  const hist = [h('Sentadilla búlgara'), h('Sentadilla trasera', { lastDate: at(10), days: 1 }), h('Press militar', { lastDate: at(15), days: 4 }), h('Remo con mancuerna', { lastDate: at(5), days: 1 })];

  it('«sentadilla» encuentra la búlgara y la trasera, sin unirlas', () => {
    const r = searchHistory(hist, 'sentadilla');
    expect(r.matches.map((m) => m.name)).toEqual(['Sentadilla búlgara', 'Sentadilla trasera']);
    expect(r.exact).toBe(false);
  });
  it('entiende tildes y varias palabras en cualquier orden', () => {
    expect(searchHistory(hist, 'BULGARA sentadilla').matches.map((m) => m.name)).toEqual(['Sentadilla búlgara']);
    expect(searchHistory(hist, 'sentadilla búlgara').exact).toBe(true);
  });
  it('recientes (por fecha) y frecuentes (por días, mínimo 2)', () => {
    const r = searchHistory(hist, '');
    expect(r.recent[0].name).toBe('Sentadilla búlgara');
    expect(r.frequent.map((f) => f.name)).toEqual(['Press militar', 'Sentadilla búlgara']);
    expect(r.matches).toEqual([]);
  });
  it('un historial vacío no inventa nada', () => {
    expect(searchHistory([], 'x')).toEqual({ recent: [], frequent: [], matches: [], exact: false });
  });
});

describe('validación de bloques', () => {
  const slots = (n, modality = 'weight') => Array.from({ length: n }, (_, i) => ({ exerciseName: `Ejercicio ${i + 1}`, modality }));
  it('individual 1, superserie 2, triserie 3', () => {
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'single', slots: slots(1) }).error).toBeUndefined();
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'super', slots: slots(2) }).error).toBeUndefined();
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'tri', slots: slots(3) }).error).toBeUndefined();
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'super', slots: slots(3) }).error).toBeTruthy();
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'tri', slots: slots(2) }).error).toBeTruthy();
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'cuadri', slots: slots(4) }).error).toBeTruthy();
  });
  it('no repite el mismo ejercicio dentro de un bloque ni acepta modalidades inventadas', () => {
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'super', slots: [{ exerciseName: 'Remo' }, { exerciseName: 'remo ' }] }).error).toMatch(/repetir/);
    expect(validateBlockInput({ blockId: 'bloque-aaa1', kind: 'single', slots: [{ exerciseName: 'Remo', modality: 'cardio' }] }).error).toBeTruthy();
    expect(validateBlockInput({ blockId: 'corto', kind: 'single', slots: slots(1) }).error).toBeTruthy();
  });
});

describe('validación de series según la modalidad', () => {
  const ok = { clientId: 'serie-12345' };
  it('con peso: repeticiones enteras y carga mayor que 0', () => {
    expect(validateSetInput({ ...ok, reps: 10, weight: 20 }, { modality: 'weight' }).value).toMatchObject({ reps: 10, weight: 20, unit: 'kg' });
    for (const bad of [{ reps: 0, weight: 20 }, { reps: 10.5, weight: 20 }, { reps: 10 }, { reps: 10, weight: 0 }, { reps: 10, weight: -5 }, { reps: 10, weight: 5000 }, { reps: 10, weight: '20' }, { reps: 10, weight: 20, weightUnit: 'stone' }]) {
      expect(validateSetInput({ ...ok, ...bad }, { modality: 'weight' }).error).toBeTruthy();
    }
    expect(validateSetInput({ ...ok, reps: 10, weight: 45, weightUnit: 'lbs' }, { modality: 'weight' }).value.unit).toBe('lbs');
  });
  it('peso corporal: repeticiones sin carga externa (no se exigen kilos)', () => {
    expect(validateSetInput({ ...ok, reps: 15 }, { modality: 'bodyweight' }).value).toEqual({ reps: 15 });
    expect(validateSetInput({ ...ok, reps: 15, weight: 10 }, { modality: 'bodyweight' }).error).toBeTruthy();
  });
  it('por tiempo: segundos enteros, sin repeticiones ni conversiones', () => {
    expect(validateSetInput({ ...ok, durationSec: 30 }, { modality: 'time' }).value.durationSec).toBe(30);
    for (const bad of [{ durationSec: 0 }, { durationSec: 7201 }, { durationSec: 30.5 }, {}, { durationSec: 30, reps: 10 }]) {
      expect(validateSetInput({ ...ok, ...bad }, { modality: 'time' }).error).toBeTruthy();
    }
    expect(validateSetInput({ ...ok, reps: 10, durationSec: 30 }, { modality: 'weight' }).error).toBeTruthy();
  });
  it('exige la clave de idempotencia', () => {
    expect(validateSetInput({ reps: 10, weight: 20 }, { modality: 'weight' }).error).toBeTruthy();
    expect(validateSetInput({ clientId: 'corto', reps: 10, weight: 20 }, { modality: 'weight' }).error).toBeTruthy();
  });
});

describe('resumen con datos reales', () => {
  const set = (name, slot, over = {}) => ({ exerciseName: name, slot, reps: 10, weight: 20, weightUnit: 'kg', modality: 'weight', ...over });
  const session = { startedAt: at(20, 17), endedAt: at(20, 18) };

  it('una superserie de 2 ejercicios con 3 series cada uno cuenta 6 series', () => {
    const sets = [1, 2, 3].flatMap(() => [set('Sentadilla búlgara', 'A1'), set('Press militar', 'A2', { weight: 10, reps: 12 })]);
    const s = buildSummary(session, sets);
    expect(s.totals).toMatchObject({ exercises: 2, sets: 6, reps: 66 });
    expect(s.totals.volumeTons).toBeCloseTo((3 * 10 * 20 + 3 * 12 * 10) / 1000, 3);
    expect(s.durationSec).toBe(3600);
  });
  it('un ejercicio por tiempo suma segundos y no aporta volumen; sin cargas, el volumen es null (no se inventa)', () => {
    const s = buildSummary(session, [{ exerciseName: 'Plancha', slot: 'B3', durationSec: 30, modality: 'time' }, { exerciseName: 'Plancha', slot: 'B3', durationSec: 40, modality: 'time' }]);
    expect(s.totals).toMatchObject({ sets: 2, timeSec: 70, volumeTons: null });
    expect(s.exercises[0]).toMatchObject({ name: 'Plancha', timeSec: 70, bestWeight: null });
  });
  it('las libras no se convierten: quedan fuera del volumen y se avisa', () => {
    const s = buildSummary(session, [set('Press', 'A1'), set('Remo', 'A2', { weightUnit: 'lbs' })]);
    expect(s.totals.volumeTons).toBeCloseTo(0.2, 3);
    expect(s.totals.volumeExcludesLbs).toBe(true);
  });
  it('sin series no hay nada que resumir', () => {
    expect(buildSummary(session, []).totals).toMatchObject({ exercises: 0, sets: 0, volumeTons: null });
  });
});

describe('récords: se comparan DÍAS, no filas', () => {
  const rec = (day, weight, extra = {}) => ({ _id: id(), exerciseName: 'Sentadilla búlgara', weight, reps: 10, weightUnit: 'kg', date: at(day), ...extra });

  it('varias series ascendentes el mismo día NO generan un récord (16, 18, 20, 22 en una sola sesión)', () => {
    const hoy = [16, 18, 20, 22].map((w) => rec(20, w));
    expect(allStrengthRecords(hoy)).toEqual([]);
  });
  it('hacen falta 3 días anteriores con carga; el 4.º día con +2,5 % sí es récord', () => {
    const dias = [rec(5, 16), rec(8, 17), rec(11, 18), rec(20, 22), rec(20, 20)];
    const out = allStrengthRecords(dias);
    expect(out).toHaveLength(1);
    expect(out[0].record.weight).toBe(22);
    expect(out[0].previousBest).toBe(18);
  });
  it('con solo 2 días previos no hay récord, aunque haya muchas filas', () => {
    const dias = [rec(5, 16), rec(5, 17), rec(5, 18), rec(8, 17), rec(8, 17.5), rec(20, 30)];
    expect(allStrengthRecords(dias)).toEqual([]);
  });
  it('los registros sin carga (peso corporal o por tiempo) no son válidos para récords', () => {
    const sinCarga = [rec(5, 0), rec(8, 0), rec(11, 0), rec(20, 0, { weight: undefined, durationSec: 30 })];
    expect(allStrengthRecords(sinCarga)).toEqual([]);
    expect(computeStrengthCandidates(sinCarga, at(21))).toEqual([]);
  });
  it('un día solo cuenta una vez en la mejor carga del día', () => {
    const dias = [rec(5, 16), rec(5, 40), rec(8, 17), rec(11, 18), rec(20, 22)];
    // el día 5 aporta 40 como mejor carga: 22 no supera 40 → no es récord
    expect(allStrengthRecords(dias)).toEqual([]);
  });
});

// ── Controlador con la base simulada ─────────────────────────────────────────
const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const PACIENTE = { _id: id(), role: 'patient', firstName: 'Ana', lastName: 'Prueba', assignedProfessionalId: id() };
const lean = (v) => ({ select: () => lean(v), lean: () => Promise.resolve(v), sort: () => lean(v), limit: () => lean(v), then: (f) => Promise.resolve(v).then(f) });
const sesion = (over = {}) => {
  const base = { _id: id(), patient: PACIENTE._id, startedAt: at(21, 17), lastActivityAt: at(21, 17, 0), status: 'active', rest: { state: 'idle', durationSec: 120, nextDurationSec: 120, version: 0 }, blocks: [], ...over };
  base.save = vi.fn(async () => base);
  return base;
};
const bloque = (kind = 'super') => ({
  blockId: 'bloque-0001',
  kind,
  label: 'A',
  slots: kind === 'single' ? [{ slot: 'A1', exerciseName: 'Sentadilla búlgara', modality: 'weight' }] : kind === 'super' ? [{ slot: 'A1', exerciseName: 'Sentadilla búlgara', modality: 'weight' }, { slot: 'A2', exerciseName: 'Press militar', modality: 'weight' }] : [{ slot: 'B1', exerciseName: 'Peso muerto rumano', modality: 'weight' }, { slot: 'B2', exerciseName: 'Remo con mancuerna', modality: 'weight' }, { slot: 'B3', exerciseName: 'Plancha', modality: 'time' }]
});

// Almacén de series en memoria que imita lo que usa el controlador
function almacenSeries() {
  const rows = [];
  vi.spyOn(ExerciseProgress, 'findOne').mockImplementation((f) => lean(rows.find((r) => String(r.patient) === String(f.patient) && r.clientId === f.clientId) ?? null));
  vi.spyOn(ExerciseProgress, 'countDocuments').mockImplementation(async (f) => rows.filter((r) => String(r.workoutSession) === String(f.workoutSession) && r.slot === f.slot).length);
  const create = vi.spyOn(ExerciseProgress, 'create').mockImplementation(async (doc) => {
    if (rows.some((r) => String(r.patient) === String(doc.patient) && r.clientId === doc.clientId)) throw Object.assign(new Error('dup'), { code: 11000 });
    const row = { _id: id(), createdAt: new Date(), ...doc };
    rows.push(row);
    return row;
  });
  vi.spyOn(ExerciseProgress, 'find').mockImplementation((f) => lean(rows.filter((r) => !f?.workoutSession || String(r.workoutSession) === String(f.workoutSession))));
  return { rows, create };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(at(21, 17));
  hasActivePlan.mockReset();
  hasActivePlan.mockResolvedValue(true);
  triggerAchievementEvaluation.mockClear();
  notify.mockClear();
});

describe('POST /:id/blocks', () => {
  const llamar = async (body, { sesionActiva = sesion(), historial = [] } = {}) => {
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(sesionActiva);
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(lean(historial));
    const upd = vi.spyOn(WorkoutSession, 'findOneAndUpdate').mockImplementation(async (f, u) => ({ ...sesionActiva, blocks: [...sesionActiva.blocks, u.$push.blocks] }));
    const r = res();
    await addBlock({ user: PACIENTE, params: { id: String(sesionActiva._id) }, body }, r);
    return { r, upd };
  };

  it('un ejercicio que ya existe conserva su identidad (misma escritura del historial)', async () => {
    const historial = [{ exerciseName: 'Sentadilla Búlgara', date: at(15), reps: 10, weight: 20 }];
    const { r, upd } = await llamar({ blockId: 'bloque-0001', kind: 'single', slots: [{ exerciseName: '  sentadilla bulgara ', modality: 'weight' }] }, { historial });
    expect(r.statusCode).toBe(201);
    expect(upd.mock.calls[0][1].$push.blocks.slots[0].exerciseName).toBe('Sentadilla Búlgara');
    expect(r.body.data.session.blocks[0].slots[0].slot).toBe('A1');
  });
  it('un ejercicio nuevo se crea con el nombre limpio; la superserie asigna A1 y A2', async () => {
    const { r, upd } = await llamar({ blockId: 'bloque-0002', kind: 'super', slots: [{ exerciseName: 'remo   con barra' }, { exerciseName: 'press de banca', modality: 'weight' }] });
    expect(r.statusCode).toBe(201);
    const b = upd.mock.calls[0][1].$push.blocks;
    expect(b.slots.map((x) => [x.slot, x.exerciseName])).toEqual([['A1', 'Remo con barra'], ['A2', 'Press de banca']]);
  });
  it('reintentar el mismo bloque no lo duplica', async () => {
    const s = sesion({ blocks: [bloque('single')] });
    const { r, upd } = await llamar({ blockId: 'bloque-0001', kind: 'single', slots: [{ exerciseName: 'Otro' }] }, { sesionActiva: s });
    expect(r.statusCode).toBe(200);
    expect(r.body.data.resumed).toBe(true);
    expect(upd).not.toHaveBeenCalled();
  });
  it('rechaza nombres inválidos y formatos que no corresponden', async () => {
    const malo = await llamar({ blockId: 'bloque-0003', kind: 'single', slots: [{ exerciseName: 'x' }] });
    expect(malo.r.statusCode).toBe(400);
    const tri = await llamar({ blockId: 'bloque-0004', kind: 'tri', slots: [{ exerciseName: 'A b' }, { exerciseName: 'C d' }] });
    expect(tri.r.statusCode).toBe(400);
    expect(malo.upd).not.toHaveBeenCalled();
  });
  it('una sesión terminada no acepta bloques', async () => {
    const { r } = await llamar({ blockId: 'bloque-0005', kind: 'single', slots: [{ exerciseName: 'Remo' }] }, { sesionActiva: sesion({ status: 'finished' }) });
    expect(r.statusCode).toBe(409);
  });
});

describe('POST /:id/sets — guardado por lote', () => {
  const llamar = async (sets, { kind = 'super', blockId = 'bloque-0001', store, ses } = {}) => {
    const s = ses ?? sesion({ blocks: [bloque(kind)] });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'updateOne').mockResolvedValue({});
    const a = store ?? almacenSeries();
    const r = res();
    await saveSets({ user: PACIENTE, params: { id: String(s._id) }, body: { blockId, sets } }, r);
    return { r, ...a, s };
  };

  it('superserie con pesos y repeticiones DISTINTOS: cada ejercicio guarda su propia fila', async () => {
    const { r, rows } = await llamar([{ clientId: 'serie-A1-0001', slot: 'A1', reps: 10, weight: 20 }, { clientId: 'serie-A2-0001', slot: 'A2', reps: 12, weight: 10 }]);
    expect(r.statusCode).toBe(200);
    expect(rows).toHaveLength(2);
    expect(rows.map((x) => [x.exerciseName, x.slot, x.reps, x.weight, x.sets])).toEqual([['Sentadilla búlgara', 'A1', 10, 20, 1], ['Press militar', 'A2', 12, 10, 1]]);
    expect(rows.every((x) => x.source === 'workout' && x.blockKind === 'super' && x.setNumber === 1)).toBe(true);
    expect(rows.every((x) => String(x.patient) === String(PACIENTE._id) && x.date.getTime() === at(21, 17).getTime())).toBe(true);
  });

  it('guardado PARCIAL: solo A1; no se inventa una serie de A2', async () => {
    const { rows } = await llamar([{ clientId: 'serie-A1-0002', slot: 'A1', reps: 10, weight: 20 }]);
    expect(rows).toHaveLength(1);
    expect(rows.some((x) => x.slot === 'A2')).toBe(false);
  });

  it('reintentar el mismo envío NO duplica (misma clientId)', async () => {
    const store = almacenSeries();
    const lote = [{ clientId: 'serie-A1-0003', slot: 'A1', reps: 10, weight: 20 }];
    const a = await llamar(lote, { store });
    const b = await llamar(lote, { store });
    expect(store.rows).toHaveLength(1);
    expect(a.r.body.data.saved[0].created).toBe(true);
    expect(b.r.body.data.saved[0].created).toBe(false);
    expect(b.r.body.data.saved[0].set.id).toBe(a.r.body.data.saved[0].set.id);
  });

  it('dos envíos casi simultáneos: gana uno y el otro recibe esa misma serie', async () => {
    const store = almacenSeries();
    const existente = { _id: id(), patient: PACIENTE._id, clientId: 'serie-A1-0004', exerciseName: 'Sentadilla búlgara', slot: 'A1', reps: 10, weight: 20 };
    let primera = true;
    vi.spyOn(ExerciseProgress, 'findOne').mockImplementation(() => { if (primera) { primera = false; return lean(null); } return lean(existente); });
    vi.spyOn(ExerciseProgress, 'create').mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const s = sesion({ blocks: [bloque('super')] });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'updateOne').mockResolvedValue({});
    const r = res();
    await saveSets({ user: PACIENTE, params: { id: String(s._id) }, body: { blockId: 'bloque-0001', sets: [{ clientId: 'serie-A1-0004', slot: 'A1', reps: 10, weight: 20 }] } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.data.saved[0]).toMatchObject({ created: false });
    void store;
  });

  it('triserie con un ejercicio por tiempo y otro con carga: no se convierte nada a peso', async () => {
    const { rows } = await llamar(
      [{ clientId: 'serie-B1-0001', slot: 'B1', reps: 10, weight: 40 }, { clientId: 'serie-B2-0001', slot: 'B2', reps: 12, weight: 18 }, { clientId: 'serie-B3-0001', slot: 'B3', durationSec: 30 }],
      { kind: 'tri' }
    );
    expect(rows).toHaveLength(3);
    const plancha = rows.find((x) => x.slot === 'B3');
    expect(plancha).toMatchObject({ modality: 'time', durationSec: 30, duration: 0.5 });
    expect(plancha.weight).toBeUndefined();
    expect(plancha.reps).toBeUndefined();
  });

  it('el número de serie avanza por ejercicio', async () => {
    const store = almacenSeries();
    const ses = sesion({ blocks: [bloque('super')] });
    await llamar([{ clientId: 'serie-A1-0010', slot: 'A1', reps: 10, weight: 20 }], { store, ses });
    await llamar([{ clientId: 'serie-A1-0011', slot: 'A1', reps: 10, weight: 22 }, { clientId: 'serie-A2-0011', slot: 'A2', reps: 12, weight: 10 }], { store, ses });
    expect(store.rows.filter((x) => x.slot === 'A1').map((x) => x.setNumber)).toEqual([1, 2]);
    expect(store.rows.filter((x) => x.slot === 'A2').map((x) => x.setNumber)).toEqual([1]);
  });

  it('un dato inválido en el lote NO guarda nada (ni lo bueno)', async () => {
    const { r, rows } = await llamar([{ clientId: 'serie-A1-0020', slot: 'A1', reps: 10, weight: 20 }, { clientId: 'serie-A2-0020', slot: 'A2', reps: 0, weight: 10 }]);
    expect(r.statusCode).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('no acepta ejercicios que no son del bloque, repetidos en el lote ni lotes vacíos', async () => {
    expect((await llamar([{ clientId: 'serie-X-00001', slot: 'Z9', reps: 10, weight: 20 }])).r.statusCode).toBe(400);
    expect((await llamar([{ clientId: 'serie-A1-0030', slot: 'A1', reps: 10, weight: 20 }, { clientId: 'serie-A1-0031', slot: 'A1', reps: 10, weight: 20 }])).r.statusCode).toBe(400);
    expect((await llamar([])).r.statusCode).toBe(400);
    expect((await llamar([{ clientId: 'serie-A1-0032', slot: 'A1', reps: 10, weight: 20 }], { blockId: 'no-existe-0000' })).r.statusCode).toBe(404);
  });

  it('plan vencido: 403 y no se guarda nada', async () => {
    hasActivePlan.mockResolvedValue(false);
    const { r, rows } = await llamar([{ clientId: 'serie-A1-0040', slot: 'A1', reps: 10, weight: 20 }]);
    expect(r.statusCode).toBe(403);
    expect(rows).toHaveLength(0);
  });

  it('no avisa al profesional por cada serie (solo al finalizar) y evalúa logros UNA vez por lote', async () => {
    await llamar([{ clientId: 'serie-A1-0050', slot: 'A1', reps: 10, weight: 20 }, { clientId: 'serie-A2-0050', slot: 'A2', reps: 12, weight: 10 }]);
    expect(notify).not.toHaveBeenCalled();
    expect(triggerAchievementEvaluation).toHaveBeenCalledTimes(1);
  });

  it('una sesión de otra persona o terminada no recibe series', async () => {
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(null);
    const r = res();
    await saveSets({ user: PACIENTE, params: { id: String(id()) }, body: { blockId: 'bloque-0001', sets: [{ clientId: 'serie-A1-0060', slot: 'A1', reps: 10, weight: 20 }] } }, r);
    expect(r.statusCode).toBe(404);
    const cerrada = sesion({ status: 'finished', blocks: [bloque('super')] });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(cerrada);
    const r2 = res();
    await saveSets({ user: PACIENTE, params: { id: String(cerrada._id) }, body: { blockId: 'bloque-0001', sets: [{ clientId: 'serie-A1-0061', slot: 'A1', reps: 10, weight: 20 }] } }, r2);
    expect(r2.statusCode).toBe(409);
  });

  it('NUNCA toca citas ni planes al guardar series', async () => {
    const { default: Appointment } = await import('../models/Appointment.js');
    const { default: ClientPlan } = await import('../models/ClientPlan.js');
    const a = vi.spyOn(Appointment, 'updateOne');
    const p = vi.spyOn(ClientPlan, 'updateOne');
    await llamar([{ clientId: 'serie-A1-0070', slot: 'A1', reps: 10, weight: 20 }]);
    expect(a).not.toHaveBeenCalled();
    expect(p).not.toHaveBeenCalled();
  });
});

describe('corregir y eliminar series', () => {
  const montar = (docOver = {}, sesionOver = {}) => {
    const s = sesion({ blocks: [bloque('super')], ...sesionOver });
    const doc = { _id: id(), patient: PACIENTE._id, source: 'workout', workoutSession: s._id, modality: 'weight', weightUnit: 'kg', reps: 10, weight: 20, clientId: 'serie-A1-0099', slot: 'A1', exerciseName: 'Sentadilla búlgara', ...docOver };
    doc.save = vi.fn(async () => doc);
    doc.deleteOne = vi.fn(async () => doc);
    vi.spyOn(ExerciseProgress, 'findOne').mockResolvedValue(doc);
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(s);
    vi.spyOn(WorkoutSession, 'updateOne').mockResolvedValue({});
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(lean([]));
    return { s, doc };
  };

  it('corrige repeticiones y carga de una serie propia de la sesión activa', async () => {
    const { doc } = montar();
    const r = res();
    await updateSet({ user: PACIENTE, params: { setId: String(doc._id) }, body: { reps: 8, weight: 22.5 } }, r);
    expect(r.statusCode).toBe(200);
    expect([doc.reps, doc.weight]).toEqual([8, 22.5]);
    expect(doc.save).toHaveBeenCalled();
  });
  it('valida igual que al crear (carga 0 o repeticiones 0 no se aceptan)', async () => {
    const { doc } = montar();
    const r = res();
    await updateSet({ user: PACIENTE, params: { setId: String(doc._id) }, body: { reps: 0, weight: 20 } }, r);
    expect(r.statusCode).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });
  it('una serie de otra persona, o de una sesión terminada, no se puede tocar', async () => {
    vi.spyOn(ExerciseProgress, 'findOne').mockResolvedValue(null);
    const r = res();
    await updateSet({ user: PACIENTE, params: { setId: String(id()) }, body: { reps: 8, weight: 20 } }, r);
    expect(r.statusCode).toBe(404);
    const { doc } = montar({}, { status: 'finished' });
    const r2 = res();
    await deleteSet({ user: PACIENTE, params: { setId: String(doc._id) } }, r2);
    expect(r2.statusCode).toBe(409);
    expect(doc.deleteOne).not.toHaveBeenCalled();
  });
  it('el filtro de búsqueda siempre incluye al paciente y el origen «workout»', async () => {
    const { doc } = montar();
    const r = res();
    await deleteSet({ user: PACIENTE, params: { setId: String(doc._id) } }, r);
    const filtro = ExerciseProgress.findOne.mock.calls[0][0];
    expect(String(filtro.patient)).toBe(String(PACIENTE._id));
    expect(filtro.source).toBe('workout');
    expect(doc.deleteOne).toHaveBeenCalled();
  });
  it('un id inválido responde 404', async () => {
    const r = res();
    await deleteSet({ user: PACIENTE, params: { setId: 'basura' } }, r);
    expect(r.statusCode).toBe(404);
  });
});

describe('búsqueda por la API y finalizar con series reales', () => {
  it('la búsqueda usa solo el historial del propio paciente', async () => {
    const find = vi.spyOn(ExerciseProgress, 'find').mockReturnValue(lean([{ exerciseName: 'Sentadilla búlgara', date: at(15), reps: 10, weight: 20, weightUnit: 'kg' }]));
    const r = res();
    await searchExercises({ user: PACIENTE, query: { q: 'sentadilla' } }, r);
    expect(String(find.mock.calls[0][0].patient)).toBe(String(PACIENTE._id));
    expect(r.body.data.matches[0]).toMatchObject({ name: 'Sentadilla búlgara', last: { reps: 10, weight: 20 } });
  });

  it('finalizar avisa UNA vez al profesional (sin cifras de salud) y entrega el resumen real', async () => {
    const s = sesion({ blocks: [bloque('super')], startedAt: at(21, 15) });
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    const sets = [1, 2, 3].flatMap((n) => [{ _id: id(), exerciseName: 'Sentadilla búlgara', slot: 'A1', reps: 10, weight: 20, weightUnit: 'kg', modality: 'weight' }, { _id: id(), exerciseName: 'Press militar', slot: 'A2', reps: 12, weight: 10, weightUnit: 'kg', modality: 'weight' }]);
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(lean(sets));
    const r = res();
    await finishWorkout({ user: PACIENTE, params: { id: String(s._id) } }, r);
    expect(r.body.data.summary.totals).toMatchObject({ sets: 6, exercises: 2 });
    expect(r.body.data.summary.durationSec).toBe(2 * 3600);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][2].body).toMatch(/6 series/);
    expect(notify.mock.calls[0][2].body).not.toMatch(/kg|sentadilla/i);
    // repetir Finalizar no vuelve a avisar
    const r2 = res();
    await finishWorkout({ user: PACIENTE, params: { id: String(s._id) } }, r2);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('finalizar sin series no avisa al profesional', async () => {
    const s = sesion();
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(lean([]));
    const r = res();
    await finishWorkout({ user: PACIENTE, params: { id: String(s._id) } }, r);
    expect(notify).not.toHaveBeenCalled();
    expect(r.body.data.summary.totals.sets).toBe(0);
  });

  it('el resumen de otra persona responde 404', async () => {
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(null);
    const r = res();
    await getSummary({ user: PACIENTE, params: { id: String(id()) } }, r);
    expect(r.statusCode).toBe(404);
  });
});

describe('integración con Ejercicios (mismo historial, mismas métricas)', () => {
  it('las series guardadas son filas normales: el gráfico (mayor carga del día) y el volumen las leen sin cambios', async () => {
    const { weightSeries, totalVolumeTons, sessionDays } = await import('../../src/lib/exerciseSeries.ts');
    const store = almacenSeries();
    // Día 1: 10×16, 10×18, 8×20  ·  Día 2: 10×22 (mismo ejercicio, mismo nombre)
    for (const [day, series] of [[14, [[10, 16], [10, 18], [8, 20]]], [21, [[10, 22]]]]) {
      vi.setSystemTime(at(day, 17));
      const s = sesion({ blocks: [bloque('single')], _id: id() });
      vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(s);
      vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(s);
      vi.spyOn(WorkoutSession, 'updateOne').mockResolvedValue({});
      let n = 0;
      for (const [reps, weight] of series) {
        n += 1;
        await saveSets({ user: PACIENTE, params: { id: String(s._id) }, body: { blockId: 'bloque-0001', sets: [{ clientId: `serie-d${day}-n${n}-x`, slot: 'A1', reps, weight }] } }, res());
      }
    }
    const filas = store.rows.map((r) => ({ _id: String(r._id), exerciseName: r.exerciseName, date: new Date(r.date).toISOString(), sets: r.sets, reps: r.reps, weight: r.weight, weightUnit: r.weightUnit, category: r.category }));
    expect(filas.every((f) => f.exerciseName === 'Sentadilla búlgara')).toBe(true);
    expect(weightSeries(filas).map((p) => p.value)).toEqual([20, 22]);
    expect(sessionDays(filas)).toBe(2);
    expect(totalVolumeTons(filas)).toBeCloseTo((10 * 16 + 10 * 18 + 8 * 20 + 10 * 22) / 1000, 3);
  });
});
