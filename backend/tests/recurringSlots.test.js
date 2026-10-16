/**
 * PRUEBAS — horario fijo semanal (models/RecurringSlot.js, services/recurringSlotService.js, controllers/recurringSlotController.js).
 *
 * Dos bloques (la autorización del controlador está en recurringSlotsController.test.js):
 *   1. Reglas puras (fechas de un día de la semana dentro de los días del plan, atención del profesional).
 *   2. El motor de agendado (`syncSlot`) con datos simulados: qué agenda, qué salta, qué avisa y que sea idempotente.
 *
 * Mismo patrón que el resto de backend/tests/ (vitest, sin base real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

process.env.TZ = 'UTC'; // como corre Railway

import { santiagoToUtc } from '../utils/timezone.js';
import {
  weekdayOf,
  santiagoDateString,
  occurrenceDates,
  schedulingHorizon,
  isSlotOpen,
  formatDateEs,
  syncSlot
} from '../services/recurringSlotService.js';

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();

// ─── 1. Reglas puras ────────────────────────────────────────────────────────

describe('weekdayOf / santiagoDateString', () => {
  it('calcula el día de la semana de una fecha sola', () => {
    expect(weekdayOf('2026-10-19')).toBe(1); // lunes
    expect(weekdayOf('2026-10-24')).toBe(6); // sábado
    expect(weekdayOf('2026-10-25')).toBe(0); // domingo
  });

  it('el último instante de un plan cae en su último DÍA de Santiago, no al día siguiente en UTC', () => {
    // 31-oct 23:59:59.999 en Chile (UTC-3) ya es 1-nov en UTC
    const finDelPlan = new Date(santiagoToUtc(2026, 11, 1).getTime() - 1);
    expect(finDelPlan.toISOString().startsWith('2026-11-01')).toBe(true);
    expect(santiagoDateString(finDelPlan)).toBe('2026-10-31');
  });
});

describe('occurrenceDates: solo los días que cubre el plan', () => {
  const finOctubre = new Date(santiagoToUtc(2026, 11, 1).getTime() - 1);

  it('lista los lunes desde hoy hasta el último día del plan', () => {
    expect(occurrenceDates({ dayOfWeek: 1, today: '2026-10-16', planEndDate: finOctubre })).toEqual(['2026-10-19', '2026-10-26']);
  });

  it('incluye hoy si hoy es ese día, y el último día del plan si cae en ese día', () => {
    expect(occurrenceDates({ dayOfWeek: 6, today: '2026-10-24', planEndDate: finOctubre })).toEqual(['2026-10-24', '2026-10-31']);
  });

  it('no pasa del plan: sin días por delante, no hay fechas', () => {
    expect(occurrenceDates({ dayOfWeek: 1, today: '2026-10-31', planEndDate: finOctubre })).toEqual([]);
  });
});

describe('isSlotOpen: atención del profesional', () => {
  const availability = {
    weeklySchedule: [
      { dayOfWeek: 1, slots: [{ startTime: '09:00' }, { startTime: '18:00' }] },
      { dayOfWeek: 3, slots: [{ startTime: '10:00' }] }
    ],
    blockedDates: [
      { date: new Date('2026-10-26'), allDay: true, slots: [] },
      { date: new Date('2026-11-02'), allDay: false, slots: [{ startTime: '18:00' }] }
    ]
  };

  it('abierto cuando la hora está en su horario de ese día', () => {
    expect(isSlotOpen(availability, '2026-10-19', '18:00')).toBe(true);
  });

  it('cerrado si ese día no atiende, o a esa hora', () => {
    expect(isSlotOpen(availability, '2026-10-20', '18:00')).toBe(false);
    expect(isSlotOpen(availability, '2026-10-19', '19:00')).toBe(false);
  });

  it('cerrado si la fecha está bloqueada completa o esa hora está bloqueada', () => {
    expect(isSlotOpen(availability, '2026-10-26', '18:00')).toBe(false);
    expect(isSlotOpen(availability, '2026-11-02', '18:00')).toBe(false);
    expect(isSlotOpen(availability, '2026-11-02', '09:00')).toBe(true);
  });

  it('sin horario configurado: cerrado', () => {
    expect(isSlotOpen(null, '2026-10-19', '18:00')).toBe(false);
  });
});

describe('formatDateEs', () => {
  it('formatea en español', () => {
    expect(formatDateEs('2026-10-19')).toMatch(/lunes 19 de octubre/);
  });
});

// ─── 2. El motor de agendado ────────────────────────────────────────────────

const PACIENTE = nuevoId();
const PROFESIONAL = nuevoId();
const finOctubre = new Date(santiagoToUtc(2026, 11, 1).getTime() - 1);
// Viernes 16-oct-2026, 12:00 en Chile (verano, UTC-3)
const AHORA = santiagoToUtc(2026, 10, 16, 12, 0);

const nuevoSlot = (extra = {}) => ({
  _id: nuevoId(),
  patient: PACIENTE,
  professional: PROFESIONAL,
  dayOfWeek: 1,
  startTime: '18:00',
  type: 'entrenamiento',
  active: true,
  skipped: [],
  ...extra
});

const atencion = {
  weeklySchedule: [{ dayOfWeek: 1, slots: [{ startTime: '18:00' }] }],
  blockedDates: []
};

// Dependencias simuladas: todo funciona salvo lo que cada prueba cambie
const crearDeps = (over = {}) => {
  const creadas = [];
  const deps = {
    getActivePlanByType: vi.fn(async () => ({ _id: nuevoId(), endDate: finOctubre })),
    checkBalance: vi.fn(async () => null),
    deduct: vi.fn(async () => ({ source: 'clientPlan', refId: nuevoId() })),
    refund: vi.fn(async () => {}),
    isExempt: vi.fn(async () => false),
    countOverlapping: vi.fn(async () => 0),
    listPatientAppointments: vi.fn(async () => []),
    getAvailability: vi.fn(async () => atencion),
    createAppointment: vi.fn(async (data) => { creadas.push(data); return data; }),
    addSkipped: vi.fn(async () => {}),
    markNotified: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    notifyOnce: vi.fn(async () => {}),
    ...over
  };
  return { deps, creadas };
};

describe('schedulingHorizon (planes sin fin)', () => {
  it('un plan «hasta completar» no pasa del último día del mes en curso; uno que termina antes, termina antes', () => {
    expect(schedulingHorizon(new Date('2099-12-31T12:00:00Z'), '2026-10-19').toISOString().slice(0, 10)).toBe('2026-10-31');
    expect(schedulingHorizon(new Date('2026-10-24T12:00:00Z'), '2026-10-19').toISOString().slice(0, 10)).toBe('2026-10-24');
  });
});

describe('syncSlot: agenda las citas que faltan dentro del plan', () => {
  it('agenda todos los lunes que quedan del plan, con las mismas reglas de una reserva normal', async () => {
    const { deps, creadas } = crearDeps();
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-19', '2026-10-26']);
    expect(deps.deduct).toHaveBeenCalledTimes(2);
    expect(creadas).toHaveLength(2);
    expect(creadas[0]).toMatchObject({
      patient: PACIENTE,
      professional: PROFESIONAL,
      startTime: '18:00',
      endTime: '19:00',
      type: 'entrenamiento',
      sessionDeducted: true,
      overbooked: false
    });
    expect(creadas[0].recurringSlot).toBeDefined();
    expect(creadas[0].date.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('es idempotente: repetir la pasada no duplica ni vuelve a descontar', async () => {
    const existentes = [
      { date: '2026-10-19', startTime: '18:00', status: 'scheduled' },
      { date: '2026-10-26', startTime: '18:00', status: 'scheduled' }
    ];
    const { deps } = crearDeps({ listPatientAppointments: vi.fn(async () => existentes) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual([]);
    expect(deps.deduct).not.toHaveBeenCalled();
    expect(deps.createAppointment).not.toHaveBeenCalled();
  });

  it('una fecha que la persona CANCELÓ a propósito no se vuelve a agendar', async () => {
    const existentes = [{ date: '2026-10-19', startTime: '18:00', status: 'cancelled' }];
    const { deps } = crearDeps({ listPatientAppointments: vi.fn(async () => existentes) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-26']);
  });

  it('si ese día ya tiene otra cita vigente, no agenda una segunda ni gasta otra sesión', async () => {
    const existentes = [{ date: '2026-10-19', startTime: '10:00', status: 'scheduled' }];
    const { deps } = crearDeps({ listPatientAppointments: vi.fn(async () => existentes) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-26']);
    expect(r.skipped).toEqual([{ date: '2026-10-19', code: 'ALREADY_BOOKED' }]);
    expect(deps.deduct).toHaveBeenCalledTimes(1);
  });

  it('no agenda con menos de 2 horas de anticipación (y tampoco lo marca como saltado)', async () => {
    // Lunes 19-oct 16:30 en Chile; el horario es a las 18:00 (falta 1,5 h)
    const { deps } = crearDeps();
    const ahora = santiagoToUtc(2026, 10, 19, 16, 30);
    const r = await syncSlot(nuevoSlot(), { now: ahora, deps });

    expect(r.created).toEqual(['2026-10-26']);
    expect(r.skipped).toEqual([]);
  });

  it('salta (y lo recuerda) la fecha en que el horario está lleno', async () => {
    const countOverlapping = vi.fn(async (_pro, date) => (date === '2026-10-19' ? 4 : 0));
    const { deps } = crearDeps({ countOverlapping });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-26']);
    expect(r.skipped).toEqual([{ date: '2026-10-19', code: 'FULL' }]);
    expect(deps.addSkipped).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ date: '2026-10-19', code: 'FULL' })]);
  });

  it('un paciente «sobre cupo» agenda aunque el horario esté lleno', async () => {
    const { deps, creadas } = crearDeps({ isExempt: vi.fn(async () => true), countOverlapping: vi.fn(async () => 4) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toHaveLength(2);
    expect(creadas[0].outsideCapacity).toBe(true);
  });

  it('salta el día en que el profesional bloqueó su agenda', async () => {
    const bloqueado = { ...atencion, blockedDates: [{ date: new Date('2026-10-19'), allDay: true, slots: [] }] };
    const { deps } = crearDeps({ getAvailability: vi.fn(async () => bloqueado) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-26']);
    expect(r.skipped).toEqual([{ date: '2026-10-19', code: 'NOT_AVAILABLE' }]);
  });

  it('una fecha ya saltada antes no se vuelve a intentar', async () => {
    const slot = nuevoSlot({ skipped: [{ date: '2026-10-19', code: 'FULL', notifiedAt: AHORA }] });
    const { deps } = crearDeps();
    const r = await syncSlot(slot, { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-26']);
  });

  it('renovación pendiente de pago: lo que cae después del plazo queda esperando (no se marca como saltado)', async () => {
    const checkBalance = vi.fn(async (_p, _t, { date }) => (date === '2026-10-26'
      ? { status: 403, body: { code: 'PAYMENT_PENDING', message: 'pendiente' } }
      : null));
    const { deps } = crearDeps({ checkBalance });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual(['2026-10-19']);
    expect(r.pendingPayment).toBe(1);
    expect(r.skipped).toEqual([]);
    expect(deps.addSkipped).toHaveBeenCalledWith(expect.anything(), []);
  });

  it('sin sesiones disponibles: se detiene, no descuenta nada y lo avisa una sola vez', async () => {
    const checkBalance = vi.fn(async () => ({ status: 403, body: { code: 'NO_ACTIVE_PLAN_SESSIONS' } }));
    const { deps } = crearDeps({ checkBalance });
    const slot = nuevoSlot();
    const r = await syncSlot(slot, { now: AHORA, deps });

    expect(r.noSessions).toBe(true);
    expect(r.created).toEqual([]);
    expect(deps.deduct).not.toHaveBeenCalled();
    expect(deps.notifyOnce).toHaveBeenCalledTimes(1);
    expect(deps.notifyOnce.mock.calls[0][2].dedupeKey).toContain(String(slot._id));
  });

  it('si otra reserva se llevó la última sesión justo ahora (descuento falla), no crea la cita', async () => {
    const { deps } = crearDeps({ deduct: vi.fn(async () => null) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual([]);
    expect(r.noSessions).toBe(true);
    expect(deps.createAppointment).not.toHaveBeenCalled();
  });

  it('si la cita no se puede crear, devuelve la sesión que ya había descontado', async () => {
    const { deps } = crearDeps({ createAppointment: vi.fn(async () => { throw new Error('fallo'); }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.created).toEqual([]);
    expect(deps.refund).toHaveBeenCalledTimes(2);
  });

  it('sin plan vigente de ese tipo no agenda nada (el plan vencido sin pagar no tiene días que cubrir)', async () => {
    const { deps } = crearDeps({ getActivePlanByType: vi.fn(async () => null) });
    const r = await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(r.noPlan).toBe(true);
    expect(deps.createAppointment).not.toHaveBeenCalled();
  });

  it('un horario en pausa no agenda', async () => {
    const { deps } = crearDeps();
    const r = await syncSlot(nuevoSlot({ active: false }), { now: AHORA, deps });

    expect(r.created).toEqual([]);
    expect(deps.getActivePlanByType).not.toHaveBeenCalled();
  });

  it('el plan trimestral/anual ya pagado no se adelanta: solo se agenda el ciclo vigente', async () => {
    // El servicio pide el plan ACTIVO; los ciclos «upcoming» ya pagados no cuentan hasta que arrancan
    const { deps } = crearDeps();
    await syncSlot(nuevoSlot(), { now: AHORA, deps });
    expect(deps.getActivePlanByType).toHaveBeenCalledWith(PACIENTE, 'entrenamiento');
  });

  it('dos pasadas a la vez sobre el mismo horario no se pisan', async () => {
    let liberar;
    const espera = new Promise((resolve) => { liberar = resolve; });
    const { deps } = crearDeps({ getActivePlanByType: vi.fn(async () => { await espera; return { _id: nuevoId(), endDate: finOctubre }; }) });
    const slot = nuevoSlot();

    const primera = syncSlot(slot, { now: AHORA, deps });
    const segunda = await syncSlot(slot, { now: AHORA, deps });
    expect(segunda.busy).toBe(true);

    liberar();
    const r = await primera;
    expect(r.created).toHaveLength(2);
  });
});

describe('syncSlot: avisos', () => {
  it('avisa lo agendado, y lo que no se pudo (también por correo vía el tipo), pero no el «ya tenía otra cita»', async () => {
    const existentes = [{ date: '2026-10-26', startTime: '10:00', status: 'scheduled' }];
    const countOverlapping = vi.fn(async (_pro, date) => (date === '2026-10-19' ? 4 : 0));
    const { deps } = crearDeps({ listPatientAppointments: vi.fn(async () => existentes), countOverlapping });
    await syncSlot(nuevoSlot(), { now: AHORA, deps });

    const tipos = deps.notify.mock.calls.map((c) => c[1]);
    expect(tipos).toEqual(['recurring_skipped']);
    expect(deps.notify.mock.calls[0][2].body).toMatch(/lunes 19 de octubre/);
    expect(deps.notify.mock.calls[0][2].body).not.toMatch(/26 de octubre/);
    expect(deps.markNotified).toHaveBeenCalledWith(expect.anything(), ['2026-10-19'], AHORA);
  });

  it('avisa que se agendaron sesiones', async () => {
    const { deps } = crearDeps();
    await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.notify.mock.calls[0][1]).toBe('recurring_booked');
    expect(deps.notify.mock.calls[0][2].body).toMatch(/2 sesiones/);
  });

  it('en modo silencioso (la persona está mirando la pantalla) no manda avisos', async () => {
    const { deps } = crearDeps({ countOverlapping: vi.fn(async () => 4) });
    await syncSlot(nuevoSlot(), { now: AHORA, silent: true, deps });

    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.notifyOnce).not.toHaveBeenCalled();
  });

  it('si no hay nada nuevo, no manda avisos', async () => {
    const existentes = [
      { date: '2026-10-19', startTime: '18:00', status: 'scheduled' },
      { date: '2026-10-26', startTime: '18:00', status: 'scheduled' }
    ];
    const { deps } = crearDeps({ listPatientAppointments: vi.fn(async () => existentes) });
    await syncSlot(nuevoSlot(), { now: AHORA, deps });

    expect(deps.notify).not.toHaveBeenCalled();
  });
});
