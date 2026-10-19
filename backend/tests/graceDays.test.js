/**
 * PRUEBAS — plazo de pago editable (updateGraceDays). Sin base de datos: spies sobre los modelos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { updateGraceDays } from '../controllers/clientPlanController.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const PACIENTE = nuevoId();
const PROF_A = nuevoId();
const PROF_B = nuevoId();

const fakeRes = () => ({
  status: vi.fn(function (c) { this.statusCode = c; return this; }),
  json: vi.fn(function (b) { this.body = b; return this; })
});
const query = (value) => ({ select: () => query(value), then: (res, rej) => Promise.resolve(value).then(res, rej) });

const plan = (extra = {}) => ({
  _id: nuevoId(), patient: PACIENTE, serviceType: 'entrenamiento', status: 'active', graceDays: 5,
  paymentPending: false, startDate: new Date('2026-10-17T12:00:00Z'), save: vi.fn().mockResolvedValue(true), ...extra
});

describe('updateGraceDays', () => {
  let planes;
  beforeEach(() => {
    vi.restoreAllMocks();
    planes = [plan(), plan({ status: 'upcoming' })];
    vi.spyOn(ClientPlan, 'findById').mockResolvedValue(planes[0]);
    vi.spyOn(ClientPlan, 'find').mockResolvedValue(planes);
    vi.spyOn(User, 'findById').mockReturnValue(query({ _id: PACIENTE, role: 'patient', assignedProfessionalId: PROF_A }));
  });

  it('el profesional del paciente cambia el plazo de todos los ciclos vigentes', async () => {
    const res = fakeRes();
    await updateGraceDays({ params: { id: String(planes[0]._id) }, user: { _id: PROF_A, role: 'professional' }, body: { graceDays: 3 } }, res);
    expect(res.statusCode).toBeUndefined();
    expect(planes.map((p) => p.graceDays)).toEqual([3, 3]);
    expect(planes.every((p) => p.save.mock.calls.length === 1)).toBe(true);
  });

  it('otro profesional no puede (404) y no se guarda nada', async () => {
    const res = fakeRes();
    await updateGraceDays({ params: { id: String(planes[0]._id) }, user: { _id: PROF_B, role: 'professional' }, body: { graceDays: 3 } }, res);
    expect(res.statusCode).toBe(404);
    expect(planes[0].save).not.toHaveBeenCalled();
  });

  it('rechaza plazos inválidos', async () => {
    for (const graceDays of [-1, 31, 2.5, 'x', undefined]) {
      const res = fakeRes();
      await updateGraceDays({ params: { id: String(planes[0]._id) }, user: { _id: PROF_A, role: 'professional' }, body: { graceDays } }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('en una renovación pendiente recalcula la fecha límite; si ya habría pasado, lo rechaza', async () => {
    const empezo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const pendiente = plan({ paymentPending: true, startDate: empezo, paymentDueBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) });
    ClientPlan.findById.mockResolvedValue(pendiente);
    ClientPlan.find.mockResolvedValue([pendiente]);

    const muyCorto = fakeRes();
    await updateGraceDays({ params: { id: String(pendiente._id) }, user: { _id: PROF_A, role: 'professional' }, body: { graceDays: 1 } }, muyCorto);
    expect(muyCorto.statusCode).toBe(400);
    expect(pendiente.save).not.toHaveBeenCalled();

    const ok = fakeRes();
    await updateGraceDays({ params: { id: String(pendiente._id) }, user: { _id: PROF_A, role: 'professional' }, body: { graceDays: 10 } }, ok);
    expect(pendiente.graceDays).toBe(10);
    expect(pendiente.paymentDueBy.getTime()).toBeGreaterThan(Date.now() + 7 * 24 * 60 * 60 * 1000);
  });
});
