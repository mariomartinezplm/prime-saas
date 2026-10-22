/**
 * PRUEBAS — Panel de ingresos del profesional: tarifas, ciclos pagados/pendientes, alcance por profesional y permisos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { PRICES, priceOf } from '../config/pricing.js';
import { summarizeMonth, buildFinance, variation, shiftMonth, monthKey } from '../services/financeService.js';
import { santiagoToUtc } from '../utils/timezone.js';
import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import { getFinanceSummary } from '../controllers/financeController.js';
import financeRoutes from '../routes/financeRoutes.js';

const id = () => new mongoose.Types.ObjectId();
const plan = (over = {}) => ({ patient: id(), serviceType: 'entrenamiento', sessionsTotal: 8, unlimited: false, status: 'active', startDate: santiagoToUtc(2026, 10, 1), endDate: santiagoToUtc(2026, 10, 31, 23), paymentPending: false, ...over });

describe('tarifas', () => {
  it('kinesiología: 1 = $25.000, 5 = $100.000, 10 = $200.000; entrenamiento: 8 = $90.000, 12 = $130.000', () => {
    expect(priceOf(plan({ serviceType: 'kinesiologia', sessionsTotal: 1 }))).toBe(25000);
    expect(priceOf(plan({ serviceType: 'kinesiologia', sessionsTotal: 5 }))).toBe(100000);
    expect(priceOf(plan({ serviceType: 'kinesiologia', sessionsTotal: 10 }))).toBe(200000);
    expect(priceOf(plan({ sessionsTotal: 8 }))).toBe(90000);
    expect(priceOf(plan({ sessionsTotal: 12 }))).toBe(130000);
  });
  it('un plan SIN tarifa definida da null (no se inventa un precio)', () => {
    for (const p of [plan({ sessionsTotal: 4 }), plan({ sessionsTotal: 16 }), plan({ unlimited: true, sessionsTotal: 0 }), plan({ serviceType: 'kinesiologia', sessionsTotal: 12 }), plan({ serviceType: 'kinesiologia', sessionsTotal: 20 })]) {
      expect(priceOf(p)).toBeNull();
    }
    expect(Object.keys(PRICES)).toEqual(['kinesiologia', 'entrenamiento']);
  });
});

describe('resumen del mes', () => {
  it('suma lo cobrado, separa lo pendiente y cuenta lo que no tiene tarifa', () => {
    const plans = [
      plan({ sessionsTotal: 8 }), // 90.000 cobrado
      plan({ sessionsTotal: 12 }), // 130.000 cobrado
      plan({ serviceType: 'kinesiologia', sessionsTotal: 10 }), // 200.000 cobrado
      plan({ sessionsTotal: 8, paymentPending: true }), // 90.000 pendiente
      plan({ unlimited: true, sessionsTotal: 0 }), // sin tarifa
      plan({ sessionsTotal: 8, status: 'cancelled' }), // cancelado: no cuenta
      plan({ sessionsTotal: 8, startDate: santiagoToUtc(2026, 9, 1) }) // otro mes
    ];
    const s = summarizeMonth(plans, '2026-10');
    expect(s).toMatchObject({ collected: 420000, pending: 90000, projected: 510000, paidCount: 4, pendingCount: 1, untariffed: 1 });
    expect(s.byService).toEqual({ entrenamiento: 220000, kinesiologia: 200000 });
    expect(s.byPlan.find((r) => r.serviceType === 'entrenamiento' && r.sessions === 8)).toMatchObject({ count: 2, collected: 90000, pending: 90000 });
  });
  it('un mes sin planes da cero, sin inventar nada', () => {
    expect(summarizeMonth([], '2026-10')).toMatchObject({ collected: 0, projected: 0, paidCount: 0, byPlan: [] });
  });
  it('el mes de un ciclo es el día de Chile en que EMPIEZA (no el UTC)', () => {
    expect(monthKey(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10'); // 22:00 del 31 de octubre en Chile
    expect(monthKey(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('variación y serie', () => {
  it('sin mes anterior con datos NO se inventa un porcentaje', () => {
    expect(variation(100000, 0)).toBeNull();
    expect(variation(110000, 100000)).toEqual({ amount: 10000, percent: 10 });
    expect(variation(90000, 100000)).toEqual({ amount: -10000, percent: -10 });
  });
  it('el gráfico entrega 6 meses y los pacientes activos son los de hoy', () => {
    const now = santiagoToUtc(2026, 10, 20, 12);
    const a = id();
    const plans = [plan({ patient: a }), plan({ patient: a, startDate: santiagoToUtc(2026, 9, 1), status: 'expired', endDate: santiagoToUtc(2026, 9, 30) }), plan({ sessionsTotal: 12, startDate: santiagoToUtc(2026, 9, 1), status: 'expired', endDate: santiagoToUtc(2026, 9, 30) })];
    const f = buildFinance({ plans, patients: [{ _id: a, firstName: 'Ana', lastName: 'Prueba' }], month: '2026-10', now });
    expect(f.series.map((s) => s.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(f.series.at(-1).collected).toBe(90000);
    expect(f.series.at(-2).collected).toBe(220000);
    expect(f.activePatients).toBe(1);
    expect(f.variation.percent).toBe(-59.1);
    expect(f.plans[0]).toMatchObject({ patient: 'Ana Prueba', paid: true, price: 90000 });
  });
});

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const lean = (v) => ({ select: () => lean(v), lean: () => Promise.resolve(v), then: (f) => Promise.resolve(v).then(f) });

describe('alcance y permisos', () => {
  beforeEach(() => vi.restoreAllMocks());
  const mock = () => {
    const users = vi.spyOn(User, 'find').mockImplementation((f) => lean(f.role === 'patient' ? [{ _id: id(), firstName: 'A', lastName: 'B' }] : [{ _id: id(), firstName: 'Pro', lastName: 'Uno' }]));
    const plans = vi.spyOn(ClientPlan, 'find').mockReturnValue(lean([]));
    return { users, plans };
  };

  it('un PROFESIONAL solo ve a sus pacientes asignados, aunque pida a otro', async () => {
    const { users } = mock();
    const pro = { _id: id(), role: 'professional' };
    const r = res();
    await getFinanceSummary({ user: pro, query: { month: '2026-10', professional: String(id()) } }, r);
    expect(r.statusCode).toBe(200);
    expect(String(users.mock.calls[0][0].assignedProfessionalId)).toBe(String(pro._id));
    expect(r.body.data.scope).toBe('own');
    expect(r.body.data.professionals).toEqual([]); // no ve la lista de otros profesionales
  });
  it('el ADMIN ve todo el centro o un profesional concreto si lo pide', async () => {
    const { users } = mock();
    const admin = { _id: id(), role: 'admin' };
    const r1 = res();
    await getFinanceSummary({ user: admin, query: { month: '2026-10' } }, r1);
    expect(users.mock.calls[0][0].assignedProfessionalId).toBeUndefined();
    expect(r1.body.data.scope).toBe('center');
    const target = String(id());
    const r2 = res();
    await getFinanceSummary({ user: admin, query: { month: '2026-10', professional: target } }, r2);
    expect(String(users.mock.calls[2][0].assignedProfessionalId)).toBe(target);
    expect(r2.body.data.scope).toBe('professional');
  });
  it('un mes inválido da 400', async () => {
    mock();
    for (const month of ['2026-13', 'octubre', '2010-01', '2099-01']) {
      const r = res();
      await getFinanceSummary({ user: { _id: id(), role: 'admin' }, query: { month } }, r);
      expect(r.statusCode).toBe(400);
    }
  });
  it('la ruta exige sesión y rol profesional o admin: los pacientes no llegan', () => {
    const guards = financeRoutes.stack.filter((l) => !l.route);
    expect(guards.length).toBeGreaterThanOrEqual(2);
    expect(financeRoutes.stack.find((l) => l.route?.path === '/summary')).toBeTruthy();
  });
});
