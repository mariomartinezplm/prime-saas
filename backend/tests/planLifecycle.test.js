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
  createEarlyRenewal,
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

  // Solo los que salen además por correo (la renovación pendiente y el «venció» van solo a la campanita)
  const expiringTitles = () => noticesTo('plan_expiring').filter(([, , data]) => data.email !== false).map(([, , data]) => data.title);

  it('antes del último día no sale ningún aviso de renovación', async () => {
    await buy();
    for (const d of [25, 26, 27, 28, 29, 30]) await runPlanLifecycleJob(at(2026, 10, d, 10));
    expect(expiringTitles()).toEqual([]);
  });

  it('el último día del mes: un aviso con el plazo del 5 de noviembre, una sola vez', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 10, 31, 10));
    await runPlanLifecycleJob(at(2026, 10, 31, 18));

    const [call] = noticesTo('plan_expiring');
    expect(noticesTo('plan_expiring')).toHaveLength(1);
    expect(call[0]).toEqual(patientId);
    expect(call[2].title).toBe('Tu plan vence hoy: recuerda renovar');
    expect(call[2].body).toContain('31 de octubre');
    expect(call[2].body).toContain('5 de noviembre');
    expect(call[2].body).toContain('no podrás agendar');
  });

  it('son 3 correos en total: el último día del mes, el día 3 y el día 5 (último día para pagar)', async () => {
    await buy();
    for (const [d, h] of [[30, 10], [31, 7], [31, 9], [31, 20]]) await runPlanLifecycleJob(at(2026, 10, d, h));
    for (const [d, h] of [[1, 9], [2, 9], [3, 7], [3, 9], [3, 18], [4, 9], [5, 7], [5, 9], [5, 20]]) {
      await runPlanLifecycleJob(at(2026, 11, d, h));
    }
    expect(expiringTitles()).toEqual(['Tu plan vence hoy: recuerda renovar', 'Recuerda pagar tu renovación', 'Hoy es tu último día para pagar']);
  });

  it('los correos no salen de madrugada: esperan a las 08:00 de Chile', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 10, 31, 3));
    expect(notify).not.toHaveBeenCalled();
    await runPlanLifecycleJob(at(2026, 10, 31, 8, 30));
    expect(noticesTo('plan_expiring')).toHaveLength(1);
  });

  it('si el programador estuvo apagado hasta el día 5, sale solo el del último día para pagar', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 11, 1, 9));
    await runPlanLifecycleJob(at(2026, 11, 5, 10));
    await runPlanLifecycleJob(at(2026, 11, 5, 18));
    expect(expiringTitles()).toEqual(['Hoy es tu último día para pagar']);
  });

  it('solo planes de entrenamiento: kinesiología no recibe estos correos', async () => {
    await buy({ serviceType: 'kinesiologia', sessionsTotal: 5 });
    await runPlanLifecycleJob(at(2026, 10, 31, 10));
    await runPlanLifecycleJob(at(2026, 11, 3, 10));
    expect(expiringTitles()).toEqual([]);
  });

  it('si el plan se renueva por adelantado, el aviso del último día no sale', async () => {
    const plan = await buy();
    await createEarlyRenewal(plan, { registeredBy: adminId });
    await runPlanLifecycleJob(at(2026, 10, 31, 10));
    await runPlanLifecycleJob(at(2026, 11, 3, 10));
    expect(expiringTitles()).toEqual([]);
  });

  it('si se paga el día 2, ni el del día 3 ni el del día 5 salen', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 11, 1, 9));
    const pending = byStatus('active')[0];
    await settlePendingPlan(pending, { sessionsTotal: 8, term: 'mensual', registeredBy: adminId });
    await runPlanLifecycleJob(at(2026, 11, 3, 9));
    await runPlanLifecycleJob(at(2026, 11, 5, 9));
    expect(expiringTitles()).toEqual([]);
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
    await runPlanLifecycleJob(at(2027, 9, 30, 10));
    expect(noticesTo('plan_expiring')).toHaveLength(1);
  });

  it('al abrirse la renovación pendiente: aviso con la fecha límite, una sola vez', async () => {
    await buy();
    await runPlanLifecycleJob(at(2026, 11, 1, 0, 30));
    await runPlanLifecycleJob(at(2026, 11, 1, 6));

    const pendingNotices = noticesTo('plan_expiring').filter(([, , d]) => d.title === 'Renovación pendiente de pago');
    expect(pendingNotices).toHaveLength(1);
    expect(pendingNotices[0][2].body).toContain('5 de noviembre');
    expect(pendingNotices[0][2].email).toBe(false); // solo campanita: el correo es el del día 3
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
    expect(expired.every(([, , d]) => d.email === false)).toBe(true); // el correo es solo para los 4 avisos de antes
  });

  it('plan que no se renueva: avisa "venció" sin abrir renovación', async () => {
    await buy({ renews: false });
    await runPlanLifecycleJob(at(2026, 11, 1, 1));
    expect(noticesTo('plan_expired')).toHaveLength(2);
    expect(store.docs.some((d) => d.paymentPending)).toBe(false);
  });
});

describe('Miembro Fundador: marca manual que ningún plan cambia', () => {
  it('registrar, cancelar o pagar planes (mensual, trimestral, anual) nunca toca la estrella', async () => {
    const first = await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await buy({ term: 'trimestral', startDate: at(2025, 1, 1) });
    await cancelPlanAndFutureCycles(first);
    await advancePlans({ patientId, now: at(2027, 10, 1, 1) });
    const pending = byStatus('active')[0];
    if (pending) await settlePendingPlan(pending, { sessionsTotal: 8, term: 'mensual', registeredBy: adminId });
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it('el programador no enciende ni apaga la estrella de nadie', async () => {
    await buy({ term: 'anual', startDate: at(2026, 10, 1) });
    await runPlanLifecycleJob(at(2026, 10, 10));
    expect(User.updateMany).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});

describe('beca y Miembro Fundador: el plan se renueva solo', () => {
  const asFounder = (is = true) => vi.mocked(User.find).mockImplementation((filter) => ({
    select: async () => (filter?.isFounder === true ? (is ? [{ _id: patientId }] : []) : [{ _id: 'admin-1' }])
  }));
  const lastActive = () => byStatus('active').at(-1);

  it('un fundador: el 1 de noviembre el ciclo nuevo nace activo y pagado, sin plazo ni vencimiento', async () => {
    asFounder();
    await buy({ startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    const renewal = lastActive();
    expect(renewal).toMatchObject({ paymentPending: false, autoRenewed: true, status: 'active', renews: true, cycleNumber: 1 });
    expect(wall(renewal.startDate)).toBe('2026-11-01 00:00:00');
    expect(byStatus('expired')).toHaveLength(1); // el ciclo de octubre cerró

    // Pasado el plazo de 5 días sigue activo: nunca vence por falta de pago registrado
    await advancePlans({ patientId, now: at(2026, 11, 10, 1) });
    expect(byStatus('active')).toHaveLength(1);
    expect(byStatus('active')[0]).toMatchObject({ paymentPending: false, autoRenewed: true });
  });

  it('si el servidor estuvo apagado y ya pasó el plazo de 5 días, el fundador igual queda con su plan renovado', async () => {
    asFounder();
    await buy({ startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 20, 1) });
    expect(lastActive()).toMatchObject({ paymentPending: false, autoRenewed: true, status: 'active' });
    expect(wall(lastActive().startDate)).toBe('2026-11-01 00:00:00');
  });

  it('una beca (aunque su dueño no sea fundador): se renueva sola y conserva la beca', async () => {
    asFounder(false);
    await buy({ scholarship: true, startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    expect(lastActive()).toMatchObject({ paymentPending: false, autoRenewed: true, scholarship: true });
    await advancePlans({ patientId, now: at(2026, 12, 1, 1) });
    expect(lastActive()).toMatchObject({ paymentPending: false, autoRenewed: true, scholarship: true });
  });

  it('una beca siempre se renueva: la casilla «se renueva» no la deja sin renovación', async () => {
    asFounder(false);
    const plan = await buy({ scholarship: true, renews: false });
    expect(plan.renews).toBe(true);
  });

  it('un paciente común sigue igual: renovación pendiente de pago con su plazo', async () => {
    asFounder(false);
    await buy({ startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    expect(lastActive()).toMatchObject({ paymentPending: true });
    expect(lastActive().autoRenewed).toBeUndefined();
  });

  it('un fundador con plan trimestral: al terminar el tercer mes se abren los tres meses siguientes ya pagados', async () => {
    asFounder();
    await buy({ term: 'trimestral', startDate: at(2026, 10, 1) });
    await advancePlans({ patientId, now: at(2027, 1, 1, 1) });
    const cycles = store.docs.filter((d) => d.autoRenewed || d.status === 'upcoming');
    expect(cycles).toHaveLength(3);
    expect(byStatus('active')[0]).toMatchObject({ paymentPending: false, term: 'trimestral', cyclesTotal: 3, cycleNumber: 1 });
    expect(byStatus('upcoming').map((d) => d.cycleNumber)).toEqual([2, 3]);
  });

  it('repetir el proceso no abre dos ciclos', async () => {
    asFounder();
    await buy({ startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 2) });
    expect(store.docs.filter((d) => d.autoRenewed)).toHaveLength(1);
  });

  it('una renovación que ya estaba pendiente (antes de esta regla) de un fundador se da por pagada y no vence', async () => {
    asFounder(false);
    await buy({ startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    const pending = lastActive();
    expect(pending.paymentPending).toBe(true);
    pending.sessionsUsed = 2;

    asFounder(true);
    await advancePlans({ patientId, now: at(2026, 11, 3, 1) });
    expect(pending).toMatchObject({ paymentPending: false, autoRenewed: true, status: 'active', sessionsUsed: 2 });
    await advancePlans({ patientId, now: at(2026, 11, 20, 1) });
    expect(pending.status).toBe('active');
  });

  it('un plan puntual (renews: false) de un fundador no se renueva', async () => {
    asFounder();
    await buy({ renews: false, startDate: at(2026, 10, 20, 15) });
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    expect(byStatus('active')).toHaveLength(0);
    expect(store.docs.some((d) => d.autoRenewed)).toBe(false);
  });

  it('avisos: el fundador recibe «tu plan se renovó» (con la fecha para pagar) y los administradores, uno solo; una sola vez', async () => {
    asFounder();
    await buy({ startDate: at(2026, 10, 20, 15) });
    await runPlanLifecycleJob(at(2026, 11, 1, 1));
    const renewed = vi.mocked(notify).mock.calls.filter(([, type]) => type === 'plan_auto_renewed');
    expect(renewed.map(([to]) => String(to)).sort()).toEqual([String(patientId), 'admin-1'].sort());
    const toPatient = renewed.find(([to]) => String(to) === String(patientId))[2];
    expect(toPatient.body).toMatch(/antes del 5 de noviembre/);
    expect(toPatient.body).not.toMatch(/\$/); // nunca se muestran precios
    expect(vi.mocked(notify).mock.calls.some(([, type]) => type === 'plan_expiring')).toBe(false);

    vi.mocked(notify).mockClear();
    await runPlanLifecycleJob(at(2026, 11, 2, 1));
    expect(vi.mocked(notify).mock.calls.filter(([, type]) => type === 'plan_auto_renewed')).toHaveLength(0);
  });

  it('avisos: una beca no recibe ningún aviso de pago ni de renovación, ni los administradores', async () => {
    asFounder(false);
    await buy({ scholarship: true, startDate: at(2026, 10, 20, 15) });
    await runPlanLifecycleJob(at(2026, 10, 28, 1)); // faltan días para vencer: no hay «por vencer»
    await runPlanLifecycleJob(at(2026, 11, 1, 1));
    await runPlanLifecycleJob(at(2026, 11, 7, 1));
    expect(vi.mocked(notify)).not.toHaveBeenCalled();
  });

  it('avisos: un fundador tampoco recibe «tu plan está por vencer»', async () => {
    asFounder();
    await buy({ startDate: at(2026, 10, 20, 15) });
    await runPlanLifecycleJob(at(2026, 10, 28, 1));
    expect(vi.mocked(notify).mock.calls.some(([, type]) => type === 'plan_expiring')).toBe(false);
  });
});

describe('renovación por adelantado («Renovar plan» antes de que termine el mes)', () => {
  // Ningún paciente es fundador aquí (otras pruebas del archivo cambian esta respuesta)
  beforeEach(() => vi.mocked(User.find).mockImplementation(() => ({ select: async () => [{ _id: 'admin-1' }] })));
  const renewEarly = (plan, extra = {}) => createEarlyRenewal(plan, { registeredBy: adminId, ...extra });
  const noticesTo = (type) => vi.mocked(notify).mock.calls.filter(([, t]) => t === type);

  it('el plazo siguiente queda pagado (por empezar) y parte justo cuando termina el vigente', async () => {
    const plan = await buy({ startDate: at(2026, 10, 20, 15) });
    const next = await renewEarly(plan);
    expect(next).toMatchObject({ status: 'upcoming', paymentPending: false, renews: true, sessionsTotal: 8, cycleNumber: 1 });
    expect(String(next.renewedFrom)).toBe(String(plan._id));
    expect(wall(next.startDate)).toBe('2026-11-01 00:00:00');
    expect(plan.status).toBe('active'); // el plan de hoy sigue igual
  });

  it('al terminar el mes arranca solo el plazo ya pagado: sin renovación pendiente, sin plazo de pago y sin avisos de pago', async () => {
    const plan = await buy({ startDate: at(2026, 10, 20, 15) });
    await renewEarly(plan);
    await advancePlans({ patientId, now: at(2026, 11, 1, 1) });
    const active = byStatus('active');
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ paymentPending: false, sessionsUsed: 0 });
    expect(wall(active[0].startDate)).toBe('2026-11-01 00:00:00');
    expect(store.docs.some((d) => d.paymentPending)).toBe(false);
    // y pasado el plazo de 5 días sigue activo (nada vence)
    await advancePlans({ patientId, now: at(2026, 11, 20, 1) });
    expect(byStatus('active')).toHaveLength(1);
    await runPlanLifecycleJob(at(2026, 11, 7, 1));
    expect(noticesTo('plan_expired')).toHaveLength(0);
  });

  it('un plan trimestral renovado por adelantado trae sus tres meses pagados', async () => {
    const plan = await buy({ term: 'trimestral', startDate: at(2026, 8, 1) });
    await advancePlans({ patientId, now: at(2026, 10, 15) });
    const last = byStatus('active')[0];
    await renewEarly(last);
    expect(byStatus('upcoming').map((d) => d.cycleNumber).sort()).toEqual([1, 2, 3]);
    expect(plan).toBeTruthy();
  });

  it('no avisa «tu plan está por vencer» a quien ya renovó', async () => {
    const plan = await buy({ startDate: at(2026, 10, 20, 15) });
    await runPlanLifecycleJob(at(2026, 10, 31, 10));
    expect(noticesTo('plan_expiring')).toHaveLength(1); // sin renovar, sí avisa
    vi.mocked(notify).mockClear();
    plan.expiringTodayNotifiedAt = null;
    await renewEarly(plan);
    await runPlanLifecycleJob(at(2026, 10, 31, 12));
    expect(noticesTo('plan_expiring')).toHaveLength(0);
  });

  it('renovar dos veces el mismo plan no crea dos renovaciones', async () => {
    const plan = await buy({ startDate: at(2026, 10, 20, 15) });
    await renewEarly(plan);
    await expect(renewEarly(plan)).rejects.toMatchObject({ code: 'ALREADY_RENEWED', status: 409 });
    expect(byStatus('upcoming')).toHaveLength(1);
  });

  it('conserva el pago mes a mes y la beca', async () => {
    const plan = await buy({ term: 'trimestral', startDate: at(2026, 8, 1) });
    await advancePlans({ patientId, now: at(2026, 10, 15) });
    const next = await renewEarly(byStatus('active')[0], { paymentMode: 'monthly', scholarship: true });
    expect(next).toMatchObject({ paymentMode: 'monthly', scholarship: true });
    expect(plan).toBeTruthy();
  });
});

describe('sanity del cálculo de fechas del modelo', () => {
  it('la base falsa usa las mismas reglas que el modelo real', () => {
    const start = at(2026, 10, 20, 15);
    expect(wall(cycleBounds(start, 'calendar', 0).end)).toBe('2026-10-31 23:59:59');
  });
});
