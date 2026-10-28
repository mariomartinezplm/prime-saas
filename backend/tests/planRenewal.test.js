/**
 * PRUEBAS — «Renovar plan» con un toque: qué hace según el estado del plan y que NUNCA toca citas ni horario fijo.
 * Sin base real: se simulan los modelos y las funciones de planes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const mocks = vi.hoisted(() => ({
  plans: [],
  advancePlans: vi.fn(async () => {}),
  settlePendingPlan: vi.fn(async (plan) => ({ ...plan, paymentPending: false, settled: true })),
  createEarlyRenewal: vi.fn(async (plan) => ({ early: true, from: plan._id })),
  createTermPlans: vi.fn(async (args) => ({ created: true, ...args })),
  syncSlot: vi.fn(async () => ({ created: [1, 2], skipped: [] })),
  slots: [],
  appointments: 3
}));

vi.mock('../models/ClientPlan.js', () => ({
  default: {
    find: () => ({ sort: () => ({ limit: async () => mocks.plans }) }),
    findOne: async ({ _id }) => mocks.plans.find((p) => String(p._id) === String(_id)) ?? null
  }
}));
vi.mock('../models/Appointment.js', () => ({ default: { countDocuments: vi.fn(async () => mocks.appointments) } }));
vi.mock('../models/RecurringSlot.js', () => ({
  default: { find: vi.fn(async () => mocks.slots), countDocuments: vi.fn(async () => mocks.slots.length) }
}));
vi.mock('../services/planLifecycleService.js', () => ({
  advancePlans: mocks.advancePlans,
  settlePendingPlan: mocks.settlePendingPlan,
  createEarlyRenewal: mocks.createEarlyRenewal,
  createTermPlans: mocks.createTermPlans,
  RenewalError: class RenewalError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
  }
}));
vi.mock('../services/recurringSlotService.js', () => ({ syncSlot: mocks.syncSlot }));

const { planRenewalStatus, describeRenewal, renewPatientPlan } = await import('../services/planRenewalService.js');

const id = () => new mongoose.Types.ObjectId();
const PATIENT = id();
const NOW = new Date('2026-11-03T15:00:00.000Z');
const D = (iso) => new Date(iso);
const plan = (over = {}) => ({
  _id: id(), patient: PATIENT, serviceType: 'entrenamiento', sessionsTotal: 12, sessionsUsed: 3, unlimited: false, term: 'mensual', billingCycle: 'calendar',
  cycleNumber: 1, cyclesTotal: 1, status: 'active', paymentPending: false, openEnded: false, renews: true, graceDays: 5, paymentMode: 'prepaid', scholarship: false,
  startDate: D('2026-11-01T03:00:00.000Z'), endDate: D('2026-12-01T02:59:59.999Z'),
  save: vi.fn(async () => {}), sessionsAvailable() { return this.sessionsTotal - this.sessionsUsed; },
  ...over
});
const admin = { _id: id(), role: 'admin' };
const pro = { _id: id(), role: 'professional' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.plans = [];
  mocks.slots = [{ _id: id(), patient: PATIENT, active: true }, { _id: id(), patient: PATIENT, active: true }];
  mocks.appointments = 3;
});

describe('qué se renueva según el estado del plan', () => {
  it('sin ningún plan no hay nada que renovar y se dice qué hacer', async () => {
    const r = await planRenewalStatus(PATIENT, { now: NOW });
    expect(r).toMatchObject({ kind: 'none', reason: 'NO_PLAN' });
    expect(mocks.advancePlans).toHaveBeenCalledWith({ patientId: PATIENT, now: NOW }); // antes se deja el plan al día
  });

  it('una renovación pendiente de pago se da por pagada (conserva lo ya usado)', async () => {
    const pending = plan({ paymentPending: true, sessionsUsed: 2 });
    mocks.plans = [pending];
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'settle_pending', plan: pending });
  });

  it('un plan pagado en su último ciclo se renueva por adelantado, pero solo en sus últimos 10 días', async () => {
    const active = plan();
    mocks.plans = [active];
    // 3 de noviembre: faltan casi 4 semanas, es demasiado pronto (un segundo toque justo después de renovar no paga otro mes)
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'none', reason: 'TOO_EARLY' });
    // 25 de noviembre: faltan 6 días
    expect(await planRenewalStatus(PATIENT, { now: new Date('2026-11-25T15:00:00.000Z') })).toMatchObject({ kind: 'early', plan: active });
  });

  it('un plan que ya tiene ciclos pagados por delante, o ya renovado, no se vuelve a renovar', async () => {
    const termId = id();
    mocks.plans = [plan({ termId, cycleNumber: 1, cyclesTotal: 3 }), plan({ termId, status: 'upcoming', cycleNumber: 2, cyclesTotal: 3, endDate: D('2027-01-01T02:59:59.999Z') })];
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'none', reason: 'PAID_AHEAD' });
    mocks.plans = [plan(), plan({ status: 'upcoming', endDate: D('2027-01-01T02:59:59.999Z') })];
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'none', reason: 'PAID_AHEAD' });
  });

  it('un plan vencido se reactiva con las mismas condiciones', async () => {
    const expired = plan({ status: 'expired', endDate: D('2026-10-31T02:59:59.999Z'), startDate: D('2026-10-01T03:00:00.000Z') });
    mocks.plans = [expired];
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'reactivate', plan: expired });
  });

  it('kinesiología: con sesiones por usar no se renueva; terminada, se crea un paquete igual', async () => {
    mocks.plans = [plan({ serviceType: 'kinesiologia', openEnded: true, sessionsTotal: 10, sessionsUsed: 4, endDate: D('2099-12-31T23:59:59.000Z') })];
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'none', reason: 'SESSIONS_LEFT' });
    mocks.plans = [plan({ serviceType: 'kinesiologia', openEnded: true, sessionsTotal: 10, sessionsUsed: 10, endDate: D('2099-12-31T23:59:59.000Z') })];
    expect(await planRenewalStatus(PATIENT, { now: NOW })).toMatchObject({ kind: 'kine_new' });
  });
});

describe('vista previa', () => {
  it('cuenta lo que se mantiene (citas por venir y horarios fijos) y las fechas del plazo', async () => {
    mocks.plans = [plan({ paymentPending: true, term: 'trimestral', cyclesTotal: 3, startDate: D('2026-11-01T03:00:00.000Z') })];
    const d = await describeRenewal(PATIENT, { now: NOW });
    expect(d.keep).toEqual({ futureAppointments: 3, fixedSlots: 2 });
    expect(d.plan).toMatchObject({ serviceType: 'entrenamiento', sessionsTotal: 12, term: 'trimestral', cyclesTotal: 3 });
    expect(new Date(d.starts).toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(new Date(d.endsOn) > new Date(d.firstCycleEnds)).toBe(true);
  });
  it('si no hay nada que renovar la vista previa lo explica y no promete nada', async () => {
    mocks.plans = [];
    expect((await describeRenewal(PATIENT, { now: NOW })).kind).toBe('none');
  });
});

describe('al renovar', () => {
  it('renovación pendiente → se marca pagada con las mismas sesiones y plazo, y se ajusta el horario fijo', async () => {
    const pending = plan({ paymentPending: true, term: 'trimestral', cyclesTotal: 3 });
    mocks.plans = [pending];
    const r = await renewPatientPlan(PATIENT, admin, { now: NOW });
    expect(r.kind).toBe('settle_pending');
    expect(mocks.settlePendingPlan).toHaveBeenCalledWith(pending, expect.objectContaining({ sessionsTotal: 12, term: 'trimestral', renews: true, registeredBy: admin._id }));
    expect(mocks.createTermPlans).not.toHaveBeenCalled();
    // Cada horario fijo vigente se revisa (no se crea ni se borra ninguno)
    expect(mocks.syncSlot).toHaveBeenCalledTimes(2);
    expect(r.fixed).toEqual({ slots: 2, created: 4, skipped: 0 });
  });

  it('plan vigente → renovación por adelantado, sin cerrar el plan actual', async () => {
    const active = plan();
    mocks.plans = [active];
    const r = await renewPatientPlan(PATIENT, admin, { now: new Date('2026-11-25T15:00:00.000Z') });
    expect(r.kind).toBe('early');
    expect(mocks.createEarlyRenewal).toHaveBeenCalledWith(active, expect.objectContaining({ paymentMode: 'prepaid', scholarship: false }));
    expect(active.save).not.toHaveBeenCalled();
  });

  it('plan vencido → plan nuevo desde hoy con las mismas condiciones', async () => {
    mocks.plans = [plan({ status: 'expired', term: 'trimestral', sessionsTotal: 8, endDate: D('2026-10-31T02:59:59.999Z') })];
    await renewPatientPlan(PATIENT, admin, { now: NOW });
    expect(mocks.createTermPlans).toHaveBeenCalledWith(expect.objectContaining({ patientId: PATIENT, serviceType: 'entrenamiento', sessionsTotal: 8, term: 'trimestral', startDate: NOW, renews: true }));
  });

  it('kinesiología terminada → paquete igual, sin renovación automática, y el anterior se cierra', async () => {
    const done = plan({ serviceType: 'kinesiologia', openEnded: true, sessionsTotal: 10, sessionsUsed: 10, endDate: D('2099-12-31T23:59:59.000Z') });
    mocks.plans = [done];
    await renewPatientPlan(PATIENT, admin, { now: NOW });
    expect(done.status).toBe('expired');
    expect(mocks.createTermPlans).toHaveBeenCalledWith(expect.objectContaining({ serviceType: 'kinesiologia', sessionsTotal: 10, term: 'mensual', renews: false }));
  });

  it('hereda el pago mes a mes y la beca del ciclo del que nació la renovación pendiente', async () => {
    const original = plan({ scholarship: true, paymentMode: 'monthly', status: 'expired' });
    const pending = plan({ paymentPending: true, renewedFrom: original._id, scholarship: false, paymentMode: 'prepaid' });
    mocks.plans = [pending, original];
    await renewPatientPlan(PATIENT, admin, { now: NOW });
    expect(mocks.settlePendingPlan).toHaveBeenCalledWith(pending, expect.objectContaining({ scholarship: true, paymentMode: 'monthly' }));
  });

  it('un profesional no puede renovar un plan anual, con beca ni con pago mes a mes (como al registrar un pago a mano)', async () => {
    mocks.plans = [plan({ term: 'anual', cyclesTotal: 12, paymentPending: true })];
    await expect(renewPatientPlan(PATIENT, pro, { now: NOW })).rejects.toMatchObject({ status: 403, code: 'ADMIN_ONLY' });
    mocks.plans = [plan({ scholarship: true })];
    await expect(renewPatientPlan(PATIENT, pro, { now: new Date('2026-11-25T15:00:00.000Z') })).rejects.toMatchObject({ status: 403 });
    expect(mocks.settlePendingPlan).not.toHaveBeenCalled();
    expect(mocks.createEarlyRenewal).not.toHaveBeenCalled();
    // el administrador sí puede
    mocks.plans = [plan({ scholarship: true })];
    await expect(renewPatientPlan(PATIENT, admin, { now: new Date('2026-11-25T15:00:00.000Z') })).resolves.toMatchObject({ kind: 'early' });
  });

  it('si no hay nada que renovar responde 409 con el motivo y no cambia nada', async () => {
    mocks.plans = [plan(), plan({ status: 'upcoming', endDate: D('2027-01-01T02:59:59.999Z') })];
    await expect(renewPatientPlan(PATIENT, admin, { now: NOW })).rejects.toMatchObject({ status: 409, code: 'PAID_AHEAD' });
    expect(mocks.createEarlyRenewal).not.toHaveBeenCalled();
    expect(mocks.syncSlot).not.toHaveBeenCalled();
  });

  it('un error en un horario fijo no deshace la renovación', async () => {
    mocks.plans = [plan({ paymentPending: true })];
    mocks.syncSlot.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await renewPatientPlan(PATIENT, admin, { now: NOW });
    expect(r.kind).toBe('settle_pending');
    expect(r.fixed.slots).toBe(2);
  });
});
