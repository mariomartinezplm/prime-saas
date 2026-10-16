/**
 * PRUEBAS — autorización y validaciones del horario fijo (controllers/recurringSlotController.js).
 *
 * Quién puede ver, crear, pausar y borrar un horario fijo, y qué se rechaza. El motor de agendado se prueba aparte
 * (recurringSlots.test.js); aquí `syncSlot` se reemplaza para no tocar ninguna base.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Availability from '../models/Availability.js';
import RecurringSlot from '../models/RecurringSlot.js';
import * as clientPlanService from '../services/clientPlanService.js';
import { MAX_RECURRING_SLOTS } from '../services/recurringSlotService.js';
import {
  getPatientSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  toSlotView
} from '../controllers/recurringSlotController.js';

vi.mock('../services/recurringSlotService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  syncSlot: vi.fn(async () => ({ created: [], skipped: [], pendingPayment: 0 }))
}));

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const query = (value) => ({
  select: () => query(value),
  sort: () => query(value),
  populate: () => query(value),
  lean: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
});

const MI_ID = nuevoId();
const OTRO_PRO = nuevoId();
const P_MIO = nuevoId();
const P_AJENO = nuevoId();
const P_OTRO_PACIENTE = nuevoId();

const usuarios = {
  [P_MIO]: { _id: P_MIO, role: 'patient', isActive: true, assignedProfessionalId: MI_ID },
  [P_AJENO]: { _id: P_AJENO, role: 'patient', isActive: true, assignedProfessionalId: OTRO_PRO },
  [P_OTRO_PACIENTE]: { _id: P_OTRO_PACIENTE, role: 'patient', isActive: true, assignedProfessionalId: MI_ID }
};

const yoPaciente = { _id: P_MIO, role: 'patient' };
const yoProfesional = { _id: MI_ID, role: 'professional' };
const yoAdmin = { _id: nuevoId(), role: 'admin' };

const slotDoc = (over = {}) => ({
  _id: nuevoId(),
  patient: P_MIO,
  professional: MI_ID,
  dayOfWeek: 1,
  startTime: '18:00',
  type: 'entrenamiento',
  active: true,
  skipped: [],
  createdBy: nuevoId(),
  save: vi.fn().mockResolvedValue(true),
  deleteOne: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedValue(undefined),
  toObject() { const { save, deleteOne, populate, toObject, ...rest } = this; return rest; },
  ...over
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(User, 'findById').mockImplementation((id) => query(usuarios[id.toString()] ?? null));
  vi.spyOn(Availability, 'findOne').mockImplementation(() => query({ weeklySchedule: [{ dayOfWeek: 1, slots: [{ startTime: '18:00' }] }], blockedDates: [] }));
  vi.spyOn(clientPlanService, 'getActivePlanByType').mockResolvedValue({ _id: nuevoId(), endDate: new Date('2026-12-31') });
  vi.spyOn(RecurringSlot, 'countDocuments').mockResolvedValue(0);
});

const reqCrear = (user, body) => ({ user, body });

describe('toSlotView: lista cerrada', () => {
  it('no deja salir quién lo creó ni las fechas «ya tenía otra cita»', () => {
    const view = toSlotView(slotDoc({
      skipped: [
        { date: '2026-10-19', code: 'FULL', notifiedAt: new Date() },
        { date: '2026-10-26', code: 'ALREADY_BOOKED', notifiedAt: new Date() }
      ]
    }));
    expect(view.createdBy).toBeUndefined();
    expect(view.skipped).toHaveLength(1);
    expect(view.skipped[0]).toMatchObject({ date: '2026-10-19', code: 'FULL' });
    expect(view.skipped[0].notifiedAt).toBeUndefined();
  });
});

describe('crear un horario fijo (POST /recurring-slots)', () => {
  const crearEnBase = () => vi.spyOn(RecurringSlot, 'create').mockImplementation(async (data) => slotDoc(data));

  it('el paciente crea el suyo: el servidor ignora cualquier otro paciente que mande el formulario', async () => {
    const crear = crearEnBase();
    const res = fakeRes();
    await createSlot(reqCrear(yoPaciente, { dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento', patient: P_AJENO }), res);

    expect(res.statusCode).toBe(201);
    expect(String(crear.mock.calls[0][0].patient)).toBe(String(P_MIO));
    // el profesional siempre es el asignado al paciente (nunca uno elegido por el formulario)
    expect(String(crear.mock.calls[0][0].professional)).toBe(String(MI_ID));
  });

  it('valida el día, la hora y el tipo (evaluación no consume sesión: no se puede dejar fijo)', async () => {
    crearEnBase();
    for (const body of [
      { dayOfWeek: 0, startTime: '18:00', type: 'entrenamiento' },
      { dayOfWeek: 7, startTime: '18:00', type: 'entrenamiento' },
      { dayOfWeek: 1, startTime: '25:00', type: 'entrenamiento' },
      { dayOfWeek: 1, startTime: '18:00', type: 'evaluacion' }
    ]) {
      const res = fakeRes();
      await createSlot(reqCrear(yoPaciente, body), res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('sin plan vigente de ese tipo: 403', async () => {
    crearEnBase();
    clientPlanService.getActivePlanByType.mockResolvedValue(null);
    const res = fakeRes();
    await createSlot(reqCrear(yoPaciente, { dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento' }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_ACTIVE_PLAN_SESSIONS');
  });

  it('una hora fuera de la atención del profesional: 400', async () => {
    crearEnBase();
    const res = fakeRes();
    await createSlot(reqCrear(yoPaciente, { dayOfWeek: 1, startTime: '20:00', type: 'entrenamiento' }), res);

    expect(res.statusCode).toBe(400);
  });

  it(`máximo ${MAX_RECURRING_SLOTS} horarios fijos por paciente`, async () => {
    crearEnBase();
    RecurringSlot.countDocuments.mockResolvedValue(MAX_RECURRING_SLOTS);
    const res = fakeRes();
    await createSlot(reqCrear(yoPaciente, { dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento' }), res);

    expect(res.statusCode).toBe(409);
  });

  it('un segundo horario el mismo día de la semana: 409', async () => {
    vi.spyOn(RecurringSlot, 'create').mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const res = fakeRes();
    await createSlot(reqCrear(yoPaciente, { dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento' }), res);

    expect(res.statusCode).toBe(409);
  });

  it('un profesional solo crea para pacientes a los que puede acceder (404 si no, sin crear nada)', async () => {
    const crear = crearEnBase();
    const res = fakeRes();
    await createSlot(reqCrear(yoProfesional, { patient: P_AJENO, dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento' }), res);

    expect(res.statusCode).toBe(404);
    expect(crear).not.toHaveBeenCalled();
  });

  it('un profesional crea para un paciente suyo', async () => {
    crearEnBase();
    const res = fakeRes();
    await createSlot(reqCrear(yoProfesional, { patient: P_OTRO_PACIENTE, dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento' }), res);

    expect(res.statusCode).toBe(201);
  });
});

describe('ver horarios fijos', () => {
  it('el paciente solo ve los suyos (pedir los de otro responde 404)', async () => {
    vi.spyOn(RecurringSlot, 'find').mockImplementation(() => query([slotDoc()]));

    const propio = fakeRes();
    await getPatientSlots({ user: yoPaciente, params: { patientId: 'me' } }, propio);
    expect(propio.statusCode ?? 200).toBe(200);
    expect(propio.body.data.slots).toHaveLength(1);

    const ajeno = fakeRes();
    await getPatientSlots({ user: yoPaciente, params: { patientId: String(P_AJENO) } }, ajeno);
    expect(ajeno.statusCode).toBe(404);
  });
});

describe('pausar y borrar (pertenencia)', () => {
  const reqSlot = (user, doc, body = {}) => {
    vi.spyOn(RecurringSlot, 'findById').mockImplementation(() => query(doc));
    return { user, params: { id: String(doc._id) }, body };
  };

  it('el paciente borra el suyo, y las citas ya agendadas se mantienen (solo se borra la regla)', async () => {
    const doc = slotDoc();
    const res = fakeRes();
    await deleteSlot(reqSlot(yoPaciente, doc), res);

    expect(doc.deleteOne).toHaveBeenCalled();
    expect(res.body.message).toMatch(/se mantienen/);
  });

  it('el horario de otro paciente: 404 y sin efectos', async () => {
    const doc = slotDoc({ patient: P_AJENO });
    const res = fakeRes();
    await deleteSlot(reqSlot(yoPaciente, doc), res);

    expect(res.statusCode).toBe(404);
    expect(doc.deleteOne).not.toHaveBeenCalled();
  });

  it('un profesional no toca el horario de un paciente de un colega', async () => {
    const doc = slotDoc({ patient: P_AJENO });
    const res = fakeRes();
    await updateSlot(reqSlot(yoProfesional, doc, { active: false }), res);

    expect(res.statusCode).toBe(404);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('el administrador puede pausar cualquiera', async () => {
    const doc = slotDoc({ patient: P_AJENO });
    const res = fakeRes();
    await updateSlot(reqSlot(yoAdmin, doc, { active: false }), res);

    expect(res.statusCode ?? 200).toBe(200);
    expect(doc.active).toBe(false);
  });

  it('pausar exige un valor claro (true/false)', async () => {
    const doc = slotDoc();
    const res = fakeRes();
    await updateSlot(reqSlot(yoPaciente, doc, { active: 'si' }), res);

    expect(res.statusCode).toBe(400);
  });
});
