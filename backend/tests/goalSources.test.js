/**
 * PRUEBAS — Vinculación de los objetivos con los registros que el centro YA guarda (Ejercicios, Mediciones, EVA y registros manuales).
 * Se usan modelos simulados: nada de esto toca una base de datos.
 */
import { describe, it, expect } from 'vitest';
import { makeSourceReader } from '../services/goals/goalSources.js';
import { computeIndicatorProgress } from '../services/goals/goalProgress.js';

const chain = (rows) => ({ select: () => chain(rows), sort: () => chain(rows), limit: () => chain(rows), lean: async () => rows, then: undefined });
const model = (rows) => ({ find: () => chain(rows) });
let n = 0;
const id = () => `id${n++}`;
const d = (day) => new Date(`${day}T15:00:00Z`);

const exercises = [
  { _id: id(), exerciseName: 'Press Banca', weight: 60, weightUnit: 'kg', reps: 8, date: d('2026-09-01') },
  { _id: id(), exerciseName: 'press banca', weight: 62.5, weightUnit: 'kg', reps: 8, date: d('2026-09-01') }, // mismo día: gana la mayor carga
  { _id: id(), exerciseName: 'PRESS BANCA', weight: 67.5, weightUnit: 'kg', reps: 5, date: d('2026-10-01') },
  { _id: id(), exerciseName: 'Press banca', weight: 200, weightUnit: 'lbs', reps: 5, date: d('2026-10-05') }, // libras: no se mezclan
  { _id: id(), exerciseName: 'Press banca inclinado', weight: 90, weightUnit: 'kg', reps: 5, date: d('2026-10-06') }, // otro ejercicio
  { _id: id(), exerciseName: 'Press banca', weight: 80, weightUnit: 'kg', date: d('2026-10-07') }, // sin repeticiones: dato incompleto
];
const measurements = [
  { _id: id(), date: d('2026-09-01'), weight: 85, perimeters: { bicepFlexedRight: 34, bicepFlexedLeft: 33, bicepRight: 31, waist: 94 }, bodyFatPercentage: 24 },
  { _id: id(), date: d('2026-10-01'), weight: 82, perimeters: { bicepFlexedRight: 35.5, bicepRight: 32, waist: 90 } },
];
const evas = [
  { _id: id(), date: d('2026-09-01'), painLevel: 6, bodyArea: 'rodilla-derecha' },
  { _id: id(), date: d('2026-09-01'), painLevel: 9, bodyArea: 'rodilla-izquierda' },
  { _id: id(), date: d('2026-10-01'), painLevel: 3, bodyArea: 'rodilla-derecha' },
];
const checkins = [
  { _id: id(), seriesKey: 'stress_perceived', unit: '/10', value: 7, day: '2026-09-01', source: 'self_report' },
  { _id: id(), seriesKey: 'stress_perceived', unit: '/10', value: 5, day: '2026-10-01', source: 'self_report' },
  { _id: id(), seriesKey: 'otra', unit: '/10', value: 1, day: '2026-10-01', source: 'self_report' },
];
const reader = () => makeSourceReader('p1', { Exercise: model(exercises), Measurement: model(measurements), EVA: model(evas), GoalCheckin: model(checkins) });
const ind = (over) => ({ params: {}, ...over });

describe('Press banca alimenta el objetivo de fuerza', () => {
  it('toma la mayor carga en kg de cada día, solo de ESE ejercicio (sin libras, sin otras variantes, sin datos incompletos)', async () => {
    const s = await reader().series(ind({ source: 'exercise_load', indicatorId: 'exercise_max_load', params: { exerciseKey: 'press banca' } }));
    expect(s.map((x) => [x.day, x.value])).toEqual([['2026-09-01', 62.5], ['2026-10-01', 67.5]]);
    expect(s[0].refModel).toBe('ExerciseProgress');
  });
  it('y el objetivo avanza con esa serie: 62,5 → 67,5 hacia 75', async () => {
    const series = await reader().series(ind({ source: 'exercise_load', indicatorId: 'exercise_max_load', params: { exerciseKey: 'press banca' } }));
    const r = computeIndicatorProgress({ indicatorId: 'exercise_max_load', label: 'x', unit: 'kg', direction: 'increase', target: { value: 75 } }, series, '2026-09-01');
    expect(r.current.value).toBe(67.5);
    expect(r.remaining).toBe(7.5);
  });
  it('las repeticiones se siguen solo con UNA carga', async () => {
    const s = await reader().series(ind({ source: 'exercise_reps', params: { exerciseKey: 'press banca', loadKg: 67.5 } }));
    expect(s.map((x) => [x.day, x.value])).toEqual([['2026-10-01', 5]]);
    expect(await reader().series(ind({ source: 'exercise_reps', params: { exerciseKey: 'press banca', loadKg: 70 } }))).toEqual([]);
  });
});

describe('fuerza = mejor marca acumulada', () => {
  it('una sesión más liviana no hace retroceder tu carga máxima', async () => {
    const rows = [
      { _id: 'a', exerciseName: 'Sentadilla', weight: 80, weightUnit: 'kg', reps: 5, date: d('2026-09-01') },
      { _id: 'b', exerciseName: 'Sentadilla', weight: 60, weightUnit: 'kg', reps: 8, date: d('2026-09-10') },
      { _id: 'c', exerciseName: 'Sentadilla', weight: 85, weightUnit: 'kg', reps: 3, date: d('2026-09-20') },
    ];
    const r = makeSourceReader('p1', { Exercise: model(rows) });
    const s = await r.series(ind({ source: 'exercise_load', params: { exerciseKey: 'sentadilla' } }));
    expect(s.map((x) => [x.day, x.value])).toEqual([['2026-09-01', 80], ['2026-09-10', 80], ['2026-09-20', 85]]);
  });
});

describe('Mediciones alimentan masa muscular, cintura y peso', () => {
  it('bíceps contraído DERECHO: no mezcla el izquierdo ni el relajado', async () => {
    const right = await reader().series(ind({ source: 'measurement_perimeter', params: { field: 'bicepFlexedRight' } }));
    expect(right.map((x) => x.value)).toEqual([34, 35.5]);
    const left = await reader().series(ind({ source: 'measurement_perimeter', params: { field: 'bicepFlexedLeft' } }));
    expect(left.map((x) => x.value)).toEqual([33]);
    const relaxed = await reader().series(ind({ source: 'measurement_perimeter', params: { field: 'bicepRight' } }));
    expect(relaxed.map((x) => x.value)).toEqual([31, 32]);
  });
  it('cintura y peso salen de la misma medición, cada uno en su serie', async () => {
    expect((await reader().series(ind({ source: 'measurement_perimeter', indicatorId: 'perimeter_waist' }))).map((x) => x.value)).toEqual([94, 90]);
    expect((await reader().series(ind({ source: 'measurement_field', indicatorId: 'body_weight' }))).map((x) => x.value)).toEqual([85, 82]);
    expect((await reader().series(ind({ source: 'measurement_field', indicatorId: 'body_fat_pct' }))).map((x) => x.value)).toEqual([24]);
  });
  it('un dato que nunca se midió no se inventa', async () => {
    expect(await reader().series(ind({ source: 'measurement_perimeter', params: { field: 'thighRight' } }))).toEqual([]);
    expect(await reader().series(ind({ source: 'measurement_field', indicatorId: 'muscle_mass_pct' }))).toEqual([]);
  });
});

describe('EVA alimenta el dolor, zona por zona', () => {
  it('rodilla derecha no se mezcla con rodilla izquierda', async () => {
    const r = await reader().series(ind({ source: 'eva', params: { bodyArea: 'rodilla-derecha' } }));
    expect(r.map((x) => x.value)).toEqual([6, 3]);
    expect((await reader().series(ind({ source: 'eva', params: { bodyArea: 'rodilla-izquierda' } }))).map((x) => x.value)).toEqual([9]);
    expect(await reader().series(ind({ source: 'eva', params: { bodyArea: 'cuello' } }))).toEqual([]);
  });
  it('un dolor de 0 es un registro válido (no se descarta por ser cero)', async () => {
    const r = makeSourceReader('p1', { EVA: model([{ _id: 'z', date: d('2026-10-01'), painLevel: 0, bodyArea: 'cuello' }]) });
    expect((await r.series(ind({ source: 'eva', params: { bodyArea: 'cuello' } }))).map((x) => x.value)).toEqual([0]);
  });
});

describe('registros manuales', () => {
  it('cada serie y cada unidad por separado; quedan identificados como autorreporte', async () => {
    const s = await reader().series(ind({ source: 'checkin', seriesKey: 'stress_perceived', unit: '/10' }));
    expect(s.map((x) => x.value)).toEqual([7, 5]);
    expect(s[0].source).toBe('self_report');
    expect(await reader().series(ind({ source: 'checkin', seriesKey: 'stress_perceived', unit: 'h' }))).toEqual([]);
  });
});

describe('sugerencias: lo que ya existe', () => {
  it('lista ejercicios con registros y las medidas disponibles, sin pedir volver a medir', async () => {
    const s = await reader().suggestions();
    expect(s.exercises.map((e) => e.key)).toEqual(expect.arrayContaining(['press banca']));
    expect(s.exercises.find((e) => e.key === 'press banca')).toMatchObject({ sessions: 2, bestLoadKg: 67.5 });
    expect(s.perimeters.bicepFlexedRight).toMatchObject({ value: 35.5, count: 2 });
    expect(s.weight.value).toBe(82);
    expect(s.painAreas['rodilla-derecha']).toMatchObject({ count: 2, value: 3 });
    expect(s.perimeters.thighRight).toBeUndefined();
  });
});
