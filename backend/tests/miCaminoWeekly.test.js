/**
 * PRUEBAS — Mi camino PRIME, objetivo semanal (función pura, sin base de datos).
 */
import { describe, it, expect } from 'vitest';
import { santiagoToUtc } from '../utils/timezone.js';
import { computeWeeklyGoal, defaultWeeklyTarget, weekBounds } from '../services/achievements/weekly.js';
import { buildOverview } from '../services/achievements/overview.js';

// Martes 20 de octubre de 2026, mediodía en Chile
const NOW = santiagoToUtc(2026, 10, 20, 12);
const day = (d, h = 12) => santiagoToUtc(2026, 10, d, h);
const plan = (over = {}) => ({ _id: 'p1', serviceType: 'entrenamiento', status: 'active', sessionsTotal: 8, unlimited: false, startDate: day(1, 0), endDate: day(31, 23), ...over });
const appt = (id, d, over = {}) => ({ _id: id, type: 'entrenamiento', status: 'completed', date: day(d), deduction: { source: 'clientPlan', refId: 'p1' }, ...over });

describe('objetivo semanal por defecto', () => {
  it('sesiones del mes ÷ 4, hacia arriba', () => {
    expect([4, 8, 12, 16].map(defaultWeeklyTarget)).toEqual([1, 2, 3, 4]);
    expect(defaultWeeklyTarget(10)).toBe(3);
    expect(defaultWeeklyTarget(1)).toBe(1);
    expect(defaultWeeklyTarget(0)).toBe(0);
    expect(defaultWeeklyTarget(undefined)).toBe(0);
  });

  it('la semana es de lunes a domingo', () => {
    expect(weekBounds('2026-10-20')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(weekBounds('2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(weekBounds('2026-10-26')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
});

describe('computeWeeklyGoal', () => {
  it('cuenta solo sesiones completadas y descontadas del plan esta semana', () => {
    const appointments = [
      appt('a1', 19), // lunes, completada
      appt('a2', 12), // semana anterior: no cuenta
      appt('a3', 22, { status: 'scheduled', deduction: undefined }), // agendada: aparte
      appt('a4', 21, { status: 'cancelled', deduction: undefined }),
      appt('a5', 20, { status: 'no-show' }), // ausencia: no cuenta como lograda
      appt('a6', 21, { type: 'kinesiologia' }) // otro servicio
    ];
    const w = computeWeeklyGoal({ plans: [plan()], appointments, pauses: [] }, NOW);
    expect(w).toMatchObject({ state: 'active', target: 2, completed: 1, scheduled: 1, met: false, weekStart: '2026-10-19', weekEnd: '2026-10-25' });
  });

  it('no cuenta dos veces la misma cita y se cumple al alcanzar el objetivo', () => {
    const a = appt('a1', 19);
    const w = computeWeeklyGoal({ plans: [plan()], appointments: [a, a, appt('a2', 21)], pauses: [] }, NOW);
    expect(w.completed).toBe(2);
    expect(w.met).toBe(true);
  });

  it('12 sesiones al mes → 3 por semana', () => {
    expect(computeWeeklyGoal({ plans: [plan({ sessionsTotal: 12 })], appointments: [], pauses: [] }, NOW).target).toBe(3);
  });

  it('sin objetivo para planes ilimitados, de kinesiología o sin plan vigente', () => {
    for (const plans of [[plan({ unlimited: true })], [plan({ serviceType: 'kinesiologia' })], [], [plan({ status: 'cancelled' })], [plan({ endDate: day(10, 23) })]]) {
      expect(computeWeeklyGoal({ plans, appointments: [], pauses: [] }, NOW).state).toBe('none');
    }
  });

  it('un mes con pausa autorizada oculta el objetivo, sin castigo', () => {
    const w = computeWeeklyGoal({ plans: [plan()], appointments: [], pauses: [{ periodKey: '2026-10' }] }, NOW);
    expect(w.state).toBe('paused');
    expect(w.target).toBeUndefined();
  });

  it('una sesión completada con otro plan no cuenta en este', () => {
    const w = computeWeeklyGoal({ plans: [plan()], appointments: [appt('a1', 19, { deduction: { source: 'clientPlan', refId: 'otro' } })], pauses: [] }, NOW);
    expect(w.completed).toBe(0);
  });
});

describe('integración con el resumen de logros', () => {
  it('buildOverview incluye weekly', () => {
    const data = { appointments: [appt('a1', 19)], plans: [plan()], pauses: [], checkins: [], measurements: [], exercises: [], goal: null, awards: [] };
    expect(buildOverview(data, { now: NOW }).weekly).toMatchObject({ state: 'active', target: 2, completed: 1 });
  });
});

describe('objetivo semanal fijado por el profesional', () => {
  it('reemplaza al valor por defecto pero nunca supera las sesiones del plan', () => {
    const base = { plans: [plan({ sessionsTotal: 8 })], appointments: [], pauses: [] };
    expect(computeWeeklyGoal({ ...base, weeklyGoal: 3 }, NOW)).toMatchObject({ target: 3, defaultTarget: 2, source: 'professional' });
    expect(computeWeeklyGoal({ ...base, weeklyGoal: 7 }, NOW).target).toBe(7);
    expect(computeWeeklyGoal({ ...base, plans: [plan({ sessionsTotal: 4 })], weeklyGoal: 6 }, NOW).target).toBe(4);
    expect(computeWeeklyGoal({ ...base, weeklyGoal: null }, NOW)).toMatchObject({ target: 2, source: 'plan' });
    expect(computeWeeklyGoal({ ...base, weeklyGoal: 0 }, NOW).source).toBe('plan');
    expect(computeWeeklyGoal({ ...base, weeklyGoal: 2.5 }, NOW).source).toBe('plan');
  });

  it('no aplica a planes ilimitados ni en pausa autorizada aunque haya valor fijado', () => {
    expect(computeWeeklyGoal({ plans: [plan({ unlimited: true })], appointments: [], pauses: [], weeklyGoal: 3 }, NOW).state).toBe('none');
    expect(computeWeeklyGoal({ plans: [plan()], appointments: [], pauses: [{ periodKey: '2026-10' }], weeklyGoal: 3 }, NOW).state).toBe('paused');
  });
});
