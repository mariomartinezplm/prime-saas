/**
 * PRUEBAS — Valor ESTIMADO de planes (no dinero cobrado): tarifas, descuentos, contratos, períodos, proyección, alcance y permisos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { PRICES, TERM_DISCOUNTS, priceOf, contractValue } from '../config/pricing.js';
import { toContracts, summarizeMonth, buildFinance, variation, shiftMonth, monthKey, projectNextMonth } from '../services/financeService.js';
import { santiagoToUtc } from '../utils/timezone.js';
import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import { getFinanceSummary } from '../controllers/financeController.js';
import financeRoutes from '../routes/financeRoutes.js';
import { authorize } from '../middleware/auth.js';

const id = () => new mongoose.Types.ObjectId();
const plan = (over = {}) => ({ _id: id(), patient: id(), serviceType: 'entrenamiento', sessionsTotal: 8, unlimited: false, status: 'active', term: 'mensual', cyclesTotal: 1, cycleNumber: 1, termId: null, renews: true, startDate: santiagoToUtc(2026, 10, 1), endDate: santiagoToUtc(2026, 10, 31, 23), paymentPending: false, ...over });

describe('tarifas confirmadas', () => {
  it('kinesiología: 1 = $25.000, 5 = $100.000, 10 = $200.000; entrenamiento mensual: 8 (2/sem) = $90.000, 12 (3/sem) = $130.000', () => {
    expect([1, 5, 10].map((n) => priceOf(plan({ serviceType: 'kinesiologia', sessionsTotal: n })))).toEqual([25000, 100000, 200000]);
    expect([8, 12].map((n) => priceOf(plan({ sessionsTotal: n })))).toEqual([90000, 130000]);
  });
  it('un plan SIN tarifa definida da null (no se inventa un precio)', () => {
    for (const p of [plan({ sessionsTotal: 4 }), plan({ sessionsTotal: 16 }), plan({ unlimited: true, sessionsTotal: 0 }), plan({ serviceType: 'kinesiologia', sessionsTotal: 12 }), plan({ serviceType: 'kinesiologia', sessionsTotal: 20 })]) expect(priceOf(p)).toBeNull();
    expect(Object.keys(PRICES)).toEqual(['kinesiologia', 'entrenamiento']);
  });
});

describe('descuentos por plazo (solo entrenamiento) y valor del contrato', () => {
  it('trimestral 10 %, anual 20 %, semestral 15 % (definido), mensual sin descuento', () => {
    expect(TERM_DISCOUNTS).toEqual({ mensual: 0, trimestral: 0.1, semestral: 0.15, anual: 0.2 });
    expect(contractValue(plan({ term: 'mensual', cyclesTotal: 1 }))).toBe(90000);
    expect(contractValue(plan({ term: 'trimestral', cyclesTotal: 3 }))).toBe(243000); // 90.000 × 3 × 0,90
    expect(contractValue(plan({ sessionsTotal: 12, term: 'anual', cyclesTotal: 12 }))).toBe(1248000); // 130.000 × 12 × 0,80
    expect(contractValue(plan({ term: 'semestral', cyclesTotal: 6 }))).toBe(459000); // 90.000 × 6 × 0,85
  });
  it('kinesiología no tiene descuento por plazo: si no es mensual NO se inventa un valor', () => {
    expect(contractValue(plan({ serviceType: 'kinesiologia', sessionsTotal: 10 }))).toBe(200000);
    expect(contractValue(plan({ serviceType: 'kinesiologia', sessionsTotal: 10, term: 'trimestral', cyclesTotal: 3 }))).toBeNull();
  });
  it('un plazo desconocido o un plan sin tarifa no da valor', () => {
    expect(contractValue(plan({ term: 'quincenal' }))).toBeNull();
    expect(contractValue(plan({ sessionsTotal: 16 }))).toBeNull();
  });
});

describe('un contrato se cuenta UNA vez (no se inventan cobros mensuales)', () => {
  const termId = id();
  const patient = id();
  const cycles = [1, 2, 3].map((n) => plan({ patient, termId, term: 'trimestral', cyclesTotal: 3, cycleNumber: n, status: n === 1 ? 'active' : 'upcoming', startDate: santiagoToUtc(2026, 9 + n, 1) }));

  it('un trimestral de 3 ciclos es UN contrato en el mes en que empieza, con el valor completo con descuento', () => {
    const contracts = toContracts(cycles);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({ month: '2026-10', value: 243000, cycles: 3, discount: 0.1 });
    expect(summarizeMonth(contracts, '2026-10')).toMatchObject({ estimated: 243000, contracts: 1 });
    expect(summarizeMonth(contracts, '2026-11').estimated).toBe(0); // los meses siguientes NO reciben «cobros» inventados
    expect(summarizeMonth(contracts, '2026-12').estimated).toBe(0);
  });
  it('un anual de 12 ciclos no se convierte en doce cobros', () => {
    const t = id();
    const anual = Array.from({ length: 12 }, (_, i) => plan({ patient, termId: t, sessionsTotal: 12, term: 'anual', cyclesTotal: 12, cycleNumber: i + 1, startDate: santiagoToUtc(2026, 1 + (i % 12), 1) }));
    const contracts = toContracts(anual);
    expect(contracts).toHaveLength(1);
    const meses = Array.from({ length: 12 }, (_, i) => summarizeMonth(contracts, `2026-${String(i + 1).padStart(2, '0')}`).estimated);
    expect(meses.filter((v) => v > 0)).toEqual([1248000]);
  });
  it('un ciclo con el pago pendiente deja el contrato como «pendiente»', () => {
    const pend = [plan({ paymentPending: true }), plan()];
    const s = summarizeMonth(toContracts(pend), '2026-10');
    expect(s).toMatchObject({ estimated: 180000, paidCount: 1, pendingCount: 1, paidValue: 90000, pendingValue: 90000 });
  });
});

describe('resumen del mes', () => {
  it('suma el valor estimado, separa pago registrado y pendiente, y cuenta lo que no tiene tarifa', () => {
    const plans = [
      plan({ sessionsTotal: 8 }),
      plan({ sessionsTotal: 12 }),
      plan({ serviceType: 'kinesiologia', sessionsTotal: 10 }),
      plan({ sessionsTotal: 8, paymentPending: true }),
      plan({ unlimited: true, sessionsTotal: 0 }),
      plan({ sessionsTotal: 8, status: 'cancelled' }),
      plan({ sessionsTotal: 8, startDate: santiagoToUtc(2026, 9, 1) })
    ];
    const s = summarizeMonth(toContracts(plans), '2026-10');
    expect(s).toMatchObject({ estimated: 510000, paidValue: 420000, pendingValue: 90000, paidCount: 4, pendingCount: 1, untariffed: 1 });
    expect(s.byService).toEqual({ entrenamiento: 310000, kinesiologia: 200000 });
  });
  it('un mes sin planes da cero, sin inventar nada', () => {
    expect(summarizeMonth([], '2026-10')).toMatchObject({ estimated: 0, contracts: 0, byPlan: [] });
  });
  it('el mes es el día de Chile en que EMPIEZA el contrato (no el UTC)', () => {
    expect(monthKey(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10');
    expect(monthKey(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('variación, serie y proyección', () => {
  it('sin mes anterior con valor NO se inventa un porcentaje', () => {
    expect(variation(100000, 0)).toBeNull();
    expect(variation(110000, 100000)).toEqual({ amount: 10000, percent: 10 });
  });
  it('la serie entrega 6 meses y NO existe ninguna serie por semana ni por día (no hay fecha de pago)', () => {
    const now = santiagoToUtc(2026, 10, 20, 12);
    const f = buildFinance({ plans: [plan()], patients: [], month: '2026-10', now });
    expect(f.series.map((s) => s.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(Object.keys(f)).not.toContain('weekly');
    expect(f.basis).toMatchObject({ kind: 'estimate', tracksPayments: false });
  });
  it('la proyección solo cuenta planes vigentes que terminan este mes y NO suma lo ya renovado; es null en meses pasados', () => {
    const p1 = plan({ endDate: santiagoToUtc(2026, 10, 31, 23) });
    const renovado = plan({ patient: p1.patient, startDate: santiagoToUtc(2026, 11, 1), status: 'upcoming' });
    const sinTarifa = plan({ sessionsTotal: 16 });
    const pr = projectNextMonth([p1, sinTarifa], '2026-10');
    expect(pr).toEqual({ month: '2026-11', value: 90000, count: 1 });
    expect(projectNextMonth([p1, renovado], '2026-10').count).toBe(0);
    const now = santiagoToUtc(2026, 10, 20, 12);
    expect(buildFinance({ plans: [p1], patients: [], month: '2026-10', now }).projection).not.toBeNull();
    expect(buildFinance({ plans: [p1], patients: [], month: '2026-09', now }).projection).toBeNull();
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
    expect(String(users.mock.calls[0][0].assignedProfessionalId)).toBe(String(pro._id));
    expect(r.body.data.scope).toBe('own');
    expect(r.body.data.professionals).toEqual([]);
  });
  it('el ADMIN ve todo el centro o un profesional concreto', async () => {
    const { users } = mock();
    const admin = { _id: id(), role: 'admin' };
    const r1 = res();
    await getFinanceSummary({ user: admin, query: { month: '2026-10' } }, r1);
    expect(users.mock.calls[0][0].assignedProfessionalId).toBeUndefined();
    expect(r1.body.data.scope).toBe('center');
    const target = String(id());
    await getFinanceSummary({ user: admin, query: { month: '2026-10', professional: target } }, res());
    expect(String(users.mock.calls[2][0].assignedProfessionalId)).toBe(target);
  });
  it('un mes inválido da 400', async () => {
    mock();
    for (const month of ['2026-13', 'octubre', '2010-01', '2099-01']) {
      const r = res();
      await getFinanceSummary({ user: { _id: id(), role: 'admin' }, query: { month } }, r);
      expect(r.statusCode).toBe(400);
    }
  });
  it('un PACIENTE es rechazado por el servidor (403), no solo ocultado en el menú', () => {
    const guard = authorize('admin', 'professional');
    for (const [role, ok] of [['patient', false], ['professional', true], ['admin', true]]) {
      const r = res();
      const next = vi.fn();
      guard({ user: { role } }, r, next);
      expect(next).toHaveBeenCalledTimes(ok ? 1 : 0);
      if (!ok) expect(r.statusCode).toBe(403);
    }
    expect(financeRoutes.stack.filter((l) => !l.route).length).toBeGreaterThanOrEqual(2); // protect + authorize en todo el router
  });
});
