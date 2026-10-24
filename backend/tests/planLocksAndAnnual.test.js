/**
 * PRUEBAS — horarios ocultos sin plan vigente, anual solo para el administrador y evaluación no agendable por el paciente.
 * Mismo patrón que el resto de backend/tests/ (vitest, sin base real).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Availability from '../models/Availability.js';
import { getAvailableSlots } from '../controllers/availabilityController.js';
import { createClientPlan } from '../controllers/clientPlanController.js';
import { checkTypeBookableByPatient } from '../services/bookingGuards.js';
import * as planService from '../services/clientPlanService.js';

vi.mock('../services/clientPlanService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getSessionBalanceByType: vi.fn()
}));

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const slotsReq = (role) => ({ user: { _id: id(), role }, params: { professionalId: String(id()), date: '2026-11-10' } });

describe('horarios disponibles: un paciente sin plan vigente no los ve', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Availability, 'findOne').mockResolvedValue(null);
    planService.getSessionBalanceByType.mockReset();
  });

  it('sin sesiones en ningún plan: respuesta vacía con aviso y sin consultar la agenda', async () => {
    planService.getSessionBalanceByType.mockResolvedValue({ totalAvailable: 0 });
    const res = fakeRes();
    await getAvailableSlots(slotsReq('patient'), res);
    expect(res.statusCode ?? 200).toBe(200);
    expect(res.body.data).toMatchObject({ planLocked: true, availableSlots: [], bookedSlots: [], blockedSlots: [] });
    expect(res.body.data.message).toMatch(/plan vigente/);
    expect(Availability.findOne).not.toHaveBeenCalled();
  });

  it('con sesiones en entrenamiento (aunque no en kinesiología) sí ve los horarios', async () => {
    planService.getSessionBalanceByType.mockImplementation(async (_p, type) => ({ totalAvailable: type === 'entrenamiento' ? 3 : 0 }));
    const res = fakeRes();
    await getAvailableSlots(slotsReq('patient'), res);
    expect(res.body.data.planLocked).toBeUndefined();
    expect(Availability.findOne).toHaveBeenCalled();
  });

  it('el personal siempre ve los horarios y no se le mira el plan', async () => {
    for (const role of ['admin', 'professional']) {
      const res = fakeRes();
      await getAvailableSlots(slotsReq(role), res);
      expect(res.body.data.planLocked).toBeUndefined();
    }
    expect(planService.getSessionBalanceByType).not.toHaveBeenCalled();
  });
});

describe('plan anual: solo el administrador', () => {
  const body = { patientId: String(id()), serviceType: 'entrenamiento', sessionsTotal: 8, term: 'anual' };

  it('un profesional recibe 403 antes de tocar nada', async () => {
    const res = fakeRes();
    await createClientPlan({ user: { _id: id(), role: 'professional' }, body, params: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/administrador/);
  });
});

describe('tipos de cita que un paciente puede agendar', () => {
  it('solo kinesiología y entrenamiento; evaluación y otros los agenda el centro', () => {
    expect(checkTypeBookableByPatient('kinesiologia')).toBeNull();
    expect(checkTypeBookableByPatient('entrenamiento')).toBeNull();
    expect(checkTypeBookableByPatient('evaluacion')).toMatchObject({ status: 403, body: { code: 'TYPE_NOT_ALLOWED' } });
  });
});
