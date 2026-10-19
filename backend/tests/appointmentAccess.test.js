/**
 * PRUEBAS — pertenencia de las citas (GET/PUT/cancel/.ics de una cita, y crear/crear en lote).
 *
 * Regla (BLUEPRINT.md §8.5, misma que `canAccessPatient`):
 *   admin        → todas
 *   patient      → solo las suyas (403 si es de otro, como siempre)
 *   professional → las suyas o las de un paciente que le pertenece (asignado o del pool sin
 *                  profesional); la cita de un paciente ajeno responde 404, sin efectos.
 * Antes un profesional podía leer (con datos clínicos), modificar, cancelar o agendar a nombre
 * de pacientes de otros profesionales.
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import * as emailService from '../services/emailService.js';
import * as notificationService from '../services/notificationService.js';
import * as icsService from '../services/icsService.js';
import {
  getAppointment,
  getAppointmentICS,
  cancelAppointment,
  updateAppointment,
  createAppointment,
  bulkCreateAppointments,
  deleteAppointment
} from '../controllers/appointmentController.js';
import { triggerAchievementEvaluation } from '../services/achievements/index.js';

vi.mock('../services/achievements/index.js', () => ({
  triggerAchievementEvaluation: vi.fn(async () => {})
}));

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; }),
  setHeader: vi.fn(),
  send: vi.fn(function (body) { this.body = body; return this; })
});

const MI_ID = nuevoId();            // el profesional que llama
const OTRO_PRO_ID = nuevoId();      // un colega
const PACIENTE_MIO = nuevoId();     // asignado a mí
const PACIENTE_AJENO = nuevoId();   // asignado al colega
const PACIENTE_POOL = nuevoId();    // sin profesional asignado

const pacientes = {
  [PACIENTE_MIO]: { _id: PACIENTE_MIO, role: 'patient', isActive: true, assignedProfessionalId: MI_ID },
  [PACIENTE_AJENO]: { _id: PACIENTE_AJENO, role: 'patient', isActive: true, assignedProfessionalId: OTRO_PRO_ID },
  [PACIENTE_POOL]: { _id: PACIENTE_POOL, role: 'patient', isActive: true }
};

// Consulta que se puede esperar directo o encadenar (.select / .populate)
const query = (value) => ({
  select: () => query(value),
  populate: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
});

const profesional = { _id: MI_ID, role: 'professional' };
const admin = { _id: nuevoId(), role: 'admin' };

// Una cita de `pacienteId` agendada con `proId`
const cita = (pacienteId, proId = OTRO_PRO_ID, extra = {}) => ({
  _id: nuevoId(),
  patient: { _id: pacienteId, firstName: 'Ana', lastName: 'Pérez' },
  professional: { _id: proId, firstName: 'Colega', lastName: 'Demo' },
  status: 'scheduled',
  sessionDeducted: false,
  date: new Date(Date.now() + 72 * 3600 * 1000),
  startTime: '10:00',
  save: vi.fn().mockResolvedValue(true),
  populate: vi.fn().mockResolvedValue(undefined),
  ...extra
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(User, 'findById').mockImplementation((id) => query(pacientes[id.toString()] ?? null));
  vi.spyOn(emailService, 'sendAppointmentCancelledEmail').mockImplementation(() => {});
  vi.spyOn(emailService, 'sendAppointmentUpdatedEmail').mockImplementation(() => {});
  vi.spyOn(notificationService, 'notify').mockResolvedValue(undefined);
  vi.spyOn(icsService, 'generateAppointmentICS').mockReturnValue('BEGIN:VCALENDAR');
});

const reqCita = (user, doc, body = {}) => {
  vi.spyOn(Appointment, 'findById').mockImplementation(() => query(doc));
  return { user, params: { id: doc._id.toString() }, body };
};

describe('leer una cita (GET /appointments/:id)', () => {
  it('el profesional ve una cita suya, aunque el paciente sea de otro', async () => {
    const res = fakeRes();
    await getAppointment(reqCita(profesional, cita(PACIENTE_AJENO, MI_ID)), res);
    expect(res.statusCode).toBe(200);
  });

  it('el profesional ve la cita de un paciente suyo agendada con un colega', async () => {
    const res = fakeRes();
    await getAppointment(reqCita(profesional, cita(PACIENTE_MIO, OTRO_PRO_ID)), res);
    expect(res.statusCode).toBe(200);
  });

  it('el profesional ve la cita de un paciente del pool (sin profesional asignado)', async () => {
    const res = fakeRes();
    await getAppointment(reqCita(profesional, cita(PACIENTE_POOL, OTRO_PRO_ID)), res);
    expect(res.statusCode).toBe(200);
  });

  it('la cita de un paciente de otro profesional responde 404 y NO devuelve datos', async () => {
    const res = fakeRes();
    await getAppointment(reqCita(profesional, cita(PACIENTE_AJENO, OTRO_PRO_ID)), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Cita no encontrada');
    expect(res.body.data).toBeUndefined();
  });

  it('el admin ve cualquiera', async () => {
    const res = fakeRes();
    await getAppointment(reqCita(admin, cita(PACIENTE_AJENO, OTRO_PRO_ID)), res);
    expect(res.statusCode).toBe(200);
  });

  it('el paciente ve la suya y recibe 403 con la de otra persona (sin cambios)', async () => {
    const yo = { _id: PACIENTE_MIO, role: 'patient' };
    let res = fakeRes();
    await getAppointment(reqCita(yo, cita(PACIENTE_MIO)), res);
    expect(res.statusCode).toBe(200);

    res = fakeRes();
    await getAppointment(reqCita(yo, cita(PACIENTE_AJENO)), res);
    expect(res.statusCode).toBe(403);
  });
});

describe('descargar el .ics', () => {
  it('un profesional no puede bajar el archivo de la cita de un paciente ajeno', async () => {
    const res = fakeRes();
    await getAppointmentICS(reqCita(profesional, cita(PACIENTE_AJENO, OTRO_PRO_ID)), res);
    expect(res.statusCode).toBe(404);
    expect(icsService.generateAppointmentICS).not.toHaveBeenCalled();
  });

  it('sí puede con la de un paciente suyo', async () => {
    const res = fakeRes();
    await getAppointmentICS(reqCita(profesional, cita(PACIENTE_MIO, OTRO_PRO_ID)), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('modificar una cita (PUT /appointments/:id)', () => {
  it('un profesional no puede modificar la cita de un paciente ajeno: 404 y nada se guarda', async () => {
    const doc = cita(PACIENTE_AJENO, OTRO_PRO_ID);
    const res = fakeRes();
    await updateAppointment(reqCita(profesional, doc, { status: 'completed', sessionNotes: 'x' }), res);

    expect(res.statusCode).toBe(404);
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.status).toBe('scheduled');
    expect(doc.sessionNotes).toBeUndefined();
  });

  it('sí puede con una cita suya o de un paciente suyo', async () => {
    for (const doc of [cita(PACIENTE_AJENO, MI_ID), cita(PACIENTE_MIO, OTRO_PRO_ID)]) {
      const res = fakeRes();
      await updateAppointment(reqCita(profesional, doc, { status: 'completed' }), res);
      expect(res.statusCode).toBe(200);
      expect(doc.status).toBe('completed');
    }
  });

  it('el admin puede con cualquiera', async () => {
    const doc = cita(PACIENTE_AJENO, OTRO_PRO_ID);
    const res = fakeRes();
    await updateAppointment(reqCita(admin, doc, { status: 'no-show' }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('cancelar una cita (PUT /appointments/:id/cancel)', () => {
  it('un profesional no puede cancelar la cita de un paciente ajeno: 404, no se guarda ni se devuelve sesión', async () => {
    const doc = cita(PACIENTE_AJENO, OTRO_PRO_ID, { sessionDeducted: true });
    const res = fakeRes();
    await cancelAppointment(reqCita(profesional, doc, { reason: 'x' }), res);

    expect(res.statusCode).toBe(404);
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.status).toBe('scheduled');
    expect(emailService.sendAppointmentCancelledEmail).not.toHaveBeenCalled();
  });

  it('sí puede cancelar la de un paciente suyo', async () => {
    const doc = cita(PACIENTE_MIO, OTRO_PRO_ID);
    const res = fakeRes();
    await cancelAppointment(reqCita(profesional, doc), res);
    expect(res.statusCode).toBe(200);
    expect(doc.status).toBe('cancelled');
  });

  it('un paciente solo cancela las suyas: 403 con la de otra persona', async () => {
    const doc = cita(PACIENTE_AJENO);
    const res = fakeRes();
    await cancelAppointment(reqCita({ _id: PACIENTE_MIO, role: 'patient' }, doc), res);
    expect(res.statusCode).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('agendar a nombre de un paciente', () => {
  const futureDate = () => new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0];
  const reqCrear = (user, patientId) => ({
    user,
    body: { professional: MI_ID.toString(), patient: patientId.toString(), date: futureDate(), startTime: '10:00', type: 'kinesiologia' }
  });

  beforeEach(() => {
    // el profesional destino debe existir
    User.findById.mockImplementation((id) =>
      query(pacientes[id.toString()] ?? (id.toString() === MI_ID.toString() ? { _id: MI_ID, role: 'professional' } : null))
    );
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() }); // el personal también descuenta la sesión
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
    vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({ ...data, _id: nuevoId(), populate: vi.fn().mockResolvedValue(undefined) }));
  });

  it('un profesional NO puede agendar para un paciente de otro profesional: 404 y no se crea nada', async () => {
    const res = fakeRes();
    await createAppointment(reqCrear(profesional, PACIENTE_AJENO), res);
    expect(res.statusCode).toBe(404);
    expect(Appointment.create).not.toHaveBeenCalled();
  });

  it('sí puede para uno suyo o del pool', async () => {
    for (const id of [PACIENTE_MIO, PACIENTE_POOL]) {
      const res = fakeRes();
      await createAppointment(reqCrear(profesional, id), res);
      expect(res.statusCode).toBe(201);
    }
  });

  it('el admin puede para cualquiera', async () => {
    const res = fakeRes();
    await createAppointment(reqCrear(admin, PACIENTE_AJENO), res);
    expect(res.statusCode).toBe(201);
  });

  it('en lote: un profesional NO puede para un paciente ajeno (404, nada creado)', async () => {
    const res = fakeRes();
    await bulkCreateAppointments(
      { user: profesional, body: { patient: PACIENTE_AJENO.toString(), appointments: [{ professional: MI_ID.toString(), date: futureDate(), startTime: '10:00', type: 'kinesiologia' }] } },
      res
    );
    expect(res.statusCode).toBe(404);
    expect(Appointment.create).not.toHaveBeenCalled();
  });
});


describe('logros: se evalúan solo cuando una sesión pasa a (o deja de estar) completada', () => {
  beforeEach(() => triggerAchievementEvaluation.mockClear());

  it('al marcar completada se evalúa al paciente de la cita', async () => {
    const doc = cita(PACIENTE_MIO, MI_ID);
    await updateAppointment(reqCita(profesional, doc, { status: 'completed' }), fakeRes());
    expect(triggerAchievementEvaluation).toHaveBeenCalledTimes(1);
    expect(String(triggerAchievementEvaluation.mock.calls[0][0])).toBe(String(PACIENTE_MIO));
  });

  it('corregir una completada a otro estado también se revisa', async () => {
    const doc = cita(PACIENTE_MIO, MI_ID, { status: 'completed' });
    await updateAppointment(reqCita(profesional, doc, { status: 'no-show' }), fakeRes());
    expect(triggerAchievementEvaluation).toHaveBeenCalledTimes(1);
  });

  it('un cambio que no toca "completada" no dispara nada (ausente, notas, mismo estado)', async () => {
    await updateAppointment(reqCita(profesional, cita(PACIENTE_MIO, MI_ID), { status: 'no-show' }), fakeRes());
    await updateAppointment(reqCita(profesional, cita(PACIENTE_MIO, MI_ID), { sessionNotes: 'x' }), fakeRes());
    await updateAppointment(reqCita(profesional, cita(PACIENTE_MIO, MI_ID, { status: 'completed' }), { status: 'completed' }), fakeRes());
    expect(triggerAchievementEvaluation).not.toHaveBeenCalled();
  });

  it('si la evaluación de logros falla, la actualización de la cita sigue funcionando', async () => {
    triggerAchievementEvaluation.mockRejectedValueOnce(new Error('boom'));
    const res = fakeRes();
    await updateAppointment(reqCita(profesional, cita(PACIENTE_MIO, MI_ID), { status: 'completed' }), res);
    expect(res.statusCode).toBe(200);
  });

  it('borrar una cita completada se revisa; borrar una agendada no', async () => {
    const hecha = cita(PACIENTE_MIO, MI_ID, { status: 'completed', deleteOne: vi.fn().mockResolvedValue(true) });
    await deleteAppointment(reqCita(admin, hecha), fakeRes());
    expect(triggerAchievementEvaluation).toHaveBeenCalledTimes(1);

    triggerAchievementEvaluation.mockClear();
    const agendada = cita(PACIENTE_MIO, MI_ID, { deleteOne: vi.fn().mockResolvedValue(true) });
    await deleteAppointment(reqCita(admin, agendada), fakeRes());
    expect(triggerAchievementEvaluation).not.toHaveBeenCalled();
  });
});
