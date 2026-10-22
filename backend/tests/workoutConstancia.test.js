/**
 * PRUEBAS — Constancia (misión semanal, meta mensual y racha) a partir de entrenamientos registrados.
 */
import { describe, it, expect } from 'vitest';
import { engagementOf, targetsOf } from '../services/workoutSets.js';
import { santiagoToUtc } from '../utils/timezone.js';

const at = (m, d, h = 12) => santiagoToUtc(2026, m, d, h);
const NOW = at(10, 21); // miércoles 21 de octubre de 2026

describe('metas', () => {
  it('semanal = la que fijó el profesional o sesiones del plan ÷ 4; mensual = sesiones del plan; sin plan o ilimitado no hay metas inventadas', () => {
    expect(targetsOf({ plan: { sessionsTotal: 12 } })).toEqual({ weeklyTarget: 3, monthlyTarget: 12 });
    expect(targetsOf({ plan: { sessionsTotal: 8 } })).toEqual({ weeklyTarget: 2, monthlyTarget: 8 });
    expect(targetsOf({ plan: { sessionsTotal: 8 }, weeklyOverride: 4 })).toEqual({ weeklyTarget: 4, monthlyTarget: 8 });
    expect(targetsOf({ plan: { sessionsTotal: 4 }, weeklyOverride: 6 }).weeklyTarget).toBe(4); // nunca más que el plan
    expect(targetsOf({ plan: { unlimited: true, sessionsTotal: 0 } })).toEqual({ weeklyTarget: null, monthlyTarget: null });
    expect(targetsOf({ plan: null })).toEqual({ weeklyTarget: null, monthlyTarget: null });
  });
});

describe('semana, mes y racha', () => {
  it('cuenta la semana (lunes a domingo) y el mes calendario por separado', () => {
    const e = engagementOf({ finishedAt: [at(10, 19), at(10, 21), at(10, 14), at(9, 30)], now: NOW, weeklyTarget: 3, monthlyTarget: 8 });
    expect(e).toMatchObject({ weekCount: 2, monthCount: 3, weeklyTarget: 3, monthlyTarget: 8, weekMet: false, remainingWeek: 1, remainingMonth: 5 });
  });
  it('meta cumplida cuando se alcanza', () => {
    const e = engagementOf({ finishedAt: [at(10, 19), at(10, 20), at(10, 21)], now: NOW, weeklyTarget: 3, monthlyTarget: 3 });
    expect(e).toMatchObject({ weekMet: true, monthMet: true, remainingWeek: 0 });
  });
  it('racha: semanas seguidas con al menos un entrenamiento; la semana en curso vacía no rompe la racha', () => {
    const conActual = engagementOf({ finishedAt: [at(10, 21), at(10, 14), at(10, 7), at(9, 30)], now: NOW });
    expect(conActual.streakWeeks).toBe(4);
    const sinActual = engagementOf({ finishedAt: [at(10, 14), at(10, 7)], now: NOW });
    expect(sinActual.streakWeeks).toBe(2); // todavía no entrena esta semana: se cuenta desde la anterior
    const rota = engagementOf({ finishedAt: [at(10, 21), at(10, 7)], now: NOW }); // falta la semana del 12 al 18
    expect(rota.streakWeeks).toBe(1);
    expect(engagementOf({ finishedAt: [], now: NOW }).streakWeeks).toBe(0);
  });
  it('sin metas no hay «te faltan» (no se inventan)', () => {
    const e = engagementOf({ finishedAt: [at(10, 21)], now: NOW });
    expect(e).toMatchObject({ weeklyTarget: null, monthlyTarget: null, weekMet: false, remainingWeek: null, remainingMonth: null });
  });
  it('usa el día de Chile: un entrenamiento a las 23:30 del domingo cuenta en SU semana', () => {
    const domingo = engagementOf({ finishedAt: [at(10, 18, 23)], now: at(10, 18, 23) });
    expect(domingo.weekCount).toBe(1);
    const lunes = engagementOf({ finishedAt: [at(10, 18, 23)], now: at(10, 19, 1) });
    expect(lunes.weekCount).toBe(0); // ya es otra semana
    expect(lunes.streakWeeks).toBe(1);
  });
});
