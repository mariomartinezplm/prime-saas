/**
 * PRUEBAS — Progreso por ejercicio (gráfico individual) y relojes con la app cerrada.
 */
import { describe, it, expect } from 'vitest';

const { groupExercises, normalizeNames, primaryMetric, progressPoints, filterPeriod, bestMark, sessionHistory, modalityOf } = await import('../../src/lib/exerciseProgress.ts');
const { elapsedSec, formatClock, restRemainingSec, restDisplayState } = await import('../../src/lib/workoutClock.ts');
const { allStrengthRecords } = await import('../services/achievements/strength.js');

let n = 0;
const rec = (name, date, over = {}) => ({ _id: `r${n++}`, exerciseName: name, date: `${date}T15:00:00.000Z`, sets: 1, reps: 10, weight: 20, weightUnit: 'kg', ...over });

describe('un ejercicio = una identidad, sin importar mayúsculas', () => {
  const all = [rec('Press Banca', '2026-10-01', { weight: 60 }), rec('press banca', '2026-10-08', { weight: 65 }), rec('PRESS BANCA', '2026-10-15', { weight: 70 }), rec('Press banca inclinado', '2026-10-15', { weight: 50 }), rec('Press banca con mancuernas', '2026-10-16', { weight: 24 })];

  it('Press Banca, press banca y PRESS BANCA forman un solo ejercicio; plano/inclinado/mancuernas no se unen', () => {
    const groups = groupExercises(all);
    expect(groups).toHaveLength(3);
    const press = groups.find((g) => g.key === 'press banca');
    expect(press.records).toHaveLength(3);
    expect(press.name).toBe('PRESS BANCA'); // la escritura del registro más reciente
  });
  it('normalizeNames deja una sola escritura sin tocar los datos', () => {
    const out = normalizeNames(all);
    expect(new Set(out.slice(0, 3).map((r) => r.exerciseName)).size).toBe(1);
    expect(out.map((r) => r.weight)).toEqual(all.map((r) => r.weight));
    expect(out[3].exerciseName).toBe('Press banca inclinado');
  });
});

describe('métricas por tipo de ejercicio (nunca se mezclan)', () => {
  it('con peso: carga máxima por fecha con sus repeticiones', () => {
    const rows = [rec('Press', '2026-10-01', { weight: 60, reps: 10 }), rec('Press', '2026-10-01', { weight: 65, reps: 8 }), rec('Press', '2026-10-08', { weight: 70, reps: 5 })];
    expect(primaryMetric(rows)).toBe('load');
    expect(progressPoints(rows, 'load')).toEqual([{ date: '2026-10-01', value: 65, reps: 8, sets: 2 }, { date: '2026-10-08', value: 70, reps: 5, sets: 1 }]);
  });
  it('peso corporal: evolución de repeticiones, sin inventar cargas', () => {
    const rows = [rec('Flexiones', '2026-10-01', { weight: undefined, reps: 12, modality: 'bodyweight' }), rec('Flexiones', '2026-10-08', { weight: undefined, reps: 15, modality: 'bodyweight' })];
    expect(primaryMetric(rows)).toBe('reps');
    expect(progressPoints(rows, 'reps').map((p) => p.value)).toEqual([12, 15]);
    expect(progressPoints(rows, 'load')).toEqual([]);
  });
  it('por tiempo: duración en segundos, nunca convertida a kilos', () => {
    const rows = [rec('Plancha', '2026-10-01', { weight: undefined, reps: undefined, durationSec: 30, modality: 'time' }), rec('Plancha', '2026-10-08', { weight: undefined, reps: undefined, durationSec: 45, modality: 'time' }), rec('Plancha', '2026-10-09', { weight: undefined, reps: undefined, duration: 1, modality: undefined })];
    expect(primaryMetric(rows)).toBe('time');
    expect(progressPoints(rows, 'time').map((p) => p.value)).toEqual([30, 45, 60]); // el registro antiguo en minutos se muestra en segundos
    expect(progressPoints(rows, 'load')).toEqual([]);
  });
  it('un registro antiguo sin modalidad se deduce de sus datos', () => {
    expect(modalityOf(rec('X', '2026-10-01', { weight: 20 }))).toBe('weight');
    expect(modalityOf(rec('X', '2026-10-01', { weight: undefined, reps: 8 }))).toBe('bodyweight');
    expect(modalityOf(rec('X', '2026-10-01', { weight: undefined, reps: undefined }))).toBeNull();
  });
  it('las libras se conservan en el historial pero no se mezclan con los kg del gráfico', () => {
    const rows = [rec('Press', '2026-10-01', { weight: 100, weightUnit: 'lbs' }), rec('Press', '2026-10-08', { weight: 50, weightUnit: 'kg' })];
    expect(progressPoints(rows, 'load').map((p) => p.value)).toEqual([50]);
    expect(sessionHistory(rows).flatMap((s) => s.sets).map((s) => s.unit)).toEqual(['kg', 'lbs']);
  });
});

describe('período, mejor marca e historial', () => {
  const pts = [{ date: '2026-07-01', value: 50, reps: 10, sets: 1 }, { date: '2026-09-20', value: 60, reps: 8, sets: 1 }, { date: '2026-10-15', value: 70, reps: 5, sets: 1 }];
  const now = new Date('2026-10-21T12:00:00Z');
  it('30 días, 90 días y Todo se cuentan desde hoy', () => {
    expect(filterPeriod(pts, '30', now).map((p) => p.value)).toEqual([70]);
    expect(filterPeriod(pts, '90', now).map((p) => p.value)).toEqual([60, 70]);
    expect(filterPeriod(pts, 'all', now)).toHaveLength(3);
  });
  it('la mejor marca sale de TODO el historial, no solo del período', () => {
    expect(bestMark(pts)).toEqual({ value: 70, reps: 5, date: '2026-10-15' });
    expect(bestMark([])).toBeNull();
  });
  it('con una sola medición no hay tendencia: un solo punto', () => {
    expect(progressPoints([rec('Remo', '2026-10-01', { weight: 30 })], 'load')).toHaveLength(1);
  });
  it('el historial agrupa por día (más reciente primero) y respeta cada serie', () => {
    const h = sessionHistory([rec('Press', '2026-10-01', { weight: 60, reps: 10 }), rec('Press', '2026-10-01', { weight: 62, reps: 8 }), rec('Press', '2026-10-08', { weight: 65, reps: 6 })]);
    expect(h.map((d) => d.date)).toEqual(['2026-10-08', '2026-10-01']);
    expect(h[1].sets.map((s) => [s.reps, s.weight])).toEqual([[10, 60], [8, 62]]);
  });
});

describe('integridad: lo registrado alimenta EXACTAMENTE el mismo gráfico y los récords', () => {
  it('mismo dato, misma marca en el gráfico y en la regla de récords del servidor', () => {
    const rows = [rec('press banca', '2026-10-01', { weight: 70 }), rec('Press Banca', '2026-10-12', { weight: 72.5 }), rec('PRESS BANCA', '2026-10-20', { weight: 75 })];
    const best = bestMark(progressPoints(rows, 'load'));
    expect(best.value).toBe(75);
    const records = allStrengthRecords(rows.map((r) => ({ ...r, date: new Date(r.date) })));
    expect(records.at(-1).record.weight).toBe(best.value);
    expect(records.at(-1).previousBest).toBe(72.5);
  });
});

describe('cronómetros con la app cerrada (se reconstruyen con marcas de tiempo)', () => {
  const t = (h, m = 0, s = 0) => Date.UTC(2026, 9, 20, h, m, s); // 21:00 UTC = 18:00 en Chile
  const start = new Date(t(21, 0, 0)).toISOString();
  it('empieza a las 18:00 y vuelve a las 19:20: marca 1:20:00 (sin cortarse a la hora)', () => {
    expect(formatClock(elapsedSec(start, t(22, 20, 0), 0))).toBe('1:20:00');
  });
  it('descanso de 2:00 con la app cerrada: a los 30 s quedan 1:30; a los 3 min está terminado; en pausa sigue en pausa', () => {
    const run = { state: 'running', dueAt: new Date(t(21, 2, 0)).toISOString(), remainingSec: 0, durationSec: 120, nextDurationSec: 120, version: 1 };
    // se inició a las 21:00:00 → vence 21:02:00
    expect(formatClock(restRemainingSec(run, t(21, 0, 30), 0))).toBe('01:30');
    expect(restDisplayState(run, t(21, 3, 0), 0)).toBe('done');
    const paused = { ...run, state: 'paused', dueAt: null, remainingSec: 95 };
    expect(restDisplayState(paused, t(23, 0, 0), 0)).toBe('paused');
    expect(restRemainingSec(paused, t(23, 0, 0), 0)).toBe(95);
  });
});
