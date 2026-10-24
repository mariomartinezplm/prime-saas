/**
 * PRUEBAS — Progreso de un objetivo: aumento, disminución, mantenimiento, confirmación y recálculo al corregir un registro.
 */
import { describe, it, expect } from 'vitest';
import { computeIndicatorProgress, computeGoalProgress, meetsTarget, remainingTo, resolveBaseline } from '../services/goals/goalProgress.js';

const p = (day, value) => ({ day, value, refId: `${day}-${value}` });
const ind = (over = {}) => ({ indicatorId: 'exercise_max_load', label: 'Carga', unit: 'kg', direction: 'increase', target: { value: 75 }, ...over });

describe('meta de aumento (Press banca 60 → 75 kg)', () => {
  const series = [p('2026-09-01', 60), p('2026-09-15', 65), p('2026-10-01', 67.5)];
  it('muestra inicio, actual, meta, cuánto falta y el avance', () => {
    const r = computeIndicatorProgress(ind(), series, '2026-09-01');
    expect(r.baseline).toEqual({ value: 60, day: '2026-09-01' });
    expect(r.current).toEqual({ value: 67.5, day: '2026-10-01' });
    expect(r.change).toBe(7.5);
    expect(r.remaining).toBe(7.5);
    expect(r.percent).toBe(50);
    expect(r.state).toBe('in_progress');
    expect(r.confirmed).toBe(false);
  });
  it('se consigue con una serie válida que llega a la meta (fuerza: un registro basta)', () => {
    const r = computeIndicatorProgress(ind(), [...series, p('2026-10-10', 75)], '2026-09-01');
    expect(r.state).toBe('achieved');
    expect(r.percent).toBe(100);
    expect(r.remaining).toBe(0);
  });
  it('si no llegó a la meta, no está conseguido', () => {
    expect(computeIndicatorProgress(ind(), [...series, p('2026-10-10', 74.5)], '2026-09-01').state).toBe('in_progress');
  });
});

describe('meta de disminución (cintura 94 → 86 cm)', () => {
  const cintura = ind({ indicatorId: 'perimeter_waist', unit: 'cm', direction: 'decrease', target: { value: 86 } });
  it('calcula el cambio medido y lo que falta', () => {
    const r = computeIndicatorProgress(cintura, [p('2026-09-01', 94), p('2026-10-01', 90)], '2026-09-01');
    expect(r.change).toBe(-4);
    expect(r.remaining).toBe(4);
    expect(r.percent).toBe(50);
  });
  it('una fluctuación aislada NO la da por conseguida: hacen falta dos registros separados por 14 días', () => {
    const one = computeIndicatorProgress(cintura, [p('2026-09-01', 94), p('2026-10-01', 85.5)], '2026-09-01');
    expect(one.reached).toBe(true);
    expect(one.confirmed).toBe(false);
    expect(one.state).toBe('in_progress');
    const close = computeIndicatorProgress(cintura, [p('2026-09-01', 94), p('2026-10-01', 85.5), p('2026-10-08', 85)], '2026-09-01');
    expect(close.confirmed).toBe(false);
    const ok = computeIndicatorProgress(cintura, [p('2026-09-01', 94), p('2026-10-01', 85.5), p('2026-10-16', 85)], '2026-09-01');
    expect(ok.confirmed).toBe(true);
    expect(ok.state).toBe('achieved');
  });
});

describe('meta de mantenimiento', () => {
  const keep = ind({ indicatorId: 'body_weight', direction: 'maintain', target: { value: 80, tolerance: 1.5 } });
  it('está cumplida mientras el valor esté dentro del margen; fuera, calcula lo que falta', () => {
    expect(meetsTarget(81, keep.target, 'maintain')).toBe(true);
    expect(meetsTarget(82, keep.target, 'maintain')).toBe(false);
    expect(remainingTo(82, keep.target, 'maintain')).toBe(0.5);
    const r = computeIndicatorProgress(keep, [p('2026-09-01', 80), p('2026-09-20', 80.5), p('2026-10-10', 79.5)], '2026-09-01');
    expect(r.percent).toBe(100);
    expect(r.confirmed).toBe(true);
  });
});

describe('puntos de partida y primera medición', () => {
  it('la primera medición no se finge como mejora: con un solo registro el cambio es 0', () => {
    const r = computeIndicatorProgress(ind(), [p('2026-10-01', 60)], '2026-10-01');
    expect(r.change).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.state).toBe('in_progress');
  });
  it('sin registros no se inventa nada: queda a la espera del punto de partida', () => {
    const r = computeIndicatorProgress(ind(), [], '2026-10-01');
    expect(r.state).toBe('needs_baseline');
    expect(r.baseline).toBeNull();
    expect(r.current).toBeNull();
    expect(r.percent).toBeNull();
  });
  it('sin meta (la define el profesional) queda esperando la meta, no un número inventado', () => {
    expect(computeIndicatorProgress(ind({ target: null }), [p('2026-10-01', 60)], '2026-10-01').state).toBe('needs_target');
  });
  it('el punto de partida es el último registro hasta el inicio; si no hay, el primero posterior', () => {
    const s = [p('2026-08-01', 55), p('2026-09-01', 60), p('2026-10-01', 62)];
    expect(resolveBaseline(s, null, '2026-09-15')).toMatchObject({ value: 60, day: '2026-09-01' });
    expect(resolveBaseline(s, null, '2026-07-01')).toMatchObject({ value: 55, day: '2026-08-01' });
    expect(resolveBaseline(s, { value: 50, day: '2026-01-01' }, '2026-09-15')).toMatchObject({ value: 50, day: '2026-01-01', derived: false });
  });
  it('empeorar no se castiga: el avance no baja de 0 y el cambio conserva su signo', () => {
    const r = computeIndicatorProgress(ind(), [p('2026-09-01', 60), p('2026-10-01', 55)], '2026-09-01');
    expect(r.percent).toBe(0);
    expect(r.change).toBe(-5);
  });
});

describe('recalcular al corregir un registro', () => {
  it('si el registro que daba la meta se corrige, el estado se recalcula solo (sin guardar nada)', () => {
    const before = computeIndicatorProgress(ind(), [p('2026-09-01', 60), p('2026-10-10', 75)], '2026-09-01');
    expect(before.state).toBe('achieved');
    const after = computeIndicatorProgress(ind(), [p('2026-09-01', 60), p('2026-10-10', 57.5)], '2026-09-01');
    expect(after.state).toBe('in_progress');
    expect(after.current.value).toBe(57.5);
  });
});

describe('objetivo con varios indicadores (corazón y metabolismo)', () => {
  const goal = { indicators: [
    { seriesKey: 'a', indicatorId: 'weekly_activity_minutes', label: 'Actividad', unit: 'min', direction: 'increase', target: { value: 150 } },
    { seriesKey: 'b', indicatorId: 'glucose', label: 'Glucosa', unit: 'mg/dL', direction: 'maintain', target: null },
  ] };
  it('mientras falte la meta clínica el objetivo no puede estar conseguido', () => {
    const r = computeGoalProgress(goal, { a: [p('2026-10-01', 60), p('2026-10-20', 160)], b: [] }, '2026-10-01');
    expect(r.state).toBe('needs_target');
    expect(r.indicators).toHaveLength(2);
  });
  it('queda conseguido solo cuando todos están confirmados', () => {
    const two = { indicators: [goal.indicators[0], { ...goal.indicators[0], seriesKey: 'c' }] };
    const done = [p('2026-10-01', 60), p('2026-10-10', 160), p('2026-10-20', 165)];
    expect(computeGoalProgress(two, { a: done, c: done }, '2026-10-01').state).toBe('achieved');
    expect(computeGoalProgress(two, { a: done, c: [p('2026-10-01', 60)] }, '2026-10-01').state).toBe('in_progress');
  });
});
