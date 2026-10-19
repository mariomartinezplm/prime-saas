/**
 * PRUEBAS — privacidad de las citas: qué campos llegan por HTTP a cada rol.
 *
 * Se usa un documento REAL de Mongoose (sin base de datos) y se serializa como lo hace Express (JSON.stringify → toJSON), así se
 * ve exactamente lo que recibiría el navegador. Estas pruebas se escribieron PRIMERO como `it.fails` para demostrar la exposición
 * (el paciente recibía notas internas, ejercicios, sobrecupo, descuento de sesión, evento de Google, motivo y autor de la
 * cancelación, el correo del profesional y datos clínicos); hoy verifican que está corregida y que el personal sigue recibiendo todo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import EVA from '../models/EVA.js';
import * as emailService from '../services/emailService.js';
import * as notificationService from '../services/notificationService.js';
import { getAppointments, getAppointment, cancelAppointment, createAppointment, bulkCreateAppointments } from '../controllers/appointmentController.js';
import { getPatientProfile, getUserById } from '../controllers/userController.js';
import { PATIENT_APPOINTMENT_FIELDS, toPatientAppointmentView, appointmentForViewer } from '../services/patientViews.js';

// Escritos a mano a propósito (no importados): si alguien saca un campo de la lista del código, esta prueba debe fallar
const CAMPOS_ADMINISTRATIVOS_DE_LA_FICHA = ['exemptFromCapacity', 'airtableId', 'lastActivityDate', 'source', 'isProspect'];
const LISTA_ESPERADA_DE_CITAS = ['_id', 'patient', 'professional', 'date', 'startTime', 'endTime', 'type', 'status', 'recurringSlot', 'priorToApp'];

vi.mock('../services/achievements/index.js', () => ({ triggerAchievementEvaluation: vi.fn(async () => {}) }));
vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({ ...(await importOriginal()), advancePlans: vi.fn(async () => {}) }));
vi.mock('../services/anamnesisService.js', async (importOriginal) => ({ ...(await importOriginal()), getSummary: vi.fn(async ({ kind }) => ({ kind })) }));
vi.mock('../services/bookingGuards.js', async (importOriginal) => ({ ...(await importOriginal()), checkSessionBalanceForBooking: vi.fn(async () => null) }));
vi.mock('../services/clientPlanService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  // `main` valida el saldo directamente con esta función (otras ramas lo hacen en bookingGuards): sin plan simulado la prueba esperaría a una base real
  getSessionBalanceByType: vi.fn(async () => ({ hasActivePlan: true, totalAvailable: 5, planSessionsAvailable: 5, plan: { paymentPending: false } })),
  deductSession: vi.fn(async () => ({ source: 'clientPlan', refId: new (await import('mongoose')).default.Types.ObjectId() })),
  refundSession: vi.fn(async () => {})
}));

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; }),
  setHeader: vi.fn(),
  send: vi.fn(function (body) { this.body = body; return this; })
});
// Lo que de verdad recibe el navegador
const wire = (res) => JSON.parse(JSON.stringify(res.body));

const PACIENTE = id();
const PROFESIONAL = id();
const ADMIN = id();

// Campos que NO le corresponden a la propia persona
const INTERNOS = ['sessionNotes', 'exercisesPerformed', 'overbooked', 'outsideCapacity', 'deduction', 'sessionDeducted', 'googleEventId',
  'reminder24hSentAt', 'reminder4hSentAt', 'reminderSent', 'cancelledBy', 'cancellationReason', 'cancelledAt', 'completedAt', 'isTrial', 'notes',
  'createdAt', 'updatedAt', 'fullDateTime', 'id', '__v'];
// Lo que leen las pantallas del paciente
const NECESARIOS = ['_id', 'date', 'startTime', 'endTime', 'type', 'status', 'professional'];

const personas = () => ({
  paciente: new User({ _id: PACIENTE, firstName: 'Ana', lastName: 'Pérez', email: 'ana@ejemplo.invalid', phone: '+56 9 1111 1111', rut: '1-9', dateOfBirth: new Date('1990-01-01'), role: 'patient', medicalInfo: { allergies: ['penicilina'] } }),
  profesional: new User({ _id: PROFESIONAL, firstName: 'Andrea', lastName: 'Demo', email: 'andrea@ejemplo.invalid', phone: '+56 9 2222 2222', role: 'professional' })
});

// Cita real con TODOS los campos internos llenos; `poblada` simula las poblaciones del controlador
const citaReal = ({ poblada = true, ...over } = {}) => {
  const { paciente, profesional } = personas();
  const doc = new Appointment({
    patient: poblada ? paciente : PACIENTE, professional: poblada ? profesional : PROFESIONAL,
    date: new Date('2026-10-20T00:00:00Z'), startTime: '10:00', endTime: '11:00', type: 'entrenamiento', status: 'scheduled', notes: 'nota al reservar',
    sessionNotes: 'NOTA INTERNA: dolor lumbar recurrente, derivar', exercisesPerformed: [{ exercise: 'Sentadilla', sets: 3, reps: 8, weight: 60, notes: 'cuidar rodilla' }],
    overbooked: true, outsideCapacity: true, sessionDeducted: true, deduction: { source: 'clientPlan', refId: id() }, googleEventId: 'evt_secreto',
    reminder24hSentAt: new Date(), reminder4hSentAt: new Date(), reminderSent: true, cancellationReason: 'MOTIVO INTERNO: no pagó el mes', cancelledBy: ADMIN,
    cancelledAt: new Date(), completedAt: new Date(), isTrial: true, recurringSlot: id(), priorToApp: false, ...over
  });
  doc.populate = vi.fn(async () => doc);
  doc.save = vi.fn(async () => doc);
  return doc;
};
const presentes = (obj, lista) => lista.filter((k) => k in obj && obj[k] !== undefined);
const expuestos = (apt) => presentes(apt, INTERNOS);

const populados = [];
const consulta = (value) => ({ populate: (campo, seleccion) => { populados.push([campo, seleccion]); return consulta(value); }, sort: () => consulta(value), select: () => consulta(value), limit: () => consulta(value), then: (res, rej) => Promise.resolve(value).then(res, rej) });

const paciente = { _id: PACIENTE, role: 'patient' };
const profesional = { _id: PROFESIONAL, role: 'professional' };
const admin = { _id: ADMIN, role: 'admin' };
const futuro = () => new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0];

beforeEach(() => {
  vi.restoreAllMocks();
  populados.length = 0;
  vi.spyOn(emailService, 'sendAppointmentCancelledEmail').mockImplementation(() => {});
  vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
  vi.spyOn(emailService, 'sendAppointmentConfirmationToPatientEmail').mockImplementation(() => {});
  vi.spyOn(notificationService, 'notify').mockResolvedValue({});
  vi.spyOn(User, 'findById').mockImplementation((uid) => consulta(String(uid) === String(PROFESIONAL) ? { _id: PROFESIONAL, role: 'professional', firstName: 'Andrea' } : { _id: PACIENTE, role: 'patient', isActive: true, assignedProfessionalId: PROFESIONAL }));
  vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0);
  vi.spyOn(Appointment, 'exists').mockResolvedValue(null);
});

const comprobarVistaDelPaciente = (apt) => {
  expect(expuestos(apt)).toEqual([]);
  for (const campo of NECESARIOS) expect(apt, campo).toHaveProperty(campo);
  expect(Object.keys(apt).every((k) => PATIENT_APPOINTMENT_FIELDS.includes(k)), `campos fuera de la lista: ${Object.keys(apt).filter((k) => !PATIENT_APPOINTMENT_FIELDS.includes(k))}`).toBe(true);
  // del profesional solo el nombre; el paciente, solo su id
  if (typeof apt.professional === 'object') expect(Object.keys(apt.professional).sort()).toEqual(['_id', 'firstName', 'lastName']);
  expect(typeof apt.patient).toBe('string');
};

describe('lista cerrada: coincide con lo que leen las pantallas del paciente', () => {
  it('la lista permitida es exactamente la aprobada (cualquier cambio exige actualizar esta prueba a propósito)', () => {
    expect([...PATIENT_APPOINTMENT_FIELDS].sort()).toEqual([...LISTA_ESPERADA_DE_CITAS].sort());
  });

  it('las pantallas del paciente leen solo campos de la lista permitida (revisión del código del front)', () => {
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const archivos = ['src/pages/patient/MyAppointments.tsx', 'src/components/dashboard/NextSessionCard.tsx', 'src/components/dashboard/todayActions.ts', 'src/components/dashboard/nextSession.ts', 'src/lib/appointments.ts'];
    const leidos = new Set();
    for (const f of archivos) {
      const texto = fs.readFileSync(path.join(raiz, f), 'utf8');
      for (const m of texto.matchAll(/\b(?:apt|appointment|upcoming|next|a)\.(\w+)/g)) leidos.add(m[1]);
    }
    // se descartan métodos y propiedades que no son de la cita (arrays, objetos auxiliares)
    const noEsCampo = new Set(['map', 'filter', 'find', 'some', 'every', 'length', 'sort', 'slice', 'status', 'key', 'id', 'title', 'cta', 'detail', 'urgent', 'to', 'target', 'label']);
    const camposDeCita = [...leidos].filter((k) => !noEsCampo.has(k) || k === 'status');
    const fuera = camposDeCita.filter((k) => !PATIENT_APPOINTMENT_FIELDS.includes(k));
    expect(fuera, `El front lee campos que la lista del paciente no incluye: ${fuera}`).toEqual([]);
  });
});

describe('GET /api/appointments (lista)', () => {
  it('el PERSONAL sigue recibiendo la cita completa (notas internas, ejercicios, sobrecupo, descuento…)', async () => {
    for (const quien of [profesional, admin]) {
      vi.spyOn(Appointment, 'find').mockReturnValue(consulta([citaReal()]));
      const res = fakeRes();
      await getAppointments({ user: quien, query: {} }, res);
      const apt = wire(res).data.appointments[0];
      expect(presentes(apt, ['sessionNotes', 'exercisesPerformed', 'overbooked', 'outsideCapacity', 'deduction', 'sessionDeducted', 'googleEventId', 'cancellationReason', 'cancelledBy', 'notes']).length, quien.role).toBe(10);
      expect(apt.patient.email).toBe('ana@ejemplo.invalid'); // el personal sigue viendo el paciente poblado
      expect(apt.professional.email).toBe('andrea@ejemplo.invalid');
    }
  });

  it('el PACIENTE recibe solo la lista cerrada, con lo necesario para ver, reservar y cancelar', async () => {
    vi.spyOn(Appointment, 'find').mockReturnValue(consulta([citaReal(), citaReal({ poblada: false })]));
    const res = fakeRes();
    await getAppointments({ user: paciente, query: {} }, res);
    expect(res.body.count).toBe(2);
    for (const apt of wire(res).data.appointments) comprobarVistaDelPaciente(apt);
    // «Horario fijo»: ese campo solo existe en el modelo de las ramas que lo incluyen; si el modelo lo tiene, el paciente lo recibe
    if (Appointment.schema.path('recurringSlot')) expect(wire(res).data.appointments[0]).toHaveProperty('recurringSlot');
  });

  it('para el paciente no se consulta la ficha del paciente (menos datos leídos); para el personal sí', async () => {
    vi.spyOn(Appointment, 'find').mockReturnValue(consulta([]));
    await getAppointments({ user: paciente, query: {} }, fakeRes());
    expect(populados.map(([c]) => c)).toEqual(['professional']);
    populados.length = 0;
    await getAppointments({ user: profesional, query: {} }, fakeRes());
    expect(populados.map(([c]) => c)).toEqual(['patient', 'professional']);
  });

  it('el filtro por paciente y los permisos no cambian: un paciente sigue viendo solo lo suyo', async () => {
    const find = vi.spyOn(Appointment, 'find').mockReturnValue(consulta([]));
    await getAppointments({ user: paciente, query: { patient: String(id()) } }, fakeRes());
    expect(find.mock.calls[0][0].patient).toEqual(PACIENTE);
  });
});

describe('GET /api/appointments/:id (detalle)', () => {
  it('el PERSONAL sigue recibiendo la cita completa y consulta los datos clínicos del paciente', async () => {
    vi.spyOn(Appointment, 'findById').mockReturnValue(consulta(citaReal()));
    const res = fakeRes();
    await getAppointment({ user: admin, params: { id: String(id()) } }, res);
    expect(wire(res).data.appointment.sessionNotes).toMatch(/NOTA INTERNA/);
    expect(populados.find(([c]) => c === 'patient')[1]).toMatch(/medicalInfo/);
    expect(populados.map(([c]) => c)).toContain('cancelledBy');
  });

  it('el PACIENTE recibe la lista cerrada y no se consultan datos clínicos ni quién canceló', async () => {
    vi.spyOn(Appointment, 'findById').mockReturnValue(consulta(citaReal()));
    const res = fakeRes();
    await getAppointment({ user: paciente, params: { id: String(id()) } }, res);
    expect(res.statusCode).toBe(200);
    comprobarVistaDelPaciente(wire(res).data.appointment);
    expect(populados.map(([c]) => c)).toEqual(['professional']);
  });

  it('un paciente sigue sin poder abrir la cita de otro (403, sin datos)', async () => {
    vi.spyOn(Appointment, 'findById').mockReturnValue(consulta(citaReal({ poblada: false, patient: id() })));
    const res = fakeRes();
    await getAppointment({ user: paciente, params: { id: String(id()) } }, res);
    expect(res.statusCode).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/NOTA INTERNA/);
  });
});

describe('PUT /api/appointments/:id/cancel (respuesta)', () => {
  const cancelar = async (user, body = { reason: 'no puedo ir' }) => {
    const apt = citaReal({ cancellationReason: '', cancelledBy: undefined, cancelledAt: undefined });
    vi.spyOn(Appointment, 'findById').mockReturnValue(consulta(apt));
    const res = fakeRes();
    await cancelAppointment({ user, params: { id: String(id()) }, body }, res);
    return { res, apt };
  };

  it('al cancelar, el PACIENTE recibe solo la lista cerrada (sin el motivo ni quién la canceló) y la cancelación se guarda igual', async () => {
    const { res, apt } = await cancelar(paciente);
    expect(res.statusCode).toBe(200);
    const out = wire(res).data.appointment;
    comprobarVistaDelPaciente(out);
    expect(out.status).toBe('cancelled');
    expect(apt.save).toHaveBeenCalled();
    expect(apt.cancellationReason).toBe('no puedo ir'); // se guarda para el equipo, pero no vuelve al paciente
    expect(String(apt.cancelledBy)).toBe(String(PACIENTE));
  });

  it('cuando cancela el PERSONAL recibe la cita completa, como antes', async () => {
    const { res } = await cancelar(admin, { reason: 'reorganización' });
    const out = wire(res).data.appointment;
    expect(out.cancellationReason).toBe('reorganización');
    expect(out.cancelledBy).toBeDefined();
    expect(out.sessionNotes).toMatch(/NOTA INTERNA/);
  });
});

describe('POST /api/appointments (crear) y /bulk (lote)', () => {
  const creada = () => async (data) => citaReal({ date: data.date, startTime: data.startTime, endTime: data.endTime, type: data.type, poblada: true });
  const cuerpo = (extra = {}) => ({ professional: String(PROFESIONAL), date: futuro(), startTime: '10:00', type: 'entrenamiento', ...extra });

  it('al reservar, el PACIENTE recibe la lista cerrada (sin correo del profesional ni ficha del paciente, sin descuento ni sobrecupo)', async () => {
    vi.spyOn(Appointment, 'create').mockImplementation(creada());
    const res = fakeRes();
    await createAppointment({ user: paciente, body: cuerpo() }, res);
    expect(res.statusCode).toBe(201);
    const apt = wire(res).data.appointment;
    comprobarVistaDelPaciente(apt);
    expect(JSON.stringify(apt)).not.toMatch(/andrea@ejemplo|ana@ejemplo|penicilina|\+56 9/);
  });

  it('una cita idéntica (mismo paciente, profesional, día y hora) se rechaza con 409 y no se crea otra', async () => {
    const crear = vi.spyOn(Appointment, 'create').mockImplementation(creada());
    vi.spyOn(Appointment, 'exists').mockResolvedValue({ _id: id() });
    const res = fakeRes();
    await createAppointment({ user: admin, body: cuerpo({ patient: String(PACIENTE) }) }, res);
    expect(res.statusCode).toBe(409);
    expect(wire(res).code).toBe('DUPLICATE_APPOINTMENT');
    expect(crear).not.toHaveBeenCalled();
  });

  it('al reservar, el PERSONAL recibe la cita completa, como antes', async () => {
    vi.spyOn(Appointment, 'create').mockImplementation(creada());
    const res = fakeRes();
    await createAppointment({ user: admin, body: cuerpo({ patient: String(PACIENTE) }) }, res);
    expect(res.statusCode).toBe(201);
    const apt = wire(res).data.appointment;
    expect(apt.sessionNotes).toMatch(/NOTA INTERNA/);
    expect(apt.professional.email).toBe('andrea@ejemplo.invalid');
  });

  it('en lote, el PACIENTE recibe la lista cerrada de cada cita creada; el personal, la completa', async () => {
    vi.spyOn(Appointment, 'create').mockImplementation(creada());
    const body = { appointments: [{ professional: String(PROFESIONAL), date: futuro(), startTime: '10:00', type: 'entrenamiento' }, { professional: String(PROFESIONAL), date: futuro(), startTime: '12:00', type: 'entrenamiento' }] };
    const res = fakeRes();
    await bulkCreateAppointments({ user: paciente, body }, res);
    expect(res.statusCode).toBe(201);
    const { created, skipped } = wire(res).data;
    expect(created.length).toBeGreaterThan(0);
    for (const apt of created) comprobarVistaDelPaciente(apt);
    expect(Array.isArray(skipped)).toBe(true);

    const resStaff = fakeRes();
    await bulkCreateAppointments({ user: admin, body: { ...body, patient: String(PACIENTE) } }, resStaff);
    expect(wire(resStaff).data.created[0].sessionNotes).toMatch(/NOTA INTERNA/);
  });
});

describe('GET /api/users/:id/profile y GET /api/users/:id — lo que recibe el propio paciente', () => {
  const montarPerfil = () => {
    const ficha = new User({ firstName: 'Ana', lastName: 'Pérez', email: 'ana@ejemplo.invalid', role: 'patient', exemptFromCapacity: true, airtableId: 'rec123', source: 'airtable', isProspect: false, isFounder: true, assignedProfessionalId: PROFESIONAL, medicalInfo: { allergies: ['penicilina'] } });
    ficha.lastActivityDate = new Date();
    vi.spyOn(User, 'findById').mockReturnValue(consulta(ficha));
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(3);
    vi.spyOn(Appointment, 'exists').mockResolvedValue(null);
    vi.spyOn(Appointment, 'find').mockReturnValue(consulta([citaReal()]));
    vi.spyOn(Measurement, 'find').mockReturnValue(consulta([]));
    vi.spyOn(ExerciseProgress, 'distinct').mockResolvedValue([]);
    vi.spyOn(EVA, 'find').mockReturnValue(consulta([]));
  };

  it('el PACIENTE recibe sus citas próximas con la lista cerrada y su ficha sin los campos administrativos', async () => {
    montarPerfil();
    const res = fakeRes();
    await getPatientProfile({ user: paciente, params: { id: String(PACIENTE) } }, res);
    expect(res.statusCode).toBe(200);
    const data = wire(res).data;
    comprobarVistaDelPaciente(data.upcomingAppointments[0]);
    for (const campo of CAMPOS_ADMINISTRATIVOS_DE_LA_FICHA) expect(data.patient, campo).not.toHaveProperty(campo);
    // lo que sí le corresponde sigue ahí
    expect(data.patient.isFounder).toBe(true);
    expect(data.patient.medicalInfo.allergies).toEqual(['penicilina']);
    expect(String(data.patient.assignedProfessionalId)).toBe(String(PROFESIONAL));
    expect(data.patient).not.toHaveProperty('password');
  });

  it('el PERSONAL recibe la ficha completa (incluido «sobre cupo») y las citas completas, como antes', async () => {
    montarPerfil();
    const res = fakeRes();
    await getPatientProfile({ user: admin, params: { id: String(PACIENTE) } }, res);
    const data = wire(res).data;
    expect(data.patient.exemptFromCapacity).toBe(true);
    expect(data.patient.airtableId).toBe('rec123');
    expect(data.upcomingAppointments[0].sessionNotes).toMatch(/NOTA INTERNA/);
  });

  it('GET /api/users/:id: el paciente recibe su ficha sin campos administrativos; el personal, la completa', async () => {
    montarPerfil();
    const resP = fakeRes();
    await getUserById({ user: paciente, params: { id: String(PACIENTE) } }, resP);
    const u = wire(resP).data.user;
    for (const campo of CAMPOS_ADMINISTRATIVOS_DE_LA_FICHA) expect(u, campo).not.toHaveProperty(campo);
    expect(u.firstName).toBe('Ana');
    montarPerfil();
    const resA = fakeRes();
    await getUserById({ user: admin, params: { id: String(PACIENTE) } }, resA);
    expect(wire(resA).data.user.exemptFromCapacity).toBe(true);
  });
});

describe('vista cerrada: casos límite', () => {
  it('un rol desconocido se trata como restringido por defecto; null y objetos planos no fallan', () => {
    const plano = { _id: id(), patient: id(), professional: { _id: id(), firstName: 'A', lastName: 'B', email: 'x@y.z' }, date: new Date(), startTime: '10:00', endTime: '11:00', type: 'entrenamiento', status: 'scheduled', sessionNotes: 'secreto' };
    expect(appointmentForViewer({ role: 'otro' }, plano)).not.toHaveProperty('sessionNotes');
    expect(appointmentForViewer({ role: 'otro' }, plano).professional).not.toHaveProperty('email');
    expect(appointmentForViewer(paciente, null)).toBeNull();
    expect(toPatientAppointmentView(undefined)).toBeUndefined();
  });

  it('un campo nuevo del modelo NO llega al paciente hasta que se agregue a la lista a propósito', () => {
    const doc = citaReal();
    doc.set('nuevoCampoInterno', 'x', { strict: false });
    const plano = { ...doc.toObject(), nuevoCampoInterno: 'x' };
    expect(toPatientAppointmentView(plano)).not.toHaveProperty('nuevoCampoInterno');
  });

  it('el personal recibe exactamente el mismo objeto que antes (sin copia ni cambios)', () => {
    const doc = citaReal();
    expect(appointmentForViewer(admin, doc)).toBe(doc);
    expect(appointmentForViewer(profesional, doc)).toBe(doc);
  });
});
