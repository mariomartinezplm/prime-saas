/**
 * PRUEBAS — tarjeta protagonista y anillos del dashboard B (src/components/dashboard/heroView.ts y meterMath.ts).
 * Lógica pura: cada estado obligatorio del encargo se prueba con datos de ejemplo. Zona horaria de Chile.
 */
import { describe, it, expect } from 'vitest';

process.env.TZ = 'America/Santiago';

const { computeHeroView, heroAppointment } = await import('../../src/components/dashboard/heroView.ts');
const { computePlanView } = await import('../../src/components/dashboard/planView.ts');
const { ringDash } = await import('../../src/components/dashboard/meterMath.ts');

const NOW = new Date(2026, 9, 18, 12, 0, 0); // domingo 18 oct 2026, 12:00
const day = (offset) => { const d = new Date(2026, 9, 18 + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00.000Z`; };
const apt = (offset, start, end, status = 'scheduled') => ({ _id: `a${offset}${start}`, date: day(offset), startTime: start, endTime: end, type: 'entrenamiento', status, professional: { firstName: 'Andrea', lastName: 'Demo' } });
const balance = (over = {}) => ({ hasActivePlan: true, totalAvailable: 8, extraSessionsAvailable: 0, plan: { serviceType: 'entrenamiento', sessionsTotal: 12, sessionsUsed: 4, unlimited: false, endDate: '2026-11-07T00:00:00.000Z' }, ...over });
const inputs = (over = {}) => {
  const b = over.balance === undefined ? balance() : over.balance;
  const history = { kind: 'none' };
  return { now: NOW, upcoming: [], upcomingState: 'ready', balance: b, balanceState: 'ready', planView: computePlanView({ balance: b, history, now: NOW }), planPending: false, ...over };
};

describe('tarjeta protagonista: sesión', () => {
  it('sesión de hoy que todavía no empieza → fase «today» con cuánto falta', () => {
    const v = computeHeroView(inputs({ upcoming: [apt(0, '14:00', '15:00')] }));
    expect(v.kind).toBe('session');
    expect(v.phase).toBe('today');
    expect(v.when).toBe('Hoy · en 2 h');
  });
  it('sesión en curso → fase «live», aunque ya haya empezado', () => {
    const v = computeHeroView(inputs({ upcoming: [apt(0, '11:30', '12:30')] }));
    expect(v).toMatchObject({ kind: 'session', phase: 'live', when: 'En curso' });
  });
  it('sesión futura → fase «future» con el día', () => {
    const v = computeHeroView(inputs({ upcoming: [apt(2, '10:00', '11:00')] }));
    expect(v.phase).toBe('future');
    expect(v.when).toMatch(/Martes 20 de octubre/);
  });
  it('una sesión de hoy que ya terminó o una cancelada no es la protagonista', () => {
    expect(heroAppointment([apt(0, '08:00', '09:00'), apt(1, '10:00', '11:00', 'cancelled'), apt(3, '09:00', '10:00')], NOW).startTime).toBe('09:00');
  });
  it('de varias sesiones elige la más próxima aunque lleguen desordenadas', () => {
    const v = computeHeroView(inputs({ upcoming: [apt(5, '10:00', '11:00'), apt(1, '09:00', '10:00')] }));
    expect(v.appointment.date).toBe(day(1));
  });
});

describe('tarjeta protagonista: sin sesión y estados del plan', () => {
  it('plan vigente sin nada agendado → reservar, con las sesiones que de verdad quedan', () => {
    expect(computeHeroView(inputs())).toEqual({ kind: 'book', detail: 'Te quedan 8 sesiones.' });
    expect(computeHeroView(inputs({ balance: balance({ totalAvailable: 1 }) })).detail).toBe('Te queda 1 sesión.');
  });
  it('plan ilimitado → reservar, sin inventar un número de sesiones', () => {
    const b = balance({ totalAvailable: 9999, plan: { serviceType: 'entrenamiento', sessionsTotal: 0, sessionsUsed: 3, unlimited: true, endDate: '2026-11-07T00:00:00.000Z' } });
    expect(computeHeroView(inputs({ balance: b }))).toEqual({ kind: 'book', detail: 'Tu plan es ilimitado.' });
  });
  it('plan vigente sin sesiones disponibles → «used-up»', () => {
    expect(computeHeroView(inputs({ balance: balance({ totalAvailable: 0 }) }))).toMatchObject({ kind: 'blocked', reason: 'used-up' });
  });
  it('sin plan vigente → bloqueado con el motivo real del historial (vencido, por comenzar, nunca tuvo)', () => {
    const none = { hasActivePlan: false, totalAvailable: 0, extraSessionsAvailable: 0, plan: null };
    for (const kind of ['expired', 'none', 'upcoming']) {
      const planView = computePlanView({ balance: none, history: { kind }, now: NOW });
      expect(computeHeroView(inputs({ balance: none, planView }))).toMatchObject({ kind: 'blocked', reason: kind });
    }
  });
  it('sin plan pero con una sesión ya agendada: se avisa del plan y se menciona la sesión (no se esconde)', () => {
    const none = { hasActivePlan: false, totalAvailable: 0, extraSessionsAvailable: 0, plan: null };
    const planView = computePlanView({ balance: none, history: { kind: 'expired' }, now: NOW });
    const v = computeHeroView(inputs({ balance: none, planView, upcoming: [apt(2, '10:00', '11:00')] }));
    expect(v.kind).toBe('blocked');
    expect(v.nextSession.startTime).toBe('10:00');
  });
});

describe('tarjeta protagonista: carga y errores (nunca se afirma lo que no se sabe)', () => {
  it('mientras carga cualquiera de las dos consultas → cargando', () => {
    expect(computeHeroView(inputs({ upcomingState: 'loading' })).kind).toBe('loading');
    expect(computeHeroView(inputs({ balanceState: 'loading', balance: null })).kind).toBe('loading');
  });
  it('sin plan vigente y todavía consultando el historial → cargando (no se dice «venció» antes de saberlo)', () => {
    const none = { hasActivePlan: false, totalAvailable: 0, extraSessionsAvailable: 0, plan: null };
    expect(computeHeroView(inputs({ balance: none, planPending: true })).kind).toBe('loading');
  });
  it('falló la lista de citas → error de sesión, no «reserva tu próxima sesión»', () => {
    expect(computeHeroView(inputs({ upcoming: null, upcomingState: 'error' }))).toEqual({ kind: 'error', what: 'session' });
  });
  it('falló el saldo y no hay sesión → error de plan, no se afirma que reserve', () => {
    expect(computeHeroView(inputs({ balance: null, balanceState: 'error' }))).toEqual({ kind: 'error', what: 'plan' });
  });
  it('falló el saldo pero hay una sesión real → se muestra la sesión', () => {
    expect(computeHeroView(inputs({ balance: null, balanceState: 'error', upcoming: [apt(1, '10:00', '11:00')] })).kind).toBe('session');
  });
});

describe('anillos de progreso', () => {
  const C = 2 * Math.PI * 40;
  it('el trazo pintado corresponde al valor real', () => {
    expect(ringDash(0.25, C).pct).toBe(25);
    expect(ringDash(0.25, C).dashOffset).toBeCloseTo(C * 0.75, 6);
    expect(ringDash(1, C).dashOffset).toBe(0);
    expect(ringDash(0, C).dashOffset).toBeCloseTo(C, 6);
  });
  it('un valor inválido o ausente no inventa porcentaje', () => {
    for (const bad of [Number.NaN, Infinity, undefined]) expect(ringDash(bad, C)).toMatchObject({ valid: false, pct: 0 });
  });
  it('un valor fuera de rango se acota a 0–100', () => {
    expect(ringDash(1.7, C).pct).toBe(100);
    expect(ringDash(-2, C).pct).toBe(0);
  });
  it('el plan ilimitado no tiene razón (no hay porcentaje que dibujar)', () => {
    const b = balance({ plan: { serviceType: 'entrenamiento', sessionsTotal: 0, sessionsUsed: 3, unlimited: true, endDate: '2026-11-07T00:00:00.000Z' } });
    expect(computePlanView({ balance: b, history: { kind: 'none' }, now: NOW }).ratio).toBeUndefined();
  });
});
