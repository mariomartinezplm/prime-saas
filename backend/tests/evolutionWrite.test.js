/**
 * PRUEBAS — registrar medidas y ejercicios (paciente y personal).
 *
 * Reglas que protegen:
 *  - Un profesional NO escribe, edita, borra ni compara datos de pacientes ajenos.
 *  - El paciente solo escribe lo suyo, y solo con plan activo.
 *  - Los tests de salto y los perímetros nuevos (hombros/cuello) se guardan.
 *  - Una fecha futura se rechaza; ya no se aceptan fotos por URL en la medición.
 *
 * Mismo patrón que invite.test.js: vitest + vi.spyOn, sin base de datos.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import * as clientPlanService from '../services/clientPlanService.js';
import * as notificationService from '../services/notificationService.js';
import {
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
  compareMeasurements
} from '../controllers/measurementController.js';
import {
  createExerciseProgress,
  updateExerciseProgress,
  deleteExerciseProgress
} from '../controllers/exerciseController.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const query = (value) => ({
  select: () => query(value),
  populate: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  catch: (reject) => Promise.resolve(value).catch(reject)
});

const PROF_A = nuevoId();
const PROF_B = nuevoId();
const PACIENTE = nuevoId();
const ADMIN = nuevoId();

const profA = { _id: PROF_A, role: 'professional' };
const profB = { _id: PROF_B, role: 'professional' };
const admin = { _id: ADMIN, role: 'admin' };
const paciente = { _id: PACIENTE, role: 'patient' };

// El paciente PACIENTE pertenece al profesional A
function mockUsuarios() {
  vi.spyOn(User, 'findById').mockImplementation((id) => {
    if (id.toString() === PACIENTE.toString()) {
      return query({ _id: PACIENTE, role: 'patient', assignedProfessionalId: PROF_A });
    }
    return query(null);
  });
}

const docGuardable = (extra = {}) => ({
  populate: vi.fn().mockResolvedValue(undefined),
  ...extra
});

describe('createMeasurement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsuarios();
    vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
    vi.spyOn(clientPlanService, 'hasActivePlan').mockResolvedValue(true);
  });

  it('el profesional dueño registra una medición con saltos, hombros y cuello', async () => {
    const create = vi.spyOn(Measurement, 'create').mockResolvedValue(docGuardable());
    const res = fakeRes();

    await createMeasurement({
      user: profA,
      body: {
        patient: PACIENTE.toString(),
        weight: 70,
        bodyFatPercentage: 18.5,
        perimeters: { shoulders: 110, neck: 38 },
        jumpTests: { cmj: 32, sj: 29 }
      }
    }, res);

    expect(res.statusCode).toBe(201);
    const datos = create.mock.calls[0][0];
    expect(datos.jumpTests).toEqual({ cmj: 32, sj: 29 });
    expect(datos.perimeters).toEqual({ shoulders: 110, neck: 38 });
    expect(datos.bodyFatPercentage).toBe(18.5);
  });

  it('un profesional NO registra una medición para un paciente de otro profesional: 404', async () => {
    const create = vi.spyOn(Measurement, 'create');
    const res = fakeRes();

    await createMeasurement({ user: profB, body: { patient: PACIENTE.toString(), weight: 70 } }, res);

    expect(res.statusCode).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('el admin registra para cualquiera', async () => {
    vi.spyOn(Measurement, 'create').mockResolvedValue(docGuardable());
    const res = fakeRes();

    await createMeasurement({ user: admin, body: { patient: PACIENTE.toString(), weight: 70 } }, res);

    expect(res.statusCode).toBe(201);
  });

  it('el paciente registra la suya (ignora el paciente que venga en el cuerpo) y se avisa al profesional', async () => {
    const create = vi.spyOn(Measurement, 'create').mockResolvedValue(docGuardable());
    const res = fakeRes();

    await createMeasurement({ user: paciente, body: { patient: nuevoId().toString(), weight: 70, bodyFatPercentage: 20 } }, res);

    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0].patient).toBe(PACIENTE);
    expect(notificationService.notify).toHaveBeenCalledTimes(1);
  });

  it('el paciente con plan vencido no puede registrar: 403 con código para mostrar WhatsApp', async () => {
    clientPlanService.hasActivePlan.mockResolvedValue(false);
    const create = vi.spyOn(Measurement, 'create');
    const res = fakeRes();

    await createMeasurement({ user: paciente, body: { weight: 70 } }, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
    expect(create).not.toHaveBeenCalled();
  });

  it('una fecha futura se rechaza (no puede quedar como "última medición")', async () => {
    const create = vi.spyOn(Measurement, 'create');
    const res = fakeRes();
    const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await createMeasurement({ user: paciente, body: { weight: 70, date: enUnMes } }, res);

    expect(res.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('una fecha pasada se acepta (el paciente carga un resultado antiguo)', async () => {
    const create = vi.spyOn(Measurement, 'create').mockResolvedValue(docGuardable());
    const res = fakeRes();

    await createMeasurement({ user: paciente, body: { weight: 70, date: '2026-08-01' } }, res);

    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0].date).toBe('2026-08-01');
  });

  it('ya no se aceptan fotos por URL en la medición', async () => {
    const create = vi.spyOn(Measurement, 'create').mockResolvedValue(docGuardable());

    await createMeasurement({
      user: paciente,
      body: { weight: 70, photos: [{ url: 'https://malicioso.example/x.jpg', position: 'front' }] }
    }, fakeRes());

    expect(create.mock.calls[0][0]).not.toHaveProperty('photos');
  });
});

describe('updateMeasurement / deleteMeasurement / compareMeasurements — pertenencia', () => {
  const medicion = (extra = {}) => ({
    _id: nuevoId(),
    patient: PACIENTE,
    perimeters: { toObject: () => ({}) },
    jumpTests: { toObject: () => ({}) },
    save: vi.fn().mockResolvedValue(true),
    deleteOne: vi.fn().mockResolvedValue(true),
    populate: vi.fn().mockResolvedValue(undefined),
    ...extra
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsuarios();
    vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
    vi.spyOn(clientPlanService, 'hasActivePlan').mockResolvedValue(true);
  });

  it('un profesional ajeno no edita una medición: 404 y no guarda', async () => {
    const m = medicion();
    vi.spyOn(Measurement, 'findById').mockResolvedValue(m);
    const res = fakeRes();

    await updateMeasurement({ user: profB, params: { id: m._id.toString() }, body: { weight: 1 } }, res);

    expect(res.statusCode).toBe(404);
    expect(m.save).not.toHaveBeenCalled();
  });

  it('el profesional dueño edita y puede corregir los saltos', async () => {
    const m = medicion();
    vi.spyOn(Measurement, 'findById').mockResolvedValue(m);
    const res = fakeRes();

    await updateMeasurement({ user: profA, params: { id: m._id.toString() }, body: { jumpTests: { cmj: 35 } } }, res);

    expect(res.statusCode).toBe(200);
    expect(m.jumpTests).toEqual({ cmj: 35 });
    expect(m.save).toHaveBeenCalled();
  });

  it('un profesional ajeno no borra una medición: 404', async () => {
    const m = medicion();
    vi.spyOn(Measurement, 'findById').mockResolvedValue(m);
    const res = fakeRes();

    await deleteMeasurement({ user: profB, params: { id: m._id.toString() } }, res);

    expect(res.statusCode).toBe(404);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });

  it('un profesional ajeno no compara las mediciones de un paciente: 404', async () => {
    const a = medicion();
    const b = medicion();
    vi.spyOn(Measurement, 'findById').mockImplementation((id) => Promise.resolve(id === 'a' ? a : b));
    const res = fakeRes();

    await compareMeasurements({ user: profB, params: { id1: 'a', id2: 'b' } }, res);

    expect(res.statusCode).toBe(404);
  });

  it('un paciente no compara las de otro paciente: 404', async () => {
    const otro = nuevoId();
    const a = medicion({ patient: otro });
    const b = medicion({ patient: otro });
    vi.spyOn(Measurement, 'findById').mockImplementation((id) => Promise.resolve(id === 'a' ? a : b));
    const res = fakeRes();

    await compareMeasurements({ user: paciente, params: { id1: 'a', id2: 'b' } }, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('ejercicios — pertenencia, plan y fecha', () => {
  const ejercicio = (extra = {}) => ({
    _id: nuevoId(),
    patient: PACIENTE,
    save: vi.fn().mockResolvedValue(true),
    deleteOne: vi.fn().mockResolvedValue(true),
    populate: vi.fn().mockResolvedValue(undefined),
    ...extra
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsuarios();
    vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
    vi.spyOn(clientPlanService, 'hasActivePlan').mockResolvedValue(true);
  });

  it('el paciente registra su ejercicio con plan activo', async () => {
    const create = vi.spyOn(ExerciseProgress, 'create').mockResolvedValue(ejercicio());
    const res = fakeRes();

    await createExerciseProgress({ user: paciente, body: { exerciseName: 'Sentadilla', category: 'fuerza', weight: 100, reps: 8 } }, res);

    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({ patient: PACIENTE, exerciseName: 'Sentadilla', weight: 100, reps: 8 });
  });

  it('plan vencido: 403 y no se guarda', async () => {
    clientPlanService.hasActivePlan.mockResolvedValue(false);
    const create = vi.spyOn(ExerciseProgress, 'create');
    const res = fakeRes();

    await createExerciseProgress({ user: paciente, body: { exerciseName: 'Sentadilla' } }, res);

    expect(res.statusCode).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('un profesional ajeno no registra un ejercicio para ese paciente: 404', async () => {
    const create = vi.spyOn(ExerciseProgress, 'create');
    const res = fakeRes();

    await createExerciseProgress({ user: profB, body: { patient: PACIENTE.toString(), exerciseName: 'Sentadilla' } }, res);

    expect(res.statusCode).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('fecha futura: 400', async () => {
    const res = fakeRes();
    const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await createExerciseProgress({ user: paciente, body: { exerciseName: 'Sentadilla', date: enUnMes } }, res);

    expect(res.statusCode).toBe(400);
  });

  it('un profesional ajeno no edita ni borra un ejercicio: 404', async () => {
    const e = ejercicio();
    vi.spyOn(ExerciseProgress, 'findById').mockResolvedValue(e);

    const resPut = fakeRes();
    await updateExerciseProgress({ user: profB, params: { id: e._id.toString() }, body: { weight: 1 } }, resPut);
    const resDel = fakeRes();
    await deleteExerciseProgress({ user: profB, params: { id: e._id.toString() } }, resDel);

    expect(resPut.statusCode).toBe(404);
    expect(resDel.statusCode).toBe(404);
    expect(e.save).not.toHaveBeenCalled();
    expect(e.deleteOne).not.toHaveBeenCalled();
  });
});
