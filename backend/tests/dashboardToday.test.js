/**
 * PRUEBAS — «Para hoy» del dashboard del paciente (reglas en src/components/dashboard/todayActions.ts).
 *
 * Las reglas son una función pura: se prueba cada escenario con datos de ejemplo. Misma infraestructura que el resto
 * de backend/tests/ (vitest); la zona horaria se fija en Chile para que el «día de hoy» sea el real.
 */

import { describe, it, expect } from 'vitest';

process.env.TZ = 'America/Santiago';

const { computeTodayActions, greetingFor, todayLabel, timeUntil, MAX_TODAY_ACTIONS } = await import('../../src/components/dashboard/todayActions.ts');

// Miércoles 14 de octubre de 2026, 15:00 en Chile (verano, UTC-3) = 18:00 UTC
const AHORA = new Date('2026-10-14T18:00:00Z');

// Una cita: el servidor guarda el DÍA como medianoche UTC y la hora aparte (así llega a la pantalla)
const cita = (dia, startTime, endTime, extra = {}) => ({
  _id: `${dia}-${startTime}`,
  date: `${dia}T00:00:00.000Z`,
  startTime,
  endTime,
  status: 'scheduled',
  type: 'entrenamiento',
  ...extra
});

const plan = (extra = {}) => ({ serviceType: 'entrenamiento', sessionsTotal: 8, sessionsUsed: 2, unlimited: false, ...extra });
const saldo = (extra = {}) => ({
  hasActivePlan: true,
  plan: plan(),
  planSessionsAvailable: 6,
  extraSessionsAvailable: 0,
  totalAvailable: 6,
  paymentPending: false,
  ...extra
});
const sinPlan = () => ({ hasActivePlan: false, plan: null, planSessionsAvailable: 0, extraSessionsAvailable: 0, totalAvailable: 0 });

const calcular = (extra) => computeTodayActions({ now: AHORA, upcoming: [], balance: saldo(), readiness: 'done', ...extra });
const ids = (r) => r.actions.map((a) => a.id);

describe('Readiness pendiente y completado', () => {
  it('pendiente: aparece «Completa tu Readiness» y lleva a la tarjeta del Readiness', () => {
    const r = calcular({ readiness: 'pending', upcoming: [cita('2026-10-16', '10:00', '11:00')] });
    expect(ids(r)).toEqual(['readiness']);
    expect(r.actions[0].cta).toEqual({ label: 'Completar', target: 'readiness' });
  });

  it('completado: no aparece, y sin otras tareas se dice con neutralidad', () => {
    const r = calcular({ readiness: 'done', upcoming: [cita('2026-10-16', '10:00', '11:00')] });
    expect(r.status).toBe('empty');
    expect(r.actions).toEqual([]);
  });

  it('sin plan vigente el Readiness no se ofrece (no podría registrarlo)', () => {
    const r = calcular({ balance: sinPlan(), readiness: 'pending' });
    expect(ids(r)).not.toContain('readiness');
  });

  it('mientras se consulta: sin acciones es «loading»; con acciones se reserva el espacio (loadingMore)', () => {
    const sola = calcular({ readiness: 'loading', upcoming: [cita('2026-10-16', '10:00', '11:00')] });
    expect(sola.status).toBe('loading');
    const conAccion = calcular({ readiness: 'loading', upcoming: [cita('2026-10-14', '18:00', '19:00')] });
    expect(conAccion.status).toBe('actions');
    expect(conAccion.loadingMore).toBe(true);
  });

  it('si no se pudo saber (error) no se afirma nada: «unknown», no «no tienes tareas»', () => {
    const r = calcular({ readiness: 'unknown', upcoming: [cita('2026-10-16', '10:00', '11:00')] });
    expect(r.status).toBe('unknown');
  });
});

describe('sesión hoy, futura y sin citas', () => {
  it('sesión hoy que todavía no empieza: «Hoy tienes sesión a las 18:00» con cuánto falta', () => {
    const r = calcular({ upcoming: [cita('2026-10-14', '18:00', '19:00')] });
    expect(ids(r)).toEqual(['session-today']);
    expect(r.actions[0].title).toBe('Hoy tienes sesión a las 18:00');
    expect(r.actions[0].detail).toBe('Entrenamiento · empieza en 3 h');
    expect(r.actions[0].cta.to).toBe('/app/mis-citas');
  });

  it('sesión en curso ahora mismo', () => {
    const r = calcular({ upcoming: [cita('2026-10-14', '14:30', '15:30', { type: 'kinesiologia' })] });
    expect(ids(r)).toEqual(['session-live']);
    expect(r.actions[0].detail).toBe('14:30 – 15:30 · Kinesiología');
  });

  it('con varias sesiones hoy se muestra solo UNA: la más cercana (sin duplicar)', () => {
    const r = calcular({ upcoming: [cita('2026-10-14', '19:00', '20:00'), cita('2026-10-14', '17:00', '18:00')] });
    expect(ids(r)).toEqual(['session-today']);
    expect(r.actions[0].title).toBe('Hoy tienes sesión a las 17:00');
  });

  it('una sesión que ya terminó hoy no se muestra', () => {
    const r = calcular({ upcoming: [cita('2026-10-14', '09:00', '10:00')] });
    expect(ids(r)).not.toContain('session-today');
    expect(ids(r)).not.toContain('session-live');
  });

  it('sesión futura (otro día): no hay acción de sesión (ya está en «Próxima sesión») y NO se ofrece reservar', () => {
    const r = calcular({ upcoming: [cita('2026-10-16', '10:00', '11:00')] });
    expect(ids(r)).toEqual([]);
    expect(r.status).toBe('empty');
  });

  it('sin citas y con sesiones disponibles: «Reserva tu próxima sesión» con las que le quedan', () => {
    const r = calcular({ upcoming: [] });
    expect(ids(r)).toEqual(['book-next']);
    expect(r.actions[0].detail).toBe('Te quedan 6 sesión(es) disponible(s).');
    expect(r.actions[0].cta.to).toBe('/app/reservar');
  });

  it('las citas canceladas, completadas o ausentes no cuentan como sesión por venir', () => {
    const r = calcular({ upcoming: [cita('2026-10-14', '18:00', '19:00', { status: 'cancelled' }), cita('2026-10-15', '10:00', '11:00', { status: 'completed' })] });
    expect(ids(r)).toEqual(['book-next']);
  });

  it('de noche (23:30 en Chile) la cita de hoy ya terminada no aparece y se usa el día de Chile, no el de UTC', () => {
    const tarde = new Date('2026-10-15T02:30:00Z'); // 23:30 del 14 de octubre en Chile; en UTC ya es el 15
    const r = computeTodayActions({ now: tarde, upcoming: [cita('2026-10-14', '19:30', '20:30'), cita('2026-10-15', '08:00', '09:00')], balance: saldo(), readiness: 'done' });
    // la de mañana NO es «de hoy» (aunque en UTC ya sea el 15) y la de hoy ya terminó
    expect(ids(r)).toEqual([]);
  });
});

describe('estado del plan', () => {
  it('sin plan: «Tu plan venció», importante, y no ofrece reservar ni el Readiness', () => {
    const r = calcular({ balance: sinPlan(), readiness: 'pending' });
    expect(ids(r)).toEqual(['plan-expired']);
    expect(r.actions[0].urgent).toBe(true);
    expect(r.actions[0].cta).toEqual({ label: 'Ver cómo renovar', target: 'plan' });
  });

  it('plan vencido con una sesión hoy: primero el plan, después la sesión', () => {
    const r = calcular({ balance: sinPlan(), upcoming: [cita('2026-10-14', '18:00', '19:00')] });
    expect(ids(r)).toEqual(['plan-expired', 'session-today']);
  });

  it('plan vigente: sin «plan vencido»', () => {
    expect(ids(calcular({ readiness: 'pending' }))).not.toContain('plan-expired');
  });

  it('pago pendiente: NO se repite en «Para hoy» (ya tiene su aviso), y sigue pudiendo agendar', () => {
    const r = calcular({ balance: saldo({ paymentPending: true, paymentDueBy: '2026-10-20T00:00:00.000Z' }), upcoming: [] });
    expect(ids(r)).toEqual(['book-next']);
    const soloAviso = calcular({ balance: saldo({ paymentPending: true }), upcoming: [cita('2026-10-16', '10:00', '11:00')] });
    expect(soloAviso.status).toBe('empty');
    expect(JSON.stringify(soloAviso)).not.toMatch(/pago/i);
  });

  it('sin sesiones disponibles: «Usaste todas las sesiones de tu plan» y no ofrece reservar', () => {
    const r = calcular({ balance: saldo({ totalAvailable: 0, planSessionsAvailable: 0, plan: plan({ sessionsUsed: 8 }) }), upcoming: [] });
    expect(ids(r)).toEqual(['plan-used-up']);
  });

  it('plan ilimitado: nunca «usaste todas»; al reservar dice que es ilimitado', () => {
    const ilimitado = saldo({ plan: plan({ unlimited: true, sessionsTotal: 0 }), totalAvailable: 9999 });
    const r = calcular({ balance: ilimitado, upcoming: [] });
    expect(ids(r)).toEqual(['book-next']);
    expect(r.actions[0].detail).toBe('Tu plan es ilimitado.');
    expect(ids(calcular({ balance: saldo({ plan: plan({ unlimited: true }), totalAvailable: 0 }) }))).not.toContain('plan-used-up');
  });
});

describe('límites, orden y datos que faltan', () => {
  it('máximo 3 acciones, en el orden de prioridad documentado, sin repetir', () => {
    const r = calcular({
      readiness: 'pending',
      balance: saldo({ totalAvailable: 0, plan: plan({ sessionsUsed: 8 }) }),
      upcoming: [cita('2026-10-14', '18:00', '19:00')]
    });
    expect(MAX_TODAY_ACTIONS).toBe(3);
    expect(ids(r)).toEqual(['session-today', 'readiness', 'plan-used-up']);
    expect(new Set(ids(r)).size).toBe(ids(r).length);
    expect(r.actions.length).toBeLessThanOrEqual(MAX_TODAY_ACTIONS);
  });

  it('nada cargado: no se afirma nada (ni «sin tareas» ni acciones inventadas)', () => {
    const r = computeTodayActions({ now: AHORA, upcoming: null, balance: null, readiness: 'unknown' });
    expect(r).toEqual({ status: 'unknown', actions: [], loadingMore: false });
  });

  it('falló la carga de citas: no se ofrece «reservar» (podría tener citas)', () => {
    const r = computeTodayActions({ now: AHORA, upcoming: null, balance: saldo(), readiness: 'done' });
    expect(ids(r)).not.toContain('book-next');
    expect(r.status).toBe('unknown');
  });

  it('falló la carga del plan: con una sesión hoy igual se muestra esa acción', () => {
    const r = computeTodayActions({ now: AHORA, upcoming: [cita('2026-10-14', '18:00', '19:00')], balance: null, readiness: 'unknown' });
    expect(ids(r)).toEqual(['session-today']);
  });

  it('nunca se afirma que deba entrenar hoy (no existe un programa de entrenamiento) ni se muestran datos clínicos', () => {
    const escenarios = [
      calcular({ readiness: 'pending' }),
      calcular({ balance: sinPlan() }),
      calcular({ upcoming: [cita('2026-10-14', '18:00', '19:00')] }),
      calcular({ upcoming: [] })
    ];
    const texto = JSON.stringify(escenarios);
    expect(texto).not.toMatch(/entrena (hoy|ahora)|toca entrenar|rutina|peso|dolor|kg|puntaje|semáforo/i);
  });
});

describe('saludo y fecha local', () => {
  it('el saludo cambia según la hora', () => {
    const a = (h) => greetingFor(new Date(2026, 9, 14, h, 0));
    expect([a(0), a(6), a(11)]).toEqual(['Buenos días', 'Buenos días', 'Buenos días']);
    expect([a(12), a(15), a(19)]).toEqual(['Buenas tardes', 'Buenas tardes', 'Buenas tardes']);
    expect([a(20), a(23)]).toEqual(['Buenas noches', 'Buenas noches']);
  });

  it('la fecha sale con mayúscula inicial y en español, en el día local', () => {
    expect(todayLabel(AHORA)).toBe('Miércoles 14 de octubre');
    // 23:30 en Chile del 14: sigue siendo el 14 aunque en UTC ya sea el 15
    expect(todayLabel(new Date('2026-10-15T02:30:00Z'))).toBe('Miércoles 14 de octubre');
  });

  it('cuánto falta para una sesión', () => {
    const desde = AHORA;
    expect(timeUntil(desde, new Date(desde.getTime() + 20 * 60000))).toBe('en 20 min');
    expect(timeUntil(desde, new Date(desde.getTime() + 60 * 60000))).toBe('en 1 h');
    expect(timeUntil(desde, new Date(desde.getTime() + 135 * 60000))).toBe('en 2 h 15 min');
    expect(timeUntil(desde, new Date(desde.getTime() - 5000))).toBe('ahora');
  });
});
