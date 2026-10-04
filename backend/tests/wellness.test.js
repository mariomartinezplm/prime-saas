/**
 * PRUEBAS — wellness check-in diario (Paso 23 de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';

import WellnessCheckin from '../models/WellnessCheckin.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { createCheckin, getTodayCheckin, getTrends, getPatientCheckins } from '../controllers/wellnessController.js';

vi.mock('../services/clientPlanService.js', () => ({
  hasActivePlan: vi.fn()
}));
import { hasActivePlan } from '../services/clientPlanService.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// Escala 1-9, 9 = mejor en las cinco (un día normal-bueno: verde)
const baseBody = () => ({ sleep: 8, energy: 8, stress: 8, soreness: 8, mood: 8 });

// create() simulado: devuelve el documento tal como lo guardaría la base
const fakeCreate = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

describe('POST /wellness — check-in diario', () => {
  it('con plan activo: crea el check-in (201)', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const createSpy = vi.spyOn(WellnessCheckin, 'create').mockImplementation(fakeCreate);

    const patientId = nuevoId();
    const req = { user: { _id: patientId }, body: baseBody() };
    const res = fakeRes();

    await createCheckin(req, res);

    expect(res.statusCode).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ patient: patientId, sleep: 8, scale: 9 }));
    expect(res.body.data.checkin.readiness.status).toBe('green');
  });

  it('sin plan activo: 403, nunca intenta crear el check-in', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(false);
    const createSpy = vi.spyOn(WellnessCheckin, 'create');

    const req = { user: { _id: nuevoId() }, body: baseBody() };
    const res = fakeRes();

    await createCheckin(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('segundo check-in del mismo día: el índice único responde E11000 -> 409, no 500', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const duplicateError = Object.assign(new Error('duplicate'), { code: 11000 });
    vi.spyOn(WellnessCheckin, 'create').mockRejectedValue(duplicateError);

    const req = { user: { _id: nuevoId() }, body: baseBody() };
    const res = fakeRes();

    await createCheckin(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ALREADY_CHECKED_IN_TODAY');
  });

  it('semáforo ROJO: crea la alerta wellness_alert para el profesional asignado', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const patientId = nuevoId();
    const profId = nuevoId();

    vi.spyOn(WellnessCheckin, 'create').mockImplementation(fakeCreate);
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ firstName: 'Ana', lastName: 'Paciente', assignedProfessionalId: profId })
    });
    const notifSpy = vi.spyOn(Notification, 'create').mockResolvedValue({ _id: nuevoId() });

    const req = {
      user: { _id: patientId },
      body: { sleep: 1, energy: 3, stress: 1, soreness: 2, mood: 1 } // promedio 1.6: rojo
    };
    const res = fakeRes();

    await createCheckin(req, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.statusCode).toBe(201);
    expect(notifSpy).toHaveBeenCalledWith(expect.objectContaining({ user: profId, type: 'wellness_alert' }));
  });

  it('semáforo verde o amarillo: NO crea ninguna alerta', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    vi.spyOn(WellnessCheckin, 'create').mockImplementation(fakeCreate);
    const findByIdSpy = vi.spyOn(User, 'findById');
    const notifSpy = vi.spyOn(Notification, 'create');

    const req = { user: { _id: nuevoId() }, body: { sleep: 5, energy: 5, stress: 5, soreness: 5, mood: 5 } }; // amarillo
    const res = fakeRes();

    await createCheckin(req, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.statusCode).toBe(201);
    expect(findByIdSpy).not.toHaveBeenCalled();
    expect(notifSpy).not.toHaveBeenCalled();
  });
});

describe('POST /wellness — validación y semáforo', () => {
  it('respuestas fuera de 1-9, decimales o texto: 400 y no se guarda nada', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const createSpy = vi.spyOn(WellnessCheckin, 'create');

    for (const malo of [0, 10, 4.5, '5', null]) {
      const res = fakeRes();
      await createCheckin({ user: { _id: nuevoId() }, body: { ...baseBody(), mood: malo } }, res);
      expect(res.statusCode).toBe(400);
    }
    const resFalta = fakeRes();
    const { sleep, ...sinSueno } = baseBody();
    await createCheckin({ user: { _id: nuevoId() }, body: sinSueno }, resFalta);
    expect(resFalta.statusCode).toBe(400);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('una respuesta muy mala baja el verde a amarillo y NO avisa al profesional', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    vi.spyOn(WellnessCheckin, 'create').mockImplementation(fakeCreate);
    const notifSpy = vi.spyOn(Notification, 'create');
    const res = fakeRes();

    await createCheckin({ user: { _id: nuevoId() }, body: { sleep: 9, energy: 9, stress: 9, soreness: 2, mood: 9 } }, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.body.data.checkin.readiness.status).toBe('yellow');
    expect(res.body.data.checkin.readiness.flags).toEqual(['soreness']);
    expect(notifSpy).not.toHaveBeenCalled();
  });

  it('las notas se recortan a 500 caracteres', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const createSpy = vi.spyOn(WellnessCheckin, 'create').mockImplementation(fakeCreate);

    await createCheckin({ user: { _id: nuevoId() }, body: { ...baseBody(), notes: 'x'.repeat(900) } }, fakeRes());

    expect(createSpy.mock.calls[0][0].notes).toHaveLength(500);
  });
});

describe('GET /wellness/me', () => {
  it('devuelve null si el paciente no ha respondido hoy', async () => {
    vi.restoreAllMocks();
    vi.spyOn(WellnessCheckin, 'findOne').mockResolvedValue(null);

    const req = { user: { _id: nuevoId() } };
    const res = fakeRes();
    await getTodayCheckin(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.checkin).toBeNull();
  });

  it('devuelve el check-in de hoy si ya respondió', async () => {
    vi.restoreAllMocks();
    const checkin = { _id: nuevoId(), scale: 9, sleep: 7, energy: 7, stress: 7, soreness: 7, mood: 7 };
    vi.spyOn(WellnessCheckin, 'findOne').mockResolvedValue(checkin);

    const req = { user: { _id: nuevoId() } };
    const res = fakeRes();
    await getTodayCheckin(req, res);

    expect(res.body.data.checkin.sleep).toBe(7);
    expect(res.body.data.checkin.readiness.status).toBe('green');
  });

  it('un check-in ANTIGUO (escala 1-5, sin scale) se devuelve convertido a 1-9', async () => {
    vi.restoreAllMocks();
    const viejo = { _id: nuevoId(), sleep: 5, energy: 5, stress: 5, soreness: 5, mood: 5 }; // 5/5 = excelente
    vi.spyOn(WellnessCheckin, 'findOne').mockResolvedValue(viejo);

    const res = fakeRes();
    await getTodayCheckin({ user: { _id: nuevoId() } }, res);

    expect(res.body.data.checkin.sleep).toBe(9);
    expect(res.body.data.checkin.readiness.status).toBe('green');
  });
});

describe('GET /wellness/trends — resumen semanal por paciente', () => {
  const makeCheckin = (patientId, vals) => ({
    patient: patientId,
    sleep: vals[0], energy: vals[1], stress: vals[2], soreness: vals[3], mood: vals[4]
  });

  it('profesional: solo ve la tendencia de SUS pacientes asignados (query scoped)', async () => {
    vi.restoreAllMocks();
    const profId = nuevoId();
    const findSpy = vi.spyOn(User, 'find').mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    vi.spyOn(WellnessCheckin, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });

    const req = { user: { _id: profId, role: 'professional' } };
    const res = fakeRes();
    await getTrends(req, res);

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      role: 'patient',
      isActive: true,
      $or: expect.arrayContaining([{ assignedProfessionalId: profId }])
    }));
    expect(res.statusCode).toBe(200);
  });

  it('marca isLowAlert cuando la semana está en rojo, y omite pacientes sin check-ins', async () => {
    vi.restoreAllMocks();
    const lowPatientId = nuevoId();
    const okPatientId = nuevoId();
    const silentPatientId = nuevoId(); // sin check-ins esta semana — no debe aparecer

    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { _id: lowPatientId, firstName: 'Baja', lastName: 'Paciente' },
        { _id: okPatientId, firstName: 'Ok', lastName: 'Paciente' },
        { _id: silentPatientId, firstName: 'Silenciosa', lastName: 'Paciente' }
      ])
    });
    vi.spyOn(WellnessCheckin, 'find').mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { ...makeCheckin(lowPatientId, [1, 1, 1, 1, 1]), scale: 9 },   // promedio 1.0: rojo
        { ...makeCheckin(okPatientId, [8, 8, 8, 8, 8]), scale: 9 }     // promedio 8.0: verde
      ])
    });

    const req = { user: { _id: nuevoId(), role: 'admin' } };
    const res = fakeRes();
    await getTrends(req, res);

    expect(res.body.data.trends).toHaveLength(2); // silentPatientId queda afuera
    const low = res.body.data.trends.find((t) => t.patient._id.toString() === lowPatientId.toString());
    const ok = res.body.data.trends.find((t) => t.patient._id.toString() === okPatientId.toString());
    expect(low.isLowAlert).toBe(true);
    expect(low.weeklyStatus).toBe('red');
    expect(ok.isLowAlert).toBe(false);
    expect(ok.weeklyStatus).toBe('green');
    // los que más atención necesitan, primero
    expect(res.body.data.trends[0].patient._id.toString()).toBe(lowPatientId.toString());
  });
});

describe('GET /wellness/patient/:patientId', () => {
  it('devuelve el historial ordenado, más reciente primero', async () => {
    vi.restoreAllMocks();
    const sortSpy = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ _id: nuevoId(), scale: 9, sleep: 5, energy: 5, stress: 5, soreness: 5, mood: 5 }]) });
    vi.spyOn(WellnessCheckin, 'find').mockReturnValue({ sort: sortSpy });

    const req = { params: { patientId: nuevoId().toString() } };
    const res = fakeRes();
    await getPatientCheckins(req, res);

    expect(sortSpy).toHaveBeenCalledWith({ date: -1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
  });
});
