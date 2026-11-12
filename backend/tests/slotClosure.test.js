/**
 * PRUEBAS — «Cerrar horario»: el profesional deja de recibir pacientes NUEVOS en una hora de un día. Los que ya están se mantienen.
 * Decisiones de Mario (2026-11-12): el equipo puede agregar igual confirmando un aviso; lo que se cierra es una hora de un día.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { getDay, parseISO } from 'date-fns';

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import SlotClosure from '../models/SlotClosure.js';
import * as emailService from '../services/emailService.js';
import { createAppointment, bulkCreateAppointments } from '../controllers/appointmentController.js';
import { getAvailableSlots } from '../controllers/availabilityController.js';
import { listClosures, closeSlot, reopenSlot } from '../controllers/slotClosureController.js';
import { syncSlot, defaultDeps } from '../services/recurringSlotService.js';
import router from '../routes/slotClosureRoutes.js';
import { santiagoToUtc } from '../utils/timezone.js';

// El interruptor de «hora cerrada» para las pruebas de reserva (la lógica real se prueba aparte, con importActual)
const closed = vi.hoisted(() => ({ value: false, starts: [] }));
vi.mock('../services/slotClosureService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isSlotClosed: async () => closed.value,
  closedStartsFor: async () => closed.starts
}));
vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));
const real = await vi.importActual('../services/slotClosureService.js');

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const PATIENT_ID = nuevoId();
const PROFESSIONAL_ID = nuevoId();
const futureDate = () => new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

beforeEach(() => {
  closed.value = false;
  closed.starts = [];
});

describe('qué horas bloquea una hora cerrada (las sesiones duran 60 minutos)', () => {
  it('cerrar las 19:00 bloquea las citas nuevas de 18:30, 19:00 y 19:30', () => {
    expect(real.closureBlocks('19:00', '18:30')).toBe(true);
    expect(real.closureBlocks('19:00', '19:00')).toBe(true);
    expect(real.closureBlocks('19:00', '19:30')).toBe(true);
  });
  it('no bloquea las de 18:00 (termina a las 19:00) ni las de 20:00', () => {
    expect(real.closureBlocks('19:00', '18:00')).toBe(false);
    expect(real.closureBlocks('19:00', '20:00')).toBe(false);
    expect(real.closureBlocks('19:00', '10:00')).toBe(false);
  });
  it('blockedByClosures filtra una lista de horas', () => {
    expect(real.blockedByClosures(['19:00'], ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00'])).toEqual(['18:30', '19:00', '19:30']);
    expect(real.blockedByClosures([], ['18:00'])).toEqual([]);
  });
  it('el día se lee igual que el de las citas', () => {
    expect(real.dayKey('2026-11-12')).toBe('2026-11-12');
    expect(real.dayKey(new Date('2026-11-12T12:00:00.000Z'))).toBe('2026-11-12');
  });
  it('isSlotClosed consulta las horas cerradas del profesional ese día', async () => {
    const find = vi.spyOn(SlotClosure, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ startTime: '19:00' }] }) });
    expect(await real.isSlotClosed(PROFESSIONAL_ID, '2026-11-12', '19:30')).toBe(true);
    expect(await real.isSlotClosed(PROFESSIONAL_ID, '2026-11-12', '20:00')).toBe(false);
    expect(find.mock.calls[0][0]).toEqual({ professional: PROFESSIONAL_ID, date: '2026-11-12' });
    find.mockRestore();
  });
});

describe('modelo SlotClosure', () => {
  const make = (o) => new SlotClosure({ professional: PROFESSIONAL_ID, createdBy: PROFESSIONAL_ID, date: '2026-11-12', startTime: '19:00', ...o });
  it('acepta horas en punto y y media', () => {
    expect(make({ startTime: '19:00' }).validateSync()).toBeUndefined();
    expect(make({ startTime: '19:30' }).validateSync()).toBeUndefined();
  });
  it('rechaza horas raras y fechas mal escritas', () => {
    expect(make({ startTime: '19:15' }).validateSync()).toBeDefined();
    expect(make({ startTime: '25:00' }).validateSync()).toBeDefined();
    expect(make({ date: '12-11-2026' }).validateSync()).toBeDefined();
  });
  it('cerrar la misma hora dos veces no se duplica (índice único)', () => {
    const idx = SlotClosure.schema.indexes().find(([k]) => k.professional && k.date && k.startTime);
    expect(idx[1].unique).toBe(true);
  });
});

describe('agendar en una hora cerrada', () => {
  function setup() {
    vi.restoreAllMocks();
    const query = (value) => ({ select: () => query(value), then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      const s = id.toString();
      if (s === PATIENT_ID.toString()) return query({ _id: PATIENT_ID, role: 'patient', isActive: true });
      if (s === PROFESSIONAL_ID.toString()) return query({ _id: PROFESSIONAL_ID, role: 'professional' });
      return query(null);
    });
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(2); // «tengo 2 personas»: hay cupo normal
    vi.spyOn(Appointment, 'exists').mockResolvedValue(null);
    vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
    return vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({ ...data, _id: nuevoId(), populate: vi.fn().mockResolvedValue(undefined) }));
  }
  const reqOf = (role, extra = {}) => ({
    user: { _id: role === 'patient' ? PATIENT_ID : role === 'professional' ? PROFESSIONAL_ID : nuevoId(), role },
    body: { professional: PROFESSIONAL_ID.toString(), patient: PATIENT_ID.toString(), date: futureDate(), startTime: '19:00', type: 'kinesiologia', ...extra }
  });

  it('con la hora abierta todo sigue como siempre (201)', async () => {
    const create = setup();
    const res = fakeRes();
    await createAppointment(reqOf('patient'), res);
    expect(res.statusCode).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('un paciente NO puede agendar en una hora cerrada: 409 SLOT_CLOSED, sin cita ni descuento', async () => {
    const create = setup();
    closed.value = true;
    const res = fakeRes();
    await createAppointment(reqOf('patient'), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('SLOT_CLOSED');
    expect(create).not.toHaveBeenCalled();
    expect(ClientPlan.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('el paciente no puede saltarse el cierre mandando allowClosed', async () => {
    const create = setup();
    closed.value = true;
    const res = fakeRes();
    await createAppointment(reqOf('patient', { allowClosed: true }), res);
    expect(res.statusCode).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it('el equipo recibe un aviso (409) y no se crea nada hasta confirmar', async () => {
    const create = setup();
    closed.value = true;
    for (const role of ['professional', 'admin']) {
      const res = fakeRes();
      await createAppointment(reqOf(role), res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('SLOT_CLOSED');
      expect(res.body.message).toMatch(/de todos modos/);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('el equipo confirmando (allowClosed: true) sí puede agregar', async () => {
    const create = setup();
    closed.value = true;
    const res = fakeRes();
    await createAppointment(reqOf('professional', { allowClosed: true }), res);
    expect(res.statusCode).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('en una reserva masiva el paciente salta las fechas cerradas, con motivo', async () => {
    const create = setup();
    closed.value = true;
    const res = fakeRes();
    const it_ = (h) => { const t = new Date(Date.now() + h * 3600e3); return { professional: PROFESSIONAL_ID.toString(), date: t.toISOString().split('T')[0], startTime: '19:00', type: 'kinesiologia' }; };
    await bulkCreateAppointments({ user: { _id: PATIENT_ID, role: 'patient' }, body: { appointments: [it_(48), it_(72)] } }, res);
    expect(res.body.data.created).toHaveLength(0);
    expect(res.body.data.skipped.map((s) => s.motivo)).toEqual(['Horario cerrado', 'Horario cerrado']);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('listado de horarios con una hora cerrada', () => {
  const slotsReq = (user) => ({ user, query: {}, params: { professionalId: PROFESSIONAL_ID.toString(), date: '2026-09-14' } });
  const prepare = () => {
    vi.restoreAllMocks();
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(2);
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5, endDate: new Date(Date.now() + 864e5 * 10), status: 'active' });
    vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve({ role: 'patient' }), then: (r) => r({ role: 'patient' }) }));
    vi.spyOn(Availability, 'findOne').mockResolvedValue({
      weeklySchedule: [{ dayOfWeek: getDay(parseISO('2026-09-14')), slots: ['18:00', '18:30', '19:00', '19:30', '20:00'].map((startTime) => ({ startTime })) }],
      blockedDates: []
    });
    closed.starts = ['19:00'];
  };

  it('el equipo ve todas las horas y recibe cuáles están cerradas', async () => {
    prepare();
    const res = fakeRes();
    await getAvailableSlots(slotsReq({ _id: nuevoId(), role: 'professional' }), res);
    expect(res.body.data.closedSlots).toEqual(['18:30', '19:00', '19:30']);
    expect(res.body.data.availableSlots).toEqual(expect.arrayContaining(['18:30', '19:00', '19:30']));
  });
});

describe('horario fijo (agenda automática) con una hora cerrada', () => {
  const PACIENTE = nuevoId();
  const AHORA = santiagoToUtc(2026, 10, 16, 12, 0); // viernes 16-oct-2026, 12:00 en Chile
  const fin = new Date(santiagoToUtc(2026, 11, 1).getTime() - 1);
  const slot = () => ({ _id: nuevoId(), patient: PACIENTE, professional: PROFESSIONAL_ID, dayOfWeek: 1, startTime: '18:00', type: 'entrenamiento', active: true, skipped: [] });
  const crearDeps = (isClosed) => {
    const creadas = [];
    const deps = {
      getActivePlanByType: vi.fn(async () => ({ _id: nuevoId(), endDate: fin })),
      checkBalance: vi.fn(async () => null),
      deduct: vi.fn(async () => ({ source: 'clientPlan', refId: nuevoId() })),
      refund: vi.fn(async () => {}),
      isExempt: vi.fn(async () => false),
      countOverlapping: vi.fn(async () => 0),
      isClosed,
      listPatientAppointments: vi.fn(async () => []),
      getAvailability: vi.fn(async () => ({ weeklySchedule: [{ dayOfWeek: 1, slots: [{ startTime: '18:00' }] }], blockedDates: [] })),
      createAppointment: vi.fn(async (d) => { creadas.push(d); return d; }),
      addSkipped: vi.fn(async () => {}),
      markNotified: vi.fn(async () => {}),
      notify: vi.fn(async () => {}),
      notifyOnce: vi.fn(async () => {})
    };
    return { deps, creadas };
  };

  it('el motor real consulta las horas cerradas', () => {
    expect(typeof defaultDeps.isClosed).toBe('function');
  });

  it('una fecha con la hora cerrada no se agenda sola ni descuenta; la otra fecha sí', async () => {
    const { deps, creadas } = crearDeps(vi.fn(async (_p, date) => date === '2026-10-19'));
    const r = await syncSlot(slot(), { now: AHORA, deps });
    expect(r.created).toEqual(['2026-10-26']);
    expect(creadas).toHaveLength(1);
    expect(deps.deduct).toHaveBeenCalledTimes(1);
    expect(deps.addSkipped).toHaveBeenCalled();
    expect(JSON.stringify(deps.addSkipped.mock.calls)).toContain('FULL');
  });

  it('sin horas cerradas el horario fijo funciona como siempre', async () => {
    const { deps } = crearDeps(vi.fn(async () => false));
    const r = await syncSlot(slot(), { now: AHORA, deps });
    expect(r.created).toEqual(['2026-10-19', '2026-10-26']);
  });
});

describe('API de cerrar y reabrir', () => {
  const body = (extra = {}) => ({ date: futureDate(), startTime: '19:00', ...extra });
  const prep = (professionalDoc = { _id: PROFESSIONAL_ID, role: 'professional' }) => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockReturnValue({ select: async () => professionalDoc });
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(2);
    return vi.spyOn(SlotClosure, 'findOneAndUpdate').mockReturnValue({ lean: async () => ({ _id: nuevoId(), professional: PROFESSIONAL_ID, date: futureDate(), startTime: '19:00' }) });
  };

  it('cierra una hora y dice cuántas personas se mantienen', async () => {
    const upsert = prep();
    const res = fakeRes();
    await closeSlot({ params: { professionalId: PROFESSIONAL_ID.toString() }, user: { _id: PROFESSIONAL_ID, role: 'professional' }, body: body() }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.closure).toMatchObject({ startTime: '19:00', present: 2 });
    expect(upsert.mock.calls[0][1]).toHaveProperty('$setOnInsert');
    expect(upsert.mock.calls[0][2]).toMatchObject({ upsert: true });
  });

  it('rechaza horas que no empiezan en punto o y media, y fechas mal escritas', async () => {
    prep();
    for (const bad of [{ startTime: '19:15' }, { startTime: '7pm' }, { date: '12/11/2026' }, { date: undefined }]) {
      const res = fakeRes();
      await closeSlot({ params: { professionalId: PROFESSIONAL_ID.toString() }, user: { _id: PROFESSIONAL_ID, role: 'professional' }, body: body(bad) }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('no deja cerrar una hora que ya terminó', async () => {
    prep();
    const res = fakeRes();
    await closeSlot({ params: { professionalId: PROFESSIONAL_ID.toString() }, user: { _id: PROFESSIONAL_ID, role: 'professional' }, body: { date: '2020-01-01', startTime: '19:00' } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('un profesional que no existe, o que es un paciente, da 404', async () => {
    prep(null);
    const res = fakeRes();
    await closeSlot({ params: { professionalId: nuevoId().toString() }, user: { _id: nuevoId(), role: 'admin' }, body: body() }, res);
    expect(res.statusCode).toBe(404);
    prep({ _id: PATIENT_ID, role: 'patient' });
    const res2 = fakeRes();
    await closeSlot({ params: { professionalId: PATIENT_ID.toString() }, user: { _id: nuevoId(), role: 'admin' }, body: body() }, res2);
    expect(res2.statusCode).toBe(404);
  });

  it('reabrir: el dueño y el admin pueden; otro profesional recibe 404 y no se borra nada', async () => {
    vi.restoreAllMocks();
    const deleteOne = vi.fn().mockResolvedValue({});
    vi.spyOn(SlotClosure, 'findById').mockResolvedValue({ professional: PROFESSIONAL_ID, deleteOne });
    const otro = fakeRes();
    await reopenSlot({ params: { id: 'x' }, user: { _id: nuevoId(), role: 'professional' } }, otro);
    expect(otro.statusCode).toBe(404);
    expect(deleteOne).not.toHaveBeenCalled();
    for (const user of [{ _id: PROFESSIONAL_ID, role: 'professional' }, { _id: nuevoId(), role: 'admin' }]) {
      const res = fakeRes();
      await reopenSlot({ params: { id: 'x' }, user }, res);
      expect(res.statusCode).toBe(200);
    }
    expect(deleteOne).toHaveBeenCalledTimes(2);
  });

  it('el listado trae solo desde hoy', async () => {
    vi.restoreAllMocks();
    const find = vi.spyOn(SlotClosure, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
    const res = fakeRes();
    await listClosures({ params: { professionalId: PROFESSIONAL_ID.toString() } }, res);
    expect(res.statusCode).toBe(200);
    expect(find.mock.calls[0][0].date.$gte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('las rutas exigen sesión y personal; ver y cerrar solo en la agenda propia (o admin); reabrir se verifica en el controlador', () => {
    const names = router.stack.map((l) => l.name);
    expect(names[0]).toBe('protect');
    expect(router.stack.length).toBeGreaterThanOrEqual(2); // protect + authorize(admin, professional) antes de cualquier ruta
    const route = (method, path) => router.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack.map((s) => s.name);
    expect(route('get', '/professional/:professionalId')).toContain('listClosures');
    expect(route('post', '/professional/:professionalId').length).toBeGreaterThanOrEqual(2);
    expect(route('delete', '/:id')).toContain('reopenSlot');
  });
});
