/**
 * PRUEBAS — ciclo de vida de los planes (mes calendario, plazo de pago del 5,
 * renovación pendiente, trimestral/anual, avisos de vencimiento).
 *
 * Sin base real: ClientPlan se reemplaza por una base mínima en memoria que
 * entiende solo los filtros que usa el servicio, para probar cambios de estado
 * de verdad (y no solo "que se llamó a tal función").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { santiagoToUtc, santiagoParts } from '../utils/timezone.js';
import { cycleBounds } from '../services/planCycles.js';

// ─── Base falsa en memoria ──────────────────────────────────────────────────
const store = vi.hoisted(() => ({ docs: [] }));

vi.mock('../models/ClientPlan.js', async () => {
  const { default: mongooseLib } = await import('mongoose');
  const { cycleBounds: bounds } = await import('../services/planCycles.js');

  const asTime = (v) => (v instanceof Date ? v.getTime() : v);

  const matches = (doc, filter) => Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return cond.some((f) => matches(doc, f));
    if (key === '$expr') return doc[cond.$gte[0].slice(1)] >= doc[cond.$gte[1].slice(1)];
    const value = doc[key];
    const isOperator = cond !== null && typeof cond === 'object'
      && !(cond instanceof Date) && !(cond instanceof mongooseLib.Types.ObjectId);
    if (isOperator) {
      return Object.entries(cond).every(([op, expected]) => {
        const a = asTime(value);
        const b = asTime(expected);
        if (op === '$lt') return a != null && a < b;
        if (op === '$lte') return a != null && a <= b;
        if (op === '$gte') return a != null && a >= b;
        if (op === '$in') return expected.map(String).includes(String(value));
        throw new Error(`operador no soportado en la base falsa: ${op}`);
      });
    }
    if (cond === null) return value == null;
    return String(value) === String(cond);
  });

  const applySet = (doc, update) => Object.assign(doc, update.$set || {});

  const withPopulate = (docs) => Object.assign(Promise.resolve(docs), {
    populate: async () => docs.map((original) => {
      const clone = { ...original, patient: { _id: original.patient, firstName: 'Ana', lastName: 'Pérez' } };
      clone.save = async () => {
        const { patient, save, ...rest } = clone; // eslint-disable-line no-unused-vars
        Object.assign(original, rest);
      };
      return clone;
    })
  });

  const ClientPlan = {
    async create(data) {
      if (data.renewedFrom && store.docs.some((d) => String(d.renewedFrom) === String(data.renewedFrom))) {
        throw Object.assign(new Error('duplicate key'), { code: 11000 });
      }
      const doc = {
        _id: new mongooseLib.Types.ObjectId(),
        status: 'active', term: 'mensual', billingCycle: 'calendar', cycleNumber: 1, cyclesTotal: 1,
        termId: null, renews: true, paymentPending: false, sessionsUsed: 0, unlimited: false,
        ...data
      };
      doc.endDate = bounds(doc.startDate, doc.billingCycle, 0).end;
      doc.save = async () => {};
      store.docs.push(doc);
      return doc;
    },
    async exists(filter) {
      const doc = store.docs.find((d) => matches(d, filter));
      return doc ? { _id: doc._id } : null;
    },
    async distinct(field, filter) {
      return [...new Set(store.docs.filter((d) => matches(d, filter)).map((d) => d[field]))];
    },
    find: (filter) => withPopulate(store.docs.filter((d) => matches(d, filter))),
    findOne: async (filter) => store.docs.find((d) => matches(d, filter)) || null,
    async findOneAndUpdate(filter, update) {
      const doc = store.docs.find((d) => matches(d, filter));
      if (!doc) return null;
      const before = { ...doc };
      applySet(doc, update);
      return before;
    },
    async updateOne(filter, update) {
      const doc = store.docs.find((d) => matches(d, filter));
      if (doc) applySet(doc, update);
      return { modifiedCount: doc ? 1 : 0 };
    },
    async updateMany(filter, update) {
      const found = store.docs.filter((d) => matches(d, filter));
      found.forEach((d) => applySet(d, update));
      return { modifiedCount: found.length };
    }
  };
  return { default: ClientPlan };
});

vi.mock('../models/User.js', () => ({
  default: {
    find: vi.fn(() => ({ select: async () => [{ _id: 'admin-1' }] })),
    updateOne: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({}))
  }
}));
vi.mock('../services/notificationService.js', () => ({ notify: vi.fn(async () => ({})) }));

import { notify } from '../services/notificationService.js';
import User from '../models/User.js';
import {
  createTermPlans,
  settlePendingPlan,
  cancelPlanAndFutureCycles,
  advancePlans,
  runPlanLifecycleJob
} from '../services/planLifecycleService.js';

// ─── Ayudas ─────────────────────────────────────────────────────────────────
const patientId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();
const at = (y, m, d, hh = 0, mm = 0, ss = 0) => santiagoToUtc(y, m, d, hh, mm, ss);
const wall = (date) => {
  const p = santiagoParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
};

const buy = (overrides = {}) => createTermPlans({
  patientId,
  serviceType: 'entrenamiento',
  sessionsTotal: 8,
  registeredBy: adminId,
  startDate: at(2026, 10, 20, 15),
  ...overrides
});

const byStatus = (status) => store.docs.filter((d) => d.status === status);

beforeEach(() => {
  store.docs.length = 0;
  vi.mocked(notify).mockClear();
  vi.mocked(User.updateOne).mockClear();
  vi.mocked(User.updateMany).mockClear();
});

describe('registrar un plan', () => {
  it('mensual: un ciclo activo que termina el último día del mes', async () => {
    const plan = await buy();
    expect(store.docs).toHaveLength(1);
    expect(plan.status).toBe('active');
    expect(wall(plan.endDate)).toBe('2026-10-31 23:59:59');
  });

  it('anual: 12 ciclos, el primero activo y los otros 11 pagados por adelantado', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    expect(store.docs).toHaveLength(12);
    expect(byStatus('active')).toHaveLength(1);
    expect(byStatus('upcoming')).toHaveLength(11);
    expect(new Set(store.docs.map((d) => String(d.termId))).size).toBe(1);
    expect(store.docs.map((d) => d.cycleNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(store.docs.every((d) => d.sessionsTotal === 8 && d.cyclesTotal === 12)).toBe(true);
  });

  it('fecha a fecha (los que pagan el 10): del 10 de octubre al 9 de noviembre', async () => {
    const plan = await buy({ billingCycle: 'rolling', startDate: at(2026, 10, 10, 11) });
    expect(wall(plan.endDate)).toBe('2026-11-09 23:59:59');
  });
});

describe('pasar de un mes al siguiente', () => {
  it('mensual sin renovar: el 1 de noviembre se abre una renovación pendiente de pago', async () => {
    const old = await buy();
    old.sessionsUsed = 3;

    await advancePlans({ patientId, now: at(2026, 11, 1, 0, 0, 5) });

    expect(old.status).toBe('expired');
    expect(old.expiredNotifiedAt).toBeDefined(); // en silencio: avisa la renovación pendiente, no un "venció"

    const pending = byStatus('active')[0];
    expect(pending.paymentPending).toBe(true);
    expect(pending.sessionsUsed).toBe(0);
    expect(pending.sessionsTotal).toBe(8);
    expect(wall(pending.startDate)).toBe('2026-11-01 00:00:00');
    expect(wall(pending.endDate)).toBe('2026-11-30 23:59:59');
    expect(wall(pending.paymentDueBy)).toBe('2026-11-06 00:00:00'); // se puede pagar hasta el 5 inclusive
    expect(String(pending.renewedFrom)).toBe(String(old._id));
  });

  it('correrlo dos veces no abre dos renovaciones', async () => {
    await buy();
    await advancePlans({ patientId, now: at(2026, 11, 1, 0, 0, 5) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 3) });
    expect(store.docs.filter((d) => d.paymentPending)).toHaveLength(1);
  });

  it('el 31 de octubre a las 23:59 el plan sigue activo (nada se corta antes de tiempo)', async () => {
    const plan = await buy();
    await advancePlans({ patientId, now: at(2026, 10, 31, 23, 59, 30) });
    expect(plan.status).toBe('active');
    expect(store.docs).toHaveLength(1);
  });

  it('renovación pendiente sin pago: sigue activa hasta el 5 y vence el 6', async () => {
    await buy();
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    const pending = byStatus('active')[0];

    await advancePlans({ patientId, now: at(2026, 11, 5, 23, 59, 0) });
    expect(pending.status).toBe('active');

    await advancePlans({ patientId, now: at(2026, 11, 6, 0, 0, 1) });
    expect(pending.status).toBe('expired');
    expect(pending.expiredNotifiedAt).toBeUndefined(); // este sí se avisa como vencido
  });

  it('plan que no se renueva (renews: false): vence y no abre nada', async () => {
    const plan = await buy({ renews: false });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    expect(plan.status).toBe('expired');
    expect(plan.expiredNotifiedAt).toBeUndefined();
    expect(store.docs).toHaveLength(1);
  });

  it('si ya pasó todo el plazo de pago del mes siguiente, no abre una renovación', async () => {
    const plan = await buy();
    await advancePlans({ patientId, now: at(2026, 11, 20) });
    expect(plan.status).toBe('expired');
    expect(store.docs).toHaveLength(1);
  });

  it('fecha a fecha: renovación pendiente desde el 10 de noviembre, plazo hasta el 14', async () => {
    await buy({ billingCycle: 'rolling', startDate: at(2026, 10, 10, 11) });
    await advancePlans({ patientId, now: at(2026, 11, 10, 0, 0, 5) });
    const pending = byStatus('active')[0];
    expect(wall(pending.startDate)).toBe('2026-11-10 00:00:00');
    expect(wall(new Date(pending.paymentDueBy.getTime() - 1))).toBe('2026-11-14 23:59:59');
  });
});

describe('planes trimestral y anual: las sesiones parten de cero cada mes', () => {
  it('trimestral: el 1 de noviembre arranca el ciclo 2 sin renovación pendiente', async () => {
    await buy({ term: 'trimestral', startDate: at(2026, 10, 1) });
    store.docs[0].sessionsUsed = 8;

    await advancePlans({ patientId, now: at(2026, 11, 1, 0, 0, 5) });

    expect(store.docs[0].status).toBe('expired');
    expect(store.docs[1].status).toBe('active');
    expect(store.docs[1].sessionsUsed).toBe(0);
    expect(store.docs.some((d) => d.paymentPending)).toBe(false);
  });

  it('trimestral: al terminar el tercer mes se abre la renovación pendiente', async () => {
    await buy({ term: 'trimestral', startDate: at(2026, 10, 1) });
    await advancePlans({ patientId, now: at(2027, 1, 1, 0, 0, 5) });
    const pending = store.docs.find((d) => d.paymentPending);
    expect(pending).toBeDefined();
    expect(wall(pending.startDate)).toBe('2027-01-01 00:00:00');
    expect(pending.term).toBe('trimestral');
  });

  it('si el servidor estuvo apagado semanas, se pone al día sin saltarse ciclos', async () => {
    await buy({ term: 'trimestral', startDate: at(2026, 10, 1) });
    await advancePlans({ patientId, now: at(2026, 12, 15) });
    expect(store.docs.map((d) => d.status)).toEqual(['expired', 'expired', 'active']);
  });
});

describe('el admin registra el pago', () => {
  it('de una renovación pendiente: queda pagada y CONSERVA las sesiones ya usadas', async () => {
    await buy();
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    const pending = byStatus('active')[0];
    pending.sessionsUsed = 2; // agendó 2 sesiones durante el plazo

    await settlePendingPlan(pending, { sessionsTotal: 8, term: 'mensual', registeredBy: adminId });

    expect(pending.paymentPending).toBe(false);
    expect(pending.paymentDueBy).toBeUndefined();
    expect(pending.sessionsUsed).toBe(2);
    expect(store.docs.filter((d) => d.status === 'upcoming')).toHaveLength(0);
  });

  it('pagando un plan anual en la renovación pendiente se crean los 11 ciclos que faltan', async () => {
    await buy();
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    const pending = byStatus('active')[0];

    await settlePendingPlan(pending, { sessionsTotal: 8, term: 'anual', registeredBy: adminId });

    const upcoming = byStatus('upcoming');
    expect(upcoming).toHaveLength(11);
    expect(wall(upcoming[0].startDate)).toBe('2026-12-01 00:00:00');
    expect(wall(upcoming[10].endDate)).toBe('2027-10-31 23:59:59');
  });

  it('reactivar un plan vencido (pagó el 10): empieza ese día y dura hasta fin de mes', async () => {
    const old = await buy();
    await advancePlans({ patientId, now: at(2026, 11, 7) });
    expect(old.status).toBe('expired');

    const plan = await buy({ startDate: at(2026, 11, 10, 16) });
    expect(plan.status).toBe('active');
    expect(wall(plan.endDate)).toBe('2026-11-30 23:59:59');
  });

  it('cancelar un plan anual cancela también los ciclos futuros', async () => {
    const first = await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await cancelPlanAndFutureCycles(first);
    expect(first.status).toBe('cancelled');
    expect(byStatus('upcoming')).toHaveLength(0);
    expect(byStatus('cancelled')).toHaveLength(12);
  });
});

describe('avisos de vencimiento (campanita + correo)', () => {
  const noticesTo = (type) => vi.mocked(notify).mock.calls.filter(([, t]) => t === type);

  it('a 4 días del fin de mes: aviso "por vencer" con el plazo del 5 de noviembre, una sola vez', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 10, 27, 10));
    await runPlanLifecycleJob(at(2026, 10, 28, 10));

    const [call] = noticesTo('plan_expiring');
    expect(noticesTo('plan_expiring')).toHaveLength(1);
    expect(call[0]).toEqual(patientId);
    expect(call[2].title).toBe('Tu plan está por vencer');
    expect(call[2].body).toContain('31 de octubre');
    expect(call[2].body).toContain('5 de noviembre');
  });

  it('el último día: aviso "vence mañana" (una sola vez), además del de 5 días', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 10, 27, 10));
    await runPlanLifecycleJob(at(2026, 10, 30, 12));
    await runPlanLifecycleJob(at(2026, 10, 31, 8));

    const titles = noticesTo('plan_expiring').map(([, , data]) => data.title);
    expect(titles).toEqual(['Tu plan está por vencer', 'Tu plan vence mañana']);
  });

  it('un plan lejos de vencer no genera avisos', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 10, 22, 10));
    expect(notify).not.toHaveBeenCalled();
  });

  it('un mes intermedio de un plan anual no avisa (ya está pagado el siguiente)', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await runPlanLifecycleJob(at(2026, 10, 28, 10));
    expect(notify).not.toHaveBeenCalled();
  });

  it('el último mes de un plan anual sí avisa', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await advancePlans({ patientId, now: at(2027, 9, 15) });
    await runPlanLifecycleJob(at(2027, 9, 27, 10));
    expect(noticesTo('plan_expiring')).toHaveLength(1);
  });

  it('al abrirse la renovación pendiente: aviso con la fecha límite, una sola vez', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 11, 1, 0, 30));
    await runPlanLifecycleJob(at(2026, 11, 1, 6));

    const pendingNotices = noticesTo('plan_expiring').filter(([, , d]) => d.title === 'Renovación pendiente de pago');
    expect(pendingNotices).toHaveLength(1);
    expect(pendingNotices[0][2].body).toContain('5 de noviembre');
    expect(noticesTo('plan_expired')).toHaveLength(0); // abrir la renovación NO es "venció"
  });

  it('sin pago al pasar el 5: avisa "venció" al paciente y a los administradores, una sola vez', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 11, 1, 1));
    await runPlanLifecycleJob(at(2026, 11, 6, 1));
    await runPlanLifecycleJob(at(2026, 11, 7, 1));

    const expired = noticesTo('plan_expired');
    expect(expired).toHaveLength(2);
    expect(expired.map(([to]) => String(to)).sort()).toEqual([String(patientId), 'admin-1'].sort());
  });

  it('plan que no se renueva: avisa "venció" sin abrir renovación', async () => {
    await buy({ renews: false });
    await runPlanLifecycleJob(at(2026, 11, 1, 1));
    expect(noticesTo('plan_expired')).toHaveLength(2);
    expect(store.docs.some((d) => d.paymentPending)).toBe(false);
  });
});

describe('insignia de Miembro Fundador (plan anual)', () => {
  const flagUpdates = () => vi.mocked(User.updateOne).mock.calls.map(([filter, update]) => ({
    patient: String(filter._id),
    isFounder: update.$set.isFounder
  }));

  it('al registrar un plan anual se enciende', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    expect(flagUpdates()).toEqual([{ patient: String(patientId), isFounder: true }]);
  });

  it('un plan mensual o trimestral no la enciende', async () => {
    await buy({ term: 'trimestral', startDate: at(2026, 10, 1) });
    expect(flagUpdates()).toEqual([{ patient: String(patientId), isFounder: false }]);
  });

  it('al cancelar el plan anual se apaga', async () => {
    const first = await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    vi.mocked(User.updateOne).mockClear();
    await cancelPlanAndFutureCycles(first);
    expect(flagUpdates()).toEqual([{ patient: String(patientId), isFounder: false }]);
  });

  it('pagar la renovación pendiente de un anual la mantiene encendida', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await advancePlans({ patientId, now: at(2027, 10, 1, 1) }); // pasa el año completo
    const pending = byStatus('active')[0];
    expect(pending.paymentPending).toBe(true);
    expect(pending.term).toBe('anual');

    vi.mocked(User.updateOne).mockClear();
    await settlePendingPlan(pending, { sessionsTotal: 8, term: 'anual', registeredBy: adminId });
    expect(flagUpdates()).toEqual([{ patient: String(patientId), isFounder: true }]);
  });

  it('el programador la recalcula para todos: enciende a los anuales y apaga al resto', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await runPlanLifecycleJob(at(2026, 10, 10));

    const [turnOn, turnOff] = vi.mocked(User.updateMany).mock.calls;
    expect(turnOn[0]._id.$in.map(String)).toEqual([String(patientId)]);
    expect(turnOn[1]).toEqual({ $set: { isFounder: true } });
    expect(turnOff[0]).toMatchObject({ role: 'patient', isFounder: true });
    expect(turnOff[1]).toEqual({ $set: { isFounder: false } });
  });
});

describe('sanity del cálculo de fechas del modelo', () => {
  it('la base falsa usa las mismas reglas que el modelo real', () => {
    const start = at(2026, 10, 20, 15);
    expect(wall(cycleBounds(start, 'calendar', 0).end)).toBe('2026-10-31 23:59:59');
  });
});
