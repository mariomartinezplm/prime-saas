/**
 * PRUEBAS — hasta cuándo se puede agendar y de qué ciclo sale la sesión (decisión de Mario, 2026-10-30):
 *  - hasta el día 5 del mes que viene, para todos (plazo de pago), con lo que queda del último ciclo;
 *  - con la renovación ya hecha, todo el mes siguiente y hasta el día 5 del subsiguiente;
 *  - sin renovación pendiente de pago, solo hasta el fin del plazo de pago.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import { deductSession, bookingWindowOf, planForBooking } from '../services/clientPlanService.js';
import { checkSessionBalanceForBooking } from '../services/bookingGuards.js';
import { santiagoToUtc, santiagoParts } from '../utils/timezone.js';

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const PATIENT = new mongoose.Types.ObjectId();
const at = (y, m, d, h = 10) => santiagoToUtc(y, m, d, h, 0);
const lastMs = (y, m) => new Date(santiagoToUtc(y, m + 1, 1).getTime() - 1);
const ymd = (date) => { const p = santiagoParts(date); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };

let seq = 0;
const cycle = (y, m, over = {}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    patient: PATIENT,
    serviceType: 'entrenamiento',
    status: 'active',
    startDate: santiagoToUtc(y, m, 1),
    endDate: lastMs(y, m),
    sessionsTotal: 8,
    sessionsUsed: 0,
    renews: true,
    graceDays: 5,
    paymentPending: false,
    sessionsAvailable() { return Math.max(0, this.sessionsTotal - this.sessionsUsed); },
    ...over
  };
  seq += 1;
  return doc;
};

// Simula la base: los ciclos del paciente
function mockPlans(plans) {
  const active = plans.find((p) => p.status === 'active') ?? null;
  vi.spyOn(ClientPlan, 'findOne').mockResolvedValue(active);
  vi.spyOn(ClientPlan, 'find').mockReturnValue({ sort: async () => plans.filter((p) => ['active', 'upcoming'].includes(p.status)).sort((a, b) => a.startDate - b.startDate) });
  vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
}

beforeEach(() => vi.restoreAllMocks());

describe('hasta cuándo se puede agendar', () => {
  it('último ciclo de octubre sin renovar: hasta el 5 de noviembre', () => {
    const oct = cycle(2026, 10);
    expect(ymd(bookingWindowOf([oct]).until)).toBe('2026-11-05');
  });

  it('renovado por adelantado (noviembre pagado): todo noviembre y hasta el 5 de diciembre', () => {
    const oct = cycle(2026, 10);
    const nov = cycle(2026, 11, { status: 'upcoming' });
    expect(ymd(bookingWindowOf([oct, nov]).until)).toBe('2026-12-05');
  });

  it('plan anual con varios meses pagados: solo el mes siguiente, no todo el año', () => {
    const oct = cycle(2026, 10);
    const nov = cycle(2026, 11, { status: 'upcoming' });
    const dic = cycle(2026, 12, { status: 'upcoming' });
    expect(ymd(bookingWindowOf([oct, nov, dic]).until)).toBe('2026-11-30');
  });

  it('renovación pendiente de pago: solo hasta el fin del plazo (día 5)', () => {
    const nov = cycle(2026, 11, { paymentPending: true, paymentDueBy: santiagoToUtc(2026, 11, 6) });
    expect(ymd(bookingWindowOf([nov]).until)).toBe('2026-11-05');
  });

  it('un plan que no se renueva termina el día de su fin, sin plazo extra', () => {
    expect(ymd(bookingWindowOf([cycle(2026, 10, { renews: false })]).until)).toBe('2026-10-31');
  });
});

describe('agendar con la fecha de la cita', () => {
  it('último ciclo sin renovar: el 3 de noviembre se puede (usa lo que le queda); el 6, no', async () => {
    mockPlans([cycle(2026, 10, { sessionsUsed: 5 })]);
    expect(await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-11-03', startTime: '10:00' })).toBeNull();
    const blocked = await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-11-06', startTime: '10:00' });
    expect(blocked.body.code).toBe('OUTSIDE_PLAN');
    expect(blocked.body.message).toContain('5 de noviembre');
  });

  it('con noviembre ya renovado: se puede agendar todo noviembre y hasta el 5 de diciembre', async () => {
    mockPlans([cycle(2026, 10), cycle(2026, 11, { status: 'upcoming' })]);
    for (const date of ['2026-10-31', '2026-11-01', '2026-11-20', '2026-12-05']) {
      expect(await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date, startTime: '10:00' })).toBeNull();
    }
    expect((await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-12-06', startTime: '10:00' })).body.code).toBe('OUTSIDE_PLAN');
  });

  it('sin sesiones en octubre pero con noviembre pagado: noviembre sí, octubre no', async () => {
    mockPlans([cycle(2026, 10, { sessionsUsed: 8 }), cycle(2026, 11, { status: 'upcoming' })]);
    expect(await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-11-10', startTime: '10:00' })).toBeNull();
    expect((await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-10-30', startTime: '10:00' })).body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
  });

  it('renovación pendiente: dentro del plazo sí; pasado el día 5, pide registrar el pago (como antes)', async () => {
    mockPlans([cycle(2026, 11, { paymentPending: true, paymentDueBy: santiagoToUtc(2026, 11, 6) })]);
    expect(await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-11-05', startTime: '10:00' })).toBeNull();
    expect((await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-11-06', startTime: '10:00' })).body.code).toBe('PAYMENT_PENDING');
  });

  it('una fecha dentro del plan vigente no hace consultas de más', async () => {
    mockPlans([cycle(2026, 10)]);
    await checkSessionBalanceForBooking(PATIENT, 'entrenamiento', { date: '2026-10-31', startTime: '10:00' });
    expect(ClientPlan.find).not.toHaveBeenCalled();
  });
});

describe('de qué ciclo se descuenta la sesión', () => {
  const mockDeduct = (plans) => {
    mockPlans(plans);
    return vi.spyOn(ClientPlan, 'findOneAndUpdate').mockImplementation(async (filter) => {
      // Filtro por fecha del plan vigente: solo cumple si la cita cae antes de su fin
      const target = filter._id ? plans.find((p) => String(p._id) === String(filter._id)) : plans.find((p) => p.status === 'active' && p.endDate.getTime() >= filter.endDate.$gte.getTime());
      if (!target || target.sessionsUsed >= target.sessionsTotal) return null;
      target.sessionsUsed += 1;
      return target;
    });
  };

  it('una cita de noviembre con noviembre ya renovado descuenta del ciclo de noviembre', async () => {
    const oct = cycle(2026, 10);
    const nov = cycle(2026, 11, { status: 'upcoming' });
    mockDeduct([oct, nov]);
    const result = await deductSession(PATIENT, 'entrenamiento', null, { date: '2026-11-20', startTime: '10:00' });
    expect(String(result.refId)).toBe(String(nov._id));
    expect([oct.sessionsUsed, nov.sessionsUsed]).toEqual([0, 1]);
  });

  it('una cita de octubre descuenta de octubre (como siempre)', async () => {
    const oct = cycle(2026, 10);
    const nov = cycle(2026, 11, { status: 'upcoming' });
    mockDeduct([oct, nov]);
    const result = await deductSession(PATIENT, 'entrenamiento', null, { date: '2026-10-31', startTime: '10:00' });
    expect(String(result.refId)).toBe(String(oct._id));
  });

  it('una cita del 3 de noviembre sin renovar descuenta lo que queda del ciclo de octubre', async () => {
    const oct = cycle(2026, 10, { sessionsUsed: 6 });
    mockDeduct([oct]);
    const result = await deductSession(PATIENT, 'entrenamiento', null, { date: '2026-11-03', startTime: '10:00' });
    expect(String(result.refId)).toBe(String(oct._id));
    expect(oct.sessionsUsed).toBe(7);
  });

  it('sin fecha (llamadas antiguas) descuenta del plan vigente', async () => {
    const oct = cycle(2026, 10);
    mockDeduct([oct, cycle(2026, 11, { status: 'upcoming' })]);
    expect(String((await deductSession(PATIENT, 'entrenamiento', null)).refId)).toBe(String(oct._id));
  });
});

describe('planForBooking', () => {
  it('fuera de la ventana no hay ciclo', async () => {
    mockPlans([cycle(2026, 10)]);
    expect(await planForBooking(PATIENT, 'entrenamiento', at(2026, 11, 8))).toBeNull();
    expect((await planForBooking(PATIENT, 'entrenamiento', at(2026, 11, 4))).tail).toBe(true);
  });
});
