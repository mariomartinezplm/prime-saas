/**
 * PRUEBAS — EVA (dolor): pertenencia y fecha.
 * Mismo hueco que tenían medidas y ejercicios: un profesional podía crear, editar y
 * borrar registros de pacientes ajenos. Y la fecha pasada debe poder elegirse.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import EVA from '../models/EVA.js';
import { createEVARecord, updateEVARecord, deleteEVARecord } from '../controllers/evaController.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const query = (value) => ({
  select: () => query(value),
  populate: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
});

const PROF_A = nuevoId();
const PROF_B = nuevoId();
const PACIENTE = nuevoId();
const profA = { _id: PROF_A, role: 'professional' };
const profB = { _id: PROF_B, role: 'professional' };

const registro = () => ({
  _id: nuevoId(),
  patient: PACIENTE,
  save: vi.fn().mockResolvedValue(true),
  deleteOne: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedValue(undefined)
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(User, 'findById').mockImplementation((id) =>
    query(id.toString() === PACIENTE.toString()
      ? { _id: PACIENTE, role: 'patient', assignedProfessionalId: PROF_A }
      : null));
});

describe('EVA — pertenencia', () => {
  it('el profesional dueño registra con una fecha pasada y se respeta', async () => {
    const create = vi.spyOn(EVA, 'create').mockResolvedValue(registro());
    const res = fakeRes();

    await createEVARecord({ user: profA, body: { patient: PACIENTE.toString(), painLevel: 5, bodyArea: 'cuello', date: '2026-08-15' } }, res);

    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0].date).toBe('2026-08-15');
  });

  it('un profesional ajeno no registra dolor de ese paciente: 404', async () => {
    const create = vi.spyOn(EVA, 'create');
    const res = fakeRes();

    await createEVARecord({ user: profB, body: { patient: PACIENTE.toString(), painLevel: 5, bodyArea: 'cuello' } }, res);

    expect(res.statusCode).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('fecha futura: 400', async () => {
    const res = fakeRes();
    const enUnMes = new Date(Date.now() + 30 * 864e5).toISOString();

    await createEVARecord({ user: profA, body: { patient: PACIENTE.toString(), painLevel: 5, bodyArea: 'cuello', date: enUnMes } }, res);

    expect(res.statusCode).toBe(400);
  });

  it('un profesional ajeno no edita ni borra: 404 y no toca nada', async () => {
    const r = registro();
    vi.spyOn(EVA, 'findById').mockResolvedValue(r);

    const resPut = fakeRes();
    await updateEVARecord({ user: profB, params: { id: r._id.toString() }, body: { painLevel: 1 } }, resPut);
    const resDel = fakeRes();
    await deleteEVARecord({ user: profB, params: { id: r._id.toString() } }, resDel);

    expect(resPut.statusCode).toBe(404);
    expect(resDel.statusCode).toBe(404);
    expect(r.save).not.toHaveBeenCalled();
    expect(r.deleteOne).not.toHaveBeenCalled();
  });

  it('el profesional dueño puede corregir la fecha de un registro', async () => {
    const r = registro();
    vi.spyOn(EVA, 'findById').mockResolvedValue(r);
    const res = fakeRes();

    await updateEVARecord({ user: profA, params: { id: r._id.toString() }, body: { date: '2026-07-01' } }, res);

    expect(r.date).toBe('2026-07-01');
    expect(r.save).toHaveBeenCalled();
  });
});
