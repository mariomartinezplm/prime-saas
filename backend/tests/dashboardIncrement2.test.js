/**
 * PRUEBAS — dashboard del paciente, incremento 2: estado del Readiness, «Próxima sesión», «Mi plan» y «Tu constancia».
 *
 * Son funciones puras (src/components/dashboard/*.ts y src/components/wellness/readinessStatus.ts): se prueba cada escenario con
 * datos de ejemplo, con la misma infraestructura (vitest) que el resto de backend/tests/. Zona horaria fija en Chile.
 */

import { describe, it, expect } from 'vitest';

process.env.TZ = 'America/Santiago';

const { readinessStatusOf } = await import('../../src/components/wellness/readinessStatus.ts');
const { computePlanView, planHistoryOf } = await import('../../src/components/dashboard/planView.ts');
const { computeProgressView, HIDDEN_ON_DASHBOARD } = await import('../../src/components/dashboard/progressView.ts');
const { nextSessionLabel, sessionsWord } = await import('../../src/components/dashboard/nextSession.ts');

// Miércoles 14 de octubre de 2026, 15:00 en Chile
const AHORA = new Date('2026-10-14T18:00:00Z');

describe('estado del Readiness que comunica la tarjeta', () => {
  it('cubre cargando, error, pendiente y hecho con una sola regla', () => {
    expect(readinessStatusOf({ loading: true, loadFailed: false, checkin: null })).toBe('loading');
    expect(readinessStatusOf({ loading: false, loadFailed: true, checkin: null })).toBe('unknown');
    expect(readinessStatusOf({ loading: false, loadFailed: false, checkin: null })).toBe('pending');
    expect(readinessStatusOf({ loading: false, loadFailed: false, checkin: { _id: 'w1' } })).toBe('done');
  });

  it('cargando manda sobre todo; un error nunca se confunde con «pendiente»', () => {
    expect(readinessStatusOf({ loading: true, loadFailed: true, checkin: { _id: 'w1' } })).toBe('loading');
    expect(readinessStatusOf({ loading: false, loadFailed: true, checkin: { _id: 'w1' } })).toBe('unknown');
  });
});

// ── Mi plan ─────────────────────────────────────────────────────────────────
const plan = (extra = {}) => ({
  _id: 'p1',
  serviceType: 'entrenamiento',
  sessionsTotal: 12,
  sessionsUsed: 4,
  unlimited: false,
  status: 'active',
  startDate: '2026-10-01T03:00:00.000Z',
  endDate: '2026-11-01T02:59:59.000Z',
  term: 'mensual',
  ...extra
});
const saldo = (extra = {}, planExtra = {}) => ({
  hasActivePlan: true,
  plan: plan(planExtra),
  planSessionsAvailable: 8,
  extraSessionsAvailable: 0,
  totalAvailable: 8,
  paymentPending: false,
  ...extra
});
const sinPlan = () => ({ hasActivePlan: false, plan: null, planSessionsAvailable: 0, extraSessionsAvailable: 0, totalAvailable: 0 });
const vista = (balance, history = { kind: 'unknown' }) => computePlanView({ balance, history, now: AHORA });

describe('Mi plan: estado del plan', () => {
  it('plan vigente: sesiones usadas y disponibles, vigencia, y barra con total real', () => {
    const v = vista(saldo());
    expect(v).toMatchObject({ kind: 'active', serviceType: 'entrenamiento', used: 4, total: 12, available: 8, ratio: 4 / 12, validUntil: '31/10/2026' });
    expect(v.daysLeftText).toBe('17 días restantes');
    expect(v.paymentPending).toBe(false);
  });

  it('agotado: «used-up», con la barra llena (no es lo mismo que vencido)', () => {
    const v = vista(saldo({ totalAvailable: 0, planSessionsAvailable: 0 }, { sessionsUsed: 12 }));
    expect(v.kind).toBe('used-up');
    expect(v.ratio).toBe(1);
  });

  it('con sesiones extra no está agotado aunque las del plan se acabaron, y se informa cuántas son extra', () => {
    const v = vista(saldo({ totalAvailable: 2, planSessionsAvailable: 0, extraSessionsAvailable: 2 }, { sessionsUsed: 12 }));
    expect(v.kind).toBe('active');
    expect(v.extra).toBe(2);
    expect(v.available).toBe(2);
  });

  it('ilimitado: nunca lleva barra ni total (no hay denominador real) ni se considera agotado', () => {
    const v = vista(saldo({ totalAvailable: 9999 }, { unlimited: true, sessionsTotal: 0, sessionsUsed: 3 }));
    expect(v.kind).toBe('unlimited');
    expect(v.ratio).toBeUndefined();
    expect(v.total).toBeUndefined();
    expect(v.used).toBe(3);
  });

  it('plan limitado sin total válido (0): sin barra, para no inventar un denominador', () => {
    const v = vista(saldo({}, { sessionsTotal: 0 }));
    expect(v.ratio).toBeUndefined();
    expect(v.total).toBeUndefined();
  });

  it('la barra nunca se pasa de 0-100 % aunque los datos vengan raros', () => {
    expect(vista(saldo({}, { sessionsUsed: 20, sessionsTotal: 12 })).ratio).toBe(1);
    expect(vista(saldo({}, { sessionsUsed: -1, sessionsTotal: 12 })).ratio).toBe(0);
  });

  it('pago pendiente: solo una etiqueta de estado (el aviso con fecha y botón es el de arriba y no se repite aquí)', () => {
    const v = vista(saldo({ paymentPending: true, paymentDueBy: '2026-10-20T00:00:00.000Z' }));
    expect(v.paymentPending).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/20\/10|2026-10-20|paymentDueBy/);
  });

  it('vigencia: hoy, mañana y varios días', () => {
    expect(vista(saldo({}, { endDate: '2026-10-15T02:59:59.000Z' })).daysLeftText).toBe('vence hoy');
    expect(vista(saldo({}, { endDate: '2026-10-16T02:59:59.000Z' })).daysLeftText).toBe('1 día restante');
  });

  it('plan trimestral o anual: indica el mes del ciclo; el mensual no', () => {
    expect(vista(saldo({}, { term: 'anual', cyclesTotal: 12, cycleNumber: 3 })).cycleText).toBe('Anual · mes 3 de 12');
    expect(vista(saldo()).cycleText).toBeUndefined();
  });

  it('error al cargar el saldo: «error», sin inventar nada', () => {
    expect(vista(null)).toEqual({ kind: 'error' });
  });

  it('sin plan vigente: distingue vencido, nunca tuvo, y plan que todavía no empieza', () => {
    expect(vista(sinPlan(), { kind: 'expired', endedOn: '2026-10-01T02:59:59.000Z' })).toMatchObject({ kind: 'inactive', inactiveReason: 'expired', endedOn: '30/09/2026' });
    expect(vista(sinPlan(), { kind: 'none' })).toMatchObject({ kind: 'inactive', inactiveReason: 'none' });
    expect(vista(sinPlan(), { kind: 'upcoming', upcomingStart: '2026-11-01T03:00:00.000Z' })).toMatchObject({
      kind: 'inactive',
      inactiveReason: 'upcoming',
      upcomingStart: '01/11/2026'
    });
    expect(vista(sinPlan())).toMatchObject({ kind: 'inactive', inactiveReason: 'unknown' });
  });
});

describe('historial de planes de quien no tiene plan vigente', () => {
  const p = (status, extra = {}) => ({ status, startDate: '2026-09-01T03:00:00.000Z', endDate: '2026-10-01T02:59:59.000Z', ...extra });

  it('sin planes, o solo cancelados: «none» (nunca tuvo uno que haya vencido)', () => {
    expect(planHistoryOf([], AHORA)).toEqual({ kind: 'none' });
    expect(planHistoryOf([p('cancelled')], AHORA)).toEqual({ kind: 'none' });
  });

  it('con un plan vencido: «expired» (también si el estado quedó «active» pero la fecha ya pasó)', () => {
    expect(planHistoryOf([p('expired')], AHORA)).toEqual({ kind: 'expired', endedOn: '2026-10-01T02:59:59.000Z' });
    expect(planHistoryOf([p('active')], AHORA)).toEqual({ kind: 'expired', endedOn: '2026-10-01T02:59:59.000Z' });
    // con varios, la fecha es la del plan que terminó más tarde
    const dos = [p('expired', { endDate: '2026-08-01T02:59:59.000Z' }), p('expired', { endDate: '2026-10-01T02:59:59.000Z' })];
    expect(planHistoryOf(dos, AHORA).endedOn).toBe('2026-10-01T02:59:59.000Z');
  });

  it('con un plan que todavía no empieza: «upcoming» con su fecha de inicio (el más próximo)', () => {
    const r = planHistoryOf([p('expired'), p('upcoming', { startDate: '2026-12-01T03:00:00.000Z' }), p('upcoming', { startDate: '2026-11-01T03:00:00.000Z' })], AHORA);
    expect(r).toEqual({ kind: 'upcoming', upcomingStart: '2026-11-01T03:00:00.000Z' });
  });
});

// ── Próxima sesión ──────────────────────────────────────────────────────────
const cita = (dia) => ({ _id: dia, date: `${dia}T00:00:00.000Z`, startTime: '10:00', endTime: '11:00', status: 'scheduled', type: 'entrenamiento' });

describe('Próxima sesión: hoy o futura, con texto claro', () => {
  it('hoy: «Hoy», sin cuenta regresiva (eso ya lo dice «Para hoy»)', () => {
    expect(nextSessionLabel(cita('2026-10-14'), AHORA)).toEqual({ text: 'Hoy', isToday: true });
  });

  it('mañana: «Mañana»', () => {
    expect(nextSessionLabel(cita('2026-10-15'), AHORA)).toEqual({ text: 'Mañana', isToday: false });
  });

  it('más adelante: día de la semana y fecha, con cuántos días faltan', () => {
    expect(nextSessionLabel(cita('2026-10-19'), AHORA)).toEqual({ text: 'Lunes 19 de octubre', isToday: false, detail: 'en 5 días' });
  });

  it('de noche (23:30 en Chile) «hoy» sigue siendo el día de Chile, no el de UTC', () => {
    const tarde = new Date('2026-10-15T02:30:00Z');
    expect(nextSessionLabel(cita('2026-10-14'), tarde).text).toBe('Hoy');
    expect(nextSessionLabel(cita('2026-10-15'), tarde).text).toBe('Mañana');
  });

  it('plural de sesiones', () => {
    expect([sessionsWord(0), sessionsWord(1), sessionsWord(3)]).toEqual(['0 sesiones', '1 sesión', '3 sesiones']);
  });
});

// ── Tu constancia (datos de /api/achievements/me) ───────────────────────────
const progreso = (current, target, extra = {}) => ({ current, target, unit: 'sesiones', label: 'sesiones completadas este mes', periodKey: '2026-10', ...extra });
const item = (key, status, progress, extra = {}) => ({ key, title: key, description: '', criteria: null, status, progress, awards: [], ...extra });
const resumen = (extra = {}) => ({
  categories: [{ key: 'constancia', label: 'Constancia', items: [item('consistency_month', 'in_progress', progreso(6, 8))] }],
  next: { key: 'consistency_month', title: 'Mes de constancia', category: 'constancia', categoryLabel: 'Constancia', progress: progreso(6, 8) },
  unseen: [],
  history: [],
  summary: { earned: 3 },
  ...extra
});

describe('Tu constancia: qué se muestra de la respuesta del servidor', () => {
  it('con meta mensual válida: «X de Y sesiones» y, si es el mismo reto, el siguiente logro NO se repite como bloque aparte', () => {
    const v = computeProgressView(resumen());
    expect(v.consistency).toMatchObject({ current: 6, target: 8, ratio: 0.75, done: false });
    expect(v.next).toMatchObject({ key: 'consistency_month', isMonthlyConsistency: true });
    expect(v.earned).toBe(3);
  });

  it('mes completado: lo dice (done) y la barra no pasa de 100 %', () => {
    const v = computeProgressView(resumen({ categories: [{ key: 'constancia', items: [item('consistency_month', 'earned', progreso(9, 8))] }] }));
    expect(v.consistency).toMatchObject({ current: 8, target: 8, ratio: 1, done: true });
  });

  it('siguiente logro distinto de la constancia: se muestra con su progreso', () => {
    const next = { key: 'streak_3', title: '3 meses en movimiento', category: 'trayectoria', progress: progreso(1, 3, { unit: 'meses', label: 'meses seguidos de constancia' }) };
    const v = computeProgressView(resumen({ next }));
    expect(v.next).toMatchObject({ key: 'streak_3', title: '3 meses en movimiento', current: 1, target: 3, isMonthlyConsistency: false });
  });

  it('sin plan mensual con meta (p. ej. kinesiología o ilimitado): no hay constancia, pero sí puede haber siguiente logro', () => {
    const next = { key: 'kine_5', title: '5 sesiones completadas', category: 'kinesiologia', progress: progreso(2, 5, { unit: 'sesiones', label: 'sesiones de kinesiología completadas' }) };
    const v = computeProgressView({ categories: [{ key: 'kinesiologia', items: [] }], next, summary: { earned: 0 } });
    expect(v.consistency).toBeNull();
    expect(v.next.key).toBe('kine_5');
    expect(v.earned).toBe(0);
  });

  it('sin datos aplicables o respuesta incompleta: null (el bloque no se muestra)', () => {
    expect(computeProgressView(null)).toBeNull();
    expect(computeProgressView(undefined)).toBeNull();
    expect(computeProgressView({})).toBeNull();
    expect(computeProgressView({ categories: [], next: null, summary: { earned: 2 } })).toBeNull();
  });

  it('meta inválida (0, negativa o no numérica) no genera barras ni divisiones raras', () => {
    for (const bad of [progreso(3, 0), progreso(3, -4), progreso(NaN, 8), progreso(-1, 8), { current: 3, target: 8 }]) {
      const v = computeProgressView(resumen({ categories: [{ key: 'constancia', items: [item('consistency_month', 'in_progress', bad)] }], next: null }));
      expect(v?.consistency ?? null).toBeNull();
    }
    expect(computeProgressView(resumen({ categories: [], next: { key: 'x', title: 'X', category: 'trayectoria', progress: null } }))).toBeNull();
  });

  it('«Mes de constancia» como siguiente logro sin su progreso mensual válido no se muestra (no se podría explicar)', () => {
    const v = computeProgressView(resumen({ categories: [{ key: 'constancia', items: [item('consistency_month', 'in_progress', null)] }] }));
    expect(v).toBeNull();
  });

  it('PRIVACIDAD: no se muestran logros de peso, sueño ni estrés en el dashboard', () => {
    expect(HIDDEN_ON_DASHBOARD).toEqual(['cuerpo', 'descanso', 'estres']);
    for (const category of ['cuerpo', 'descanso', 'estres']) {
      const next = { key: 'body_goal', title: 'Meta de peso alcanzada', category, progress: progreso(1.5, 4, { unit: 'kg', label: 'de cambio hacia tu meta' }) };
      const v = computeProgressView(resumen({ categories: [], next }));
      expect(v).toBeNull();
      expect(JSON.stringify(computeProgressView(resumen({ next })))).not.toMatch(/kg|peso/i);
    }
  });

  it('el número de logros conseguidos solo se usa si es un número válido', () => {
    expect(computeProgressView(resumen({ summary: { earned: 'muchos' } })).earned).toBe(0);
    expect(computeProgressView(resumen({ summary: undefined })).earned).toBe(0);
    expect(computeProgressView(resumen({ summary: { earned: -2 } })).earned).toBe(0);
  });
});
