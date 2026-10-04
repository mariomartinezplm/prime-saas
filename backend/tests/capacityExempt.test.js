/**
 * PRUEBAS — pacientes "sobre cupo" (User.exemptFromCapacity).
 *
 * Regla de Mario (2026-10-04): hay pacientes que pueden agendar aunque el horario
 * ya tenga 4 pacientes, y que NO cuentan en ese máximo para los demás.
 * El resto de las reglas (4 h de anticipación, saldo de sesiones) sigue igual.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { getDay, parseISO } from 'date-fns';

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import * as emailService from '../services/emailService.js';
import { nowInSantiago } from '../utils/timezone.js';
import { countOverlappingAppointments, isExemptFromCapacity } from '../services/bookingRulesService.js';
import { createAppointment, bulkCreateAppointments } from '../controllers/appointmentController.js';
import { getAvailableSlots } from '../controllers/availabilityController.js';
import { updateUser } from '../controllers/userController.js';

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const PATIENT_ID = nuevoId();
const PROFESSIONAL_ID = nuevoId();
const futureDate = () => new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

function setup({ overlapping, exempt }) {
  vi.restoreAllMocks();
  vi.spyOn(User, 'findById').mockImplementation((id) => {
    const idStr = id.toString();
    if (idStr === PATIENT_ID.toString()) {
      return Promise.resolve({ _id: PATIENT_ID, role: 'patient', isActive: true, exemptFromCapacity: exempt });
    }
    if (idStr === PROFESSIONAL_ID.toString()) return Promise.resolve({ _id: PROFESSIONAL_ID, role: 'professional' });
    return Promise.resolve(null);
  });
  vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
  vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });
  vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
  const countSpy = vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(overlapping);
  vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
  const createSpy = vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({
    ...data,
    _id: nuevoId(),
    populate: vi.fn().mockResolvedValue(undefined)
  }));
  return { countSpy, createSpy };
}

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

describe('agendar en un horario LLENO', () => {
  it('un paciente normal sigue recibiendo 400 (nada cambió para los demás)', async () => {
    const { createSpy } = setup({ overlapping: 4, exempt: false });
    const res = fakeRes();
    await createAppointment(reqOf('patient'), res);
    expect(res.statusCode).toBe(400);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('un paciente sobre cupo agenda con el horario lleno (201), sin pedir allowOverbook', async () => {
    const { createSpy } = setup({ overlapping: 4, exempt: true });
    const res = fakeRes();
    await createAppointment(reqOf('patient'), res);
    expect(res.statusCode).toBe(201);
    expect(createSpy.mock.calls[0][0].outsideCapacity).toBe(true);
    // no es un "sobrecupo puntual del admin": no se marca overbooked
    expect(createSpy.mock.calls[0][0].overbooked).toBe(false);
  });

  it('el personal que agenda PARA un paciente sobre cupo también puede, sin allowOverbook', async () => {
    setup({ overlapping: 4, exempt: true });
    for (const role of ['professional', 'admin']) {
      const res = fakeRes();
      await createAppointment(reqOf(role), res);
      expect(res.statusCode).toBe(201);
    }
  });

  it('en un horario con cupo, una cita sobre cupo igual se marca fuera del conteo', async () => {
    const { createSpy } = setup({ overlapping: 1, exempt: true });
    await createAppointment(reqOf('patient'), fakeRes());
    expect(createSpy.mock.calls[0][0].outsideCapacity).toBe(true);
  });

  it('un paciente normal en horario con cupo NO queda marcado', async () => {
    const { createSpy } = setup({ overlapping: 1, exempt: false });
    await createAppointment(reqOf('patient'), fakeRes());
    expect(createSpy.mock.calls[0][0].outsideCapacity).toBe(false);
  });

  it('las demás reglas siguen: sobre cupo no salta la anticipación de 4 horas', async () => {
    setup({ overlapping: 0, exempt: true });
    const soon = new Date(nowInSantiago().getTime() + 60 * 60 * 1000);
    const res = fakeRes();
    await createAppointment(reqOf('patient', {
      date: soon.toISOString().split('T')[0],
      startTime: `${String(soon.getUTCHours()).padStart(2, '0')}:${String(soon.getUTCMinutes()).padStart(2, '0')}`
    }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BOOKING_WINDOW');
  });

  it('las demás reglas siguen: sin sesiones disponibles no agenda aunque sea sobre cupo', async () => {
    setup({ overlapping: 4, exempt: true });
    ClientPlan.findOne.mockResolvedValue(null);
    const res = fakeRes();
    await createAppointment(reqOf('patient'), res);
    expect(res.statusCode).toBe(403);
  });
});

describe('reserva masiva', () => {
  const item = (hoursAhead) => {
    const target = new Date(nowInSantiago().getTime() + hoursAhead * 60 * 60 * 1000);
    return {
      professional: PROFESSIONAL_ID.toString(),
      date: target.toISOString().split('T')[0],
      startTime: `${String(target.getUTCHours()).padStart(2, '0')}:${String(target.getUTCMinutes()).padStart(2, '0')}`,
      type: 'kinesiologia'
    };
  };

  it('un paciente sobre cupo agenda todo el lote aunque los horarios estén llenos', async () => {
    const { createSpy } = setup({ overlapping: 4, exempt: true });
    const res = fakeRes();
    await bulkCreateAppointments({
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { appointments: [item(48), item(72)] }
    }, res);
    expect(res.body.data.created).toHaveLength(2);
    expect(createSpy.mock.calls.every(([d]) => d.outsideCapacity === true)).toBe(true);
  });

  it('un paciente normal: los horarios llenos se saltan con motivo', async () => {
    setup({ overlapping: 4, exempt: false });
    const res = fakeRes();
    await bulkCreateAppointments({
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { appointments: [item(48), item(72)] }
    }, res);
    expect(res.body.data.created).toHaveLength(0);
    expect(res.body.data.skipped[0].motivo).toMatch(/lleno/i);
  });
});

describe('el conteo del máximo de 4', () => {
  it('la consulta excluye las citas "sobre cupo": no ocupan lugar para los demás', async () => {
    const countSpy = vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0);
    await countOverlappingAppointments(PROFESSIONAL_ID, futureDate(), '10:00');
    expect(countSpy.mock.calls[0][0]).toMatchObject({ outsideCapacity: { $ne: true }, status: { $ne: 'cancelled' } });
  });

  it('isExemptFromCapacity: solo es verdadero para un paciente marcado', async () => {
    vi.restoreAllMocks();
    const docs = {
      si: { role: 'patient', exemptFromCapacity: true },
      no: { role: 'patient', exemptFromCapacity: false },
      sinCampo: { role: 'patient' },
      personalMarcado: { role: 'professional', exemptFromCapacity: true }
    };
    vi.spyOn(User, 'findById').mockImplementation((id) => Promise.resolve(docs[id] ?? null));

    expect(await isExemptFromCapacity('si')).toBe(true);
    expect(await isExemptFromCapacity('no')).toBe(false);
    expect(await isExemptFromCapacity('sinCampo')).toBe(false);
    expect(await isExemptFromCapacity('personalMarcado')).toBe(false);
    expect(await isExemptFromCapacity('inexistente')).toBe(false);
    expect(await isExemptFromCapacity(undefined)).toBe(false);
  });
});

describe('listado de horarios', () => {
  const slotsReq = (user, query = {}) => ({
    user,
    query,
    params: { professionalId: PROFESSIONAL_ID.toString(), date: '2026-09-14' }
  });

  const prepare = (exempt) => {
    setup({ overlapping: 4, exempt });
    vi.spyOn(Availability, 'findOne').mockResolvedValue({
      weeklySchedule: [{ dayOfWeek: getDay(parseISO('2026-09-14')), slots: [{ startTime: '10:00' }] }],
      blockedDates: []
    });
  };

  it('un paciente normal ve el horario lleno como "reservado"', async () => {
    prepare(false);
    const res = fakeRes();
    await getAvailableSlots(slotsReq({ _id: PATIENT_ID, role: 'patient' }), res);
    expect(res.body.data.bookedSlots).toContain('10:00');
    expect(res.body.data.availableSlots).not.toContain('10:00');
  });

  it('un paciente sobre cupo ve el mismo horario como disponible', async () => {
    prepare(true);
    const res = fakeRes();
    await getAvailableSlots(slotsReq({ _id: PATIENT_ID, role: 'patient' }), res);
    expect(res.body.data.availableSlots).toContain('10:00');
    expect(res.body.data.bookedSlots).not.toContain('10:00');
  });

  it('el personal que agenda para un paciente sobre cupo (?patientId=) lo ve disponible', async () => {
    prepare(true);
    const res = fakeRes();
    await getAvailableSlots(slotsReq({ _id: nuevoId(), role: 'professional' }, { patientId: PATIENT_ID.toString() }), res);
    expect(res.body.data.availableSlots).toContain('10:00');
  });

  it('el personal sin indicar paciente lo ve lleno, como siempre', async () => {
    prepare(true);
    const res = fakeRes();
    await getAvailableSlots(slotsReq({ _id: nuevoId(), role: 'admin' }), res);
    expect(res.body.data.bookedSlots).toContain('10:00');
  });
});

describe('quién puede marcar a un paciente sobre cupo', () => {
  const query = (value) => ({
    select: () => query(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
  });
  const PROF = nuevoId();

  const prep = () => {
    vi.restoreAllMocks();
    const paciente = {
      _id: PATIENT_ID, role: 'patient', assignedProfessionalId: PROF,
      exemptFromCapacity: false, save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(User, 'findById').mockImplementation(() => query(paciente));
    return paciente;
  };
  const pedido = (user, body) => ({ params: { id: PATIENT_ID.toString() }, user, body });

  it('el admin lo activa y lo desactiva', async () => {
    const paciente = prep();
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { exemptFromCapacity: true }), fakeRes());
    expect(paciente.exemptFromCapacity).toBe(true);
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { exemptFromCapacity: false }), fakeRes());
    expect(paciente.exemptFromCapacity).toBe(false);
  });

  it('un profesional (aunque sea el dueño) NO puede: se ignora el campo', async () => {
    const paciente = prep();
    const res = fakeRes();
    await updateUser(pedido({ _id: PROF, role: 'professional' }, { exemptFromCapacity: true, phone: '+56911111111' }), res);
    expect(paciente.exemptFromCapacity).toBe(false);
    expect(paciente.phone).toBe('+56911111111'); // lo demás sí se guarda
  });

  it('un valor que no es verdadero/falso se rechaza con 400', async () => {
    const paciente = prep();
    const res = fakeRes();
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { exemptFromCapacity: 'si' }), res);
    expect(res.statusCode).toBe(400);
    expect(paciente.save).not.toHaveBeenCalled();
  });
});
