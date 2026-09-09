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
import { createCheckin, getTodayCheckin } from '../controllers/wellnessController.js';

vi.mock('../services/clientPlanService.js', () => ({
  hasActivePlan: vi.fn()
}));
import { hasActivePlan } from '../services/clientPlanService.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const baseBody = () => ({ sleep: 4, energy: 4, stress: 4, soreness: 4, mood: 4 });

describe('POST /wellness — check-in diario', () => {
  it('con plan activo: crea el check-in (201)', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const createSpy = vi.spyOn(WellnessCheckin, 'create').mockImplementation(async (data) => ({
      ...data,
      average: () => (data.sleep + data.energy + data.stress + data.soreness + data.mood) / 5
    }));

    const patientId = nuevoId();
    const req = { user: { _id: patientId }, body: baseBody() };
    const res = fakeRes();

    await createCheckin(req, res);

    expect(res.statusCode).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ patient: patientId, sleep: 4 }));
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

  it('promedio < 2.5: crea la alerta wellness_alert para el profesional asignado', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    const patientId = nuevoId();
    const profId = nuevoId();

    vi.spyOn(WellnessCheckin, 'create').mockImplementation(async (data) => ({
      ...data,
      average: () => (data.sleep + data.energy + data.stress + data.soreness + data.mood) / 5
    }));
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ firstName: 'Ana', lastName: 'Paciente', assignedProfessionalId: profId })
    });
    const notifSpy = vi.spyOn(Notification, 'create').mockResolvedValue({ _id: nuevoId() });

    const req = {
      user: { _id: patientId },
      body: { sleep: 1, energy: 2, stress: 1, soreness: 2, mood: 1 } // promedio 1.4
    };
    const res = fakeRes();

    await createCheckin(req, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.statusCode).toBe(201);
    expect(notifSpy).toHaveBeenCalledWith(expect.objectContaining({ user: profId, type: 'wellness_alert' }));
  });

  it('promedio >= 2.5: NO crea ninguna alerta', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    vi.spyOn(WellnessCheckin, 'create').mockImplementation(async (data) => ({
      ...data,
      average: () => (data.sleep + data.energy + data.stress + data.soreness + data.mood) / 5
    }));
    const findByIdSpy = vi.spyOn(User, 'findById');
    const notifSpy = vi.spyOn(Notification, 'create');

    const req = { user: { _id: nuevoId() }, body: baseBody() }; // promedio 4
    const res = fakeRes();

    await createCheckin(req, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.statusCode).toBe(201);
    expect(findByIdSpy).not.toHaveBeenCalled();
    expect(notifSpy).not.toHaveBeenCalled();
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
    const checkin = { _id: nuevoId(), sleep: 4 };
    vi.spyOn(WellnessCheckin, 'findOne').mockResolvedValue(checkin);

    const req = { user: { _id: nuevoId() } };
    const res = fakeRes();
    await getTodayCheckin(req, res);

    expect(res.body.data.checkin).toEqual(checkin);
  });
});
