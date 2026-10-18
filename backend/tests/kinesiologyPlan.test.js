/**
 * PRUEBAS — plan de kinesiología «hasta completar las sesiones» (sin ciclos, sin fecha de término, sin renovación automática).
 * Sin base real: se reemplazan el servicio de planes y el ciclo de vida para probar las decisiones del controlador y de createTermPlans.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const mocks = vi.hoisted(() => ({ getActivePlan: vi.fn(), createTermPlans: vi.fn(), cancel: vi.fn(), settle: vi.fn() }));

vi.mock('../services/clientPlanService.js', async (orig) => ({ ...(await orig()), getActivePlan: mocks.getActivePlan }));
vi.mock('../services/planLifecycleService.js', async (orig) => ({
  ...(await orig()),
  createTermPlans: mocks.createTermPlans,
  cancelPlanAndFutureCycles: mocks.cancel,
  settlePendingPlan: mocks.settle
}));

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import { createClientPlan } from '../controllers/clientPlanController.js';
import { OPEN_END_DATE } from '../services/planCycles.js';

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const created = { populate: vi.fn(async () => {}) };
const body = (over = {}) => ({ patientId: String(id()), serviceType: 'kinesiologia', sessionsTotal: 10, ...over });
const req = (b) => ({ user: { _id: id(), role: 'professional' }, body: b });
const activo = (over = {}) => ({ openEnded: false, paymentPending: false, serviceType: 'entrenamiento', sessionsAvailable: () => 3, populate: vi.fn(async () => {}), save: vi.fn(async () => {}), status: 'active', ...over });

describe('plan de kinesiología por sesiones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: id(), role: 'patient' });
    mocks.getActivePlan.mockResolvedValue(null);
    mocks.createTermPlans.mockResolvedValue(created);
  });

  it('el modelo marca el fin con una fecha fija lejana y la guarda para consultas por fecha', () => {
    expect(OPEN_END_DATE.getUTCFullYear()).toBe(2099);
    expect(ClientPlan.schema.path('openEnded')).toBeTruthy();
  });

  it('registrar kinesiología crea UN plan, sin pedir duración ni ciclo (aunque el formulario viejo los mande)', async () => {
    const res = fakeRes();
    await createClientPlan(req(body({ term: 'anual', billingCycle: 'rolling', renews: true })), res);
    expect(res.statusCode).toBe(201);
    expect(mocks.createTermPlans).toHaveBeenCalledTimes(1);
    expect(mocks.createTermPlans.mock.calls[0][0]).toMatchObject({ serviceType: 'kinesiologia', sessionsTotal: 10 });
  });

  it('un plan «hasta completar» sin sesiones restantes se cierra y el nuevo entra sin pedir confirmación', async () => {
    const viejo = activo({ openEnded: true, serviceType: 'kinesiologia', sessionsAvailable: () => 0 });
    mocks.getActivePlan.mockResolvedValue(viejo);
    const res = fakeRes();
    await createClientPlan(req(body()), res);
    expect(res.statusCode).toBe(201);
    expect(viejo.status).toBe('expired');
    expect(viejo.save).toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it('si todavía le quedan sesiones, NO se reemplaza sin confirmación (no se pierden sesiones por error)', async () => {
    mocks.getActivePlan.mockResolvedValue(activo({ openEnded: true, serviceType: 'kinesiologia', sessionsAvailable: () => 4 }));
    const res = fakeRes();
    await createClientPlan(req(body()), res);
    expect(res.statusCode).toBe(409);
    expect(mocks.createTermPlans).not.toHaveBeenCalled();
  });

  it('un plan normal vigente sigue pidiendo confirmación para reemplazarlo, y con ella lo cancela', async () => {
    mocks.getActivePlan.mockResolvedValue(activo());
    const sin = fakeRes();
    await createClientPlan(req(body({ serviceType: 'entrenamiento', sessionsTotal: 8 })), sin);
    expect(sin.statusCode).toBe(409);
    const con = fakeRes();
    await createClientPlan(req(body({ serviceType: 'entrenamiento', sessionsTotal: 8, replaceExisting: true })), con);
    expect(con.statusCode).toBe(201);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('«Mi plan» del paciente con un plan hasta completar las sesiones', () => {
  it('no muestra fecha de término ni días restantes (solo «hasta completar»)', async () => {
    const { computePlanView } = await import('../../src/components/dashboard/planView.ts');
    const now = new Date(2026, 9, 18, 12);
    const balance = { hasActivePlan: true, totalAvailable: 4, extraSessionsAvailable: 0, plan: { serviceType: 'kinesiologia', sessionsTotal: 5, sessionsUsed: 1, unlimited: false, openEnded: true, endDate: '2099-12-31T23:59:59.000Z', cycleNumber: 1, cyclesTotal: 1 } };
    const view = computePlanView({ balance, history: { kind: 'none' }, now });
    expect(view.kind).toBe('active');
    expect(view.openEnded).toBe(true);
    expect(view.validUntil).toBeUndefined();
    expect(view.daysLeftText).toBeUndefined();
    expect(view.available).toBe(4);
    expect(view.ratio).toBeCloseTo(0.2);
  });

  it('un plan normal conserva su fecha y días restantes', async () => {
    const { computePlanView } = await import('../../src/components/dashboard/planView.ts');
    const now = new Date(2026, 9, 18, 12);
    const balance = { hasActivePlan: true, totalAvailable: 4, extraSessionsAvailable: 0, plan: { serviceType: 'entrenamiento', sessionsTotal: 8, sessionsUsed: 4, unlimited: false, endDate: '2026-10-31T23:59:59.000Z', cycleNumber: 1, cyclesTotal: 1 } };
    const view = computePlanView({ balance, history: { kind: 'none' }, now });
    expect(view.openEnded).toBe(false);
    expect(view.validUntil).toBe('31/10/2026');
    expect(view.daysLeftText).toMatch(/días restantes/);
  });
});
