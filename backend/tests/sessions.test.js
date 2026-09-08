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

    vi.spyOn(ClientPlan, 'expireOverduePlans').mockResolvedValue(0);
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
