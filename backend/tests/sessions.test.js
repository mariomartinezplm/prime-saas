/**
 * PRUEBAS — motor de descuento/devolución de sesiones (Paso 15 de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD
 * real). El caso de concurrencia no prueba la atomicidad de MongoDB en sí
 * (eso lo garantiza el motor de almacenamiento) — prueba que NUESTRO código
 * hace lo correcto con lo que Mongo le devuelve: una promesa compartida en un
 * `findOneAndUpdate` sin ningún `await` antes de leer/incrementar un contador
 * en memoria se resuelve en el mismo orden en que el runtime invoca las
 * llamadas (JS es single-threaded), reproduciendo la garantía real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import Appointment from '../models/Appointment.js';
import * as emailService from '../services/emailService.js';
import { deductSession, refundSession } from '../services/clientPlanService.js';
import { createAppointment } from '../controllers/appointmentController.js';

// El motor de ciclos de planes toca la base: en estas pruebas el plan ya viene "al día"
vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// ─────────────────────────────────────────────────────────────────────────────
describe('clientPlanService.deductSession / refundSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('descuenta de un ClientPlan con cupo y retorna {source, refId}', async () => {
    const planId = nuevoId();
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: planId });

    const result = await deductSession(nuevoId(), 'kinesiologia', nuevoId());

    expect(result).toEqual({ source: 'clientPlan', refId: planId });
  });

  it('sin cupo en el plan, cae a la ExtraSession no usada más antigua', async () => {
    const extraId = nuevoId();
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue(null);
    const extraSpy = vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue({ _id: extraId });

    const result = await deductSession(nuevoId(), 'entrenamiento', nuevoId());

    expect(result).toEqual({ source: 'extraSession', refId: extraId });
    expect(extraSpy).toHaveBeenCalledWith(
      expect.objectContaining({ used: false }),
      expect.objectContaining({ $set: expect.objectContaining({ used: true }) }),
      expect.objectContaining({ sort: { createdAt: 1 } })
    );
  });

  it('sin plan ni extra disponible, retorna null', async () => {
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue(null);

    const result = await deductSession(nuevoId(), 'kinesiologia', nuevoId());

    expect(result).toBeNull();
  });

  it('dos llamadas concurrentes con saldo para una sola: una gana, una pierde', async () => {
    let sessionsUsed = 4;
    const sessionsTotal = 5;

    // Sin ningún `await` antes de leer/escribir el contador: reproduce que
    // Mongo evalúa el filtro + $inc como una sola operación indivisible.
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockImplementation((filter) => {
      if (sessionsUsed < sessionsTotal) {
        sessionsUsed += 1;
        return Promise.resolve({ _id: nuevoId(), sessionsUsed });
      }
      return Promise.resolve(null);
    });
    vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue(null);

    const results = await Promise.all([
      deductSession(nuevoId(), 'kinesiologia', nuevoId()),
      deductSession(nuevoId(), 'kinesiologia', nuevoId())
    ]);

    const winners = results.filter((r) => r !== null);
    const losers = results.filter((r) => r === null);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });

  it('refundSession decrementa un ClientPlan cuando la fuente es clientPlan', async () => {
    const refId = nuevoId();
    const spy = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({});

    await refundSession({ deduction: { source: 'clientPlan', refId } });

    expect(spy).toHaveBeenCalledWith(
      { _id: refId, sessionsUsed: { $gt: 0 } },
      { $inc: { sessionsUsed: -1 } }
    );
  });

  it('refundSession revive una ExtraSession cuando la fuente es extraSession', async () => {
    const refId = nuevoId();
    const spy = vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue({});

    await refundSession({ deduction: { source: 'extraSession', refId } });

    expect(spy).toHaveBeenCalledWith(
      { _id: refId, used: true },
      { $set: { used: false, usedAt: null, usedInAppointment: null } }
    );
  });

  it('sin deduction (cita que nunca descontó nada), no hace ninguna escritura', async () => {
    const planSpy = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({});
    const extraSpy = vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue({});

    await refundSession({});

    expect(planSpy).not.toHaveBeenCalled();
    expect(extraSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /appointments — motor de descuento cableado', () => {
  const PATIENT_ID = nuevoId();
  const PROFESSIONAL_ID = nuevoId();

  const futureDate = () => {
    const d = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h en el futuro
    return d.toISOString().split('T')[0];
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id.toString();
      if (idStr === PATIENT_ID.toString()) return Promise.resolve({ _id: PATIENT_ID, role: 'patient', isActive: true });
      if (idStr === PROFESSIONAL_ID.toString()) return Promise.resolve({ _id: PROFESSIONAL_ID, role: 'professional' });
      return Promise.resolve(null);
    });

    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0); // cupo de horario nunca lleno
    vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});

    vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({
      ...data,
      _id: nuevoId(),
      populate: vi.fn().mockResolvedValue(undefined)
    }));
  });

  const baseReq = () => ({
    user: { _id: PATIENT_ID, role: 'patient' },
    body: {
      professional: PROFESSIONAL_ID.toString(),
      date: futureDate(),
      startTime: '10:00',
      type: 'kinesiologia'
    }
  });

  it('con saldo disponible: descuenta y crea la cita con sessionDeducted + deduction', async () => {
    const planId = nuevoId();
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 1 });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: planId });

    const res = fakeRes();
    await createAppointment(baseReq(), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.appointment.sessionDeducted).toBe(true);
    expect(res.body.data.appointment.deduction).toEqual({ source: 'clientPlan', refId: planId });
  });

  it('sin saldo de ese tipo: 403 NO_ACTIVE_PLAN_SESSIONS, nunca llega a intentar el descuento', async () => {
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue(null);
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    const deductSpy = vi.spyOn(ClientPlan, 'findOneAndUpdate');

    const res = fakeRes();
    await createAppointment(baseReq(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
    expect(deductSpy).not.toHaveBeenCalled();
  });

  it('evaluación: no descuenta nada, sin bloqueo de saldo', async () => {
    const balanceSpy = vi.spyOn(ClientPlan, 'findOne');
    const deductSpy = vi.spyOn(ClientPlan, 'findOneAndUpdate');

    const req = baseReq();
    req.body.type = 'evaluacion';
    const res = fakeRes();
    await createAppointment(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.appointment.sessionDeducted).toBe(false);
    expect(balanceSpy).not.toHaveBeenCalled(); // ni siquiera se consulta el balance
    expect(deductSpy).not.toHaveBeenCalled();
  });

  it('staff agendando para un paciente: no descuenta nada', async () => {
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    const deductSpy = vi.spyOn(ClientPlan, 'findOneAndUpdate');

    const req = {
      user: { _id: nuevoId(), role: 'admin' },
      body: { ...baseReq().body, patient: PATIENT_ID.toString() }
    };
    const res = fakeRes();
    await createAppointment(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.appointment.sessionDeducted).toBe(false);
    expect(deductSpy).not.toHaveBeenCalled();
  });

  it('carrera real: dos requests con saldo para 1, Promise.all → un 201 y un 409 SESSION_CONFLICT', async () => {
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 1 });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue(null);

    let sessionsUsed = 4;
    const sessionsTotal = 5;
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockImplementation(() => {
      if (sessionsUsed < sessionsTotal) {
        sessionsUsed += 1;
        return Promise.resolve({ _id: nuevoId() });
      }
      return Promise.resolve(null);
    });

    const res1 = fakeRes();
    const res2 = fakeRes();

    await Promise.all([
      createAppointment(baseReq(), res1),
      createAppointment(baseReq(), res2)
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    const loserRes = res1.statusCode === 409 ? res1 : res2;
    expect(loserRes.body.code).toBe('SESSION_CONFLICT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /appointments/:id — updateAppointment bloquea cancelar por esta vía', () => {
  it('status:"cancelled" responde 400 sin guardar ningún cambio', async () => {
    const { updateAppointment } = await import('../controllers/appointmentController.js');
    const saveSpy = vi.fn();
    vi.spyOn(Appointment, 'findById').mockResolvedValue({
      _id: nuevoId(),
      status: 'scheduled',
      save: saveSpy
    });

    const req = { params: { id: nuevoId().toString() }, body: { status: 'cancelled' } };
    const res = fakeRes();

    await updateAppointment(req, res);

    expect(res.statusCode).toBe(400);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('marcar completed sigue funcionando igual (sin lógica de descuento asociada)', async () => {
    const { updateAppointment } = await import('../controllers/appointmentController.js');
    vi.spyOn(emailService, 'sendAppointmentUpdatedEmail').mockImplementation(() => {});
    const appointmentDoc = {
      _id: nuevoId(),
      status: 'scheduled',
      date: new Date(),
      startTime: '10:00',
      save: vi.fn().mockResolvedValue(true),
      populate: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(Appointment, 'findById').mockResolvedValue(appointmentDoc);

    const req = { params: { id: nuevoId().toString() }, body: { status: 'completed' } };
    const res = fakeRes();

    await updateAppointment(req, res);

    expect(res.statusCode).toBe(200);
    expect(appointmentDoc.status).toBe('completed');
    expect(appointmentDoc.save).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('catálogo de planes y plan ilimitado', () => {
  const planBase = (overrides) => new ClientPlan({
    patient: nuevoId(),
    registeredBy: nuevoId(),
    ...overrides
  });

  it('kinesiología acepta 1, 5, 10, 12, 15 y 20 sesiones; rechaza 7', async () => {
    for (const n of [1, 5, 10, 12, 15, 20]) {
      await expect(planBase({ serviceType: 'kinesiologia', sessionsTotal: n }).validate()).resolves.toBeUndefined();
    }
    await expect(planBase({ serviceType: 'kinesiologia', sessionsTotal: 7 }).validate()).rejects.toThrow(/inválido/);
  });

  it('entrenamiento acepta 4, 8, 12 y 16; rechaza 5', async () => {
    for (const n of [4, 8, 12, 16]) {
      await expect(planBase({ serviceType: 'entrenamiento', sessionsTotal: n }).validate()).resolves.toBeUndefined();
    }
    await expect(planBase({ serviceType: 'entrenamiento', sessionsTotal: 5 }).validate()).rejects.toThrow(/inválido/);
  });

  it('entrenamiento ilimitado es válido, guarda sessionsTotal 0 y siempre tiene saldo', async () => {
    const plan = planBase({ serviceType: 'entrenamiento', unlimited: true, sessionsTotal: 99 });
    await expect(plan.validate()).resolves.toBeUndefined();
    expect(plan.sessionsTotal).toBe(0);
    plan.sessionsUsed = 500;
    expect(plan.sessionsAvailable()).toBeGreaterThan(0);
  });

  it('kinesiología ilimitada se rechaza', async () => {
    const plan = planBase({ serviceType: 'kinesiologia', unlimited: true });
    await expect(plan.validate()).rejects.toThrow(/ilimitado/);
  });

  it('deductSession deja pasar a un plan ilimitado aunque sessionsUsed supere a sessionsTotal', async () => {
    vi.restoreAllMocks();
    const planId = nuevoId();
    const spy = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: planId });

    const result = await deductSession(nuevoId(), 'entrenamiento', null);

    expect(result).toEqual({ source: 'clientPlan', refId: planId });
    const filter = spy.mock.calls[0][0];
    expect(filter.$or).toEqual(expect.arrayContaining([{ unlimited: true }]));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /appointments — sobrecupo (solo admin)', () => {
  const PATIENT_ID = nuevoId();
  const PROFESSIONAL_ID = nuevoId();
  const futureDate = () => new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

  const setup = (overlapping) => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id.toString();
      if (idStr === PATIENT_ID.toString()) return Promise.resolve({ _id: PATIENT_ID, role: 'patient', isActive: true });
      if (idStr === PROFESSIONAL_ID.toString()) return Promise.resolve({ _id: PROFESSIONAL_ID, role: 'professional' });
      return Promise.resolve(null);
    });
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(overlapping);
    vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
    vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({
      ...data,
      _id: nuevoId(),
      populate: vi.fn().mockResolvedValue(undefined)
    }));
  };

  const reqOf = (role, extra = {}) => ({
    user: { _id: role === 'patient' ? PATIENT_ID : nuevoId(), role },
    body: {
      professional: PROFESSIONAL_ID.toString(),
      patient: PATIENT_ID.toString(),
      date: futureDate(),
      startTime: '10:00',
      type: 'kinesiologia',
      ...extra
    }
  });

  it('horario con 4 pacientes: un paciente recibe 400 aunque mande allowOverbook', async () => {
    setup(4);
    const res = fakeRes();
    await createAppointment(reqOf('patient', { allowOverbook: true }), res);
    expect(res.statusCode).toBe(400);
  });

  it('horario con 4 pacientes: un profesional recibe 400 aunque mande allowOverbook', async () => {
    setup(4);
    const res = fakeRes();
    await createAppointment(reqOf('professional', { allowOverbook: true }), res);
    expect(res.statusCode).toBe(400);
  });

  it('horario con 4 pacientes: el admin SIN allowOverbook recibe 400', async () => {
    setup(4);
    const res = fakeRes();
    await createAppointment(reqOf('admin'), res);
    expect(res.statusCode).toBe(400);
  });

  it('horario con 4 pacientes: el admin CON allowOverbook crea la cita marcada como sobrecupo', async () => {
    setup(4);
    const res = fakeRes();
    await createAppointment(reqOf('admin', { allowOverbook: true }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.appointment.overbooked).toBe(true);
  });

  it('horario con cupo: el admin con allowOverbook crea una cita normal (overbooked false)', async () => {
    setup(2);
    const res = fakeRes();
    await createAppointment(reqOf('admin', { allowOverbook: true }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.appointment.overbooked).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /appointments — renovación pendiente de pago (plazo del 5)', () => {
  const PATIENT_ID = nuevoId();
  const PROFESSIONAL_ID = nuevoId();
  const HOUR = 60 * 60 * 1000;
  // La cita es dentro de ~48 h
  const sessionDate = () => new Date(Date.now() + 48 * HOUR).toISOString().split('T')[0];

  const setup = (planOverrides) => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id.toString();
      if (idStr === PATIENT_ID.toString()) return Promise.resolve({ _id: PATIENT_ID, role: 'patient', isActive: true });
      if (idStr === PROFESSIONAL_ID.toString()) return Promise.resolve({ _id: PROFESSIONAL_ID, role: 'professional' });
      return Promise.resolve(null);
    });
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 4, ...planOverrides });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });
    vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
    vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({
      ...data,
      _id: nuevoId(),
      populate: vi.fn().mockResolvedValue(undefined)
    }));
  };

  const req = () => ({
    user: { _id: PATIENT_ID, role: 'patient' },
    body: { professional: PROFESSIONAL_ID.toString(), date: sessionDate(), startTime: '10:00', type: 'kinesiologia' }
  });

  it('puede agendar sin haber pagado si la sesión cae dentro del plazo de pago', async () => {
    setup({ paymentPending: true, paymentDueBy: new Date(Date.now() + 7 * 24 * HOUR) });
    const res = fakeRes();
    await createAppointment(req(), res);
    expect(res.statusCode).toBe(201);
  });

  it('no puede agendar una sesión posterior al plazo de pago: 403 PAYMENT_PENDING, sin descontar', async () => {
    setup({ paymentPending: true, paymentDueBy: new Date(Date.now() + 24 * HOUR) });
    const res = fakeRes();
    await createAppointment(req(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PAYMENT_PENDING');
    expect(res.body.message).toContain('pendiente de pago');
    expect(ClientPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('un plan ya pagado no tiene esa restricción', async () => {
    setup({ paymentPending: false });
    const res = fakeRes();
    await createAppointment(req(), res);
    expect(res.statusCode).toBe(201);
  });
});
