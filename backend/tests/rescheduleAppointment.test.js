/**
 * PRUEBAS — «Cambiar hora»: el paciente mueve su cita a otra hora, a tiempo (mismo plazo que cancelar sin perder la sesión).
 * La nueva cita se crea con las reglas de una reserva; la de origen queda cancelada con su sesión devuelta; si algo falla, queda la original.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import User from '../models/User.js';
import { santiagoParts } from '../utils/timezone.js';
import { rescheduleAppointment } from '../controllers/rescheduleController.js';
import router from '../routes/appointmentRoutes.js';

const mocks = vi.hoisted(() => ({
  deduct: vi.fn(),
  refund: vi.fn(),
  guard: vi.fn(),
  closed: { value: false }
}));

vi.mock('../services/clientPlanService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deductSession: (...a) => mocks.deduct(...a),
  refundSession: (...a) => mocks.refund(...a)
}));
vi.mock('../services/bookingGuards.js', async (importOriginal) => ({
  ...(await importOriginal()),
  checkSessionBalanceForBooking: (...a) => mocks.guard(...a)
}));
vi.mock('../services/slotClosureService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isSlotClosed: async () => mocks.closed.value,
  closedStartsFor: async () => []
}));
vi.mock('../services/emailService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendAppointmentUpdatedEmail: vi.fn(async () => {}),
  sendAppointmentConfirmationToPatientEmail: vi.fn(async () => {})
}));
vi.mock('../services/notificationService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  notify: vi.fn(async () => {})
}));

const id = () => new mongoose.Types.ObjectId();
const PATIENT = id();
const PROFESSIONAL = id();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const pad = (n) => String(n).padStart(2, '0');
// Fecha y hora (en Chile) de «ahora + horas»
const inHours = (h) => {
  const p = santiagoParts(new Date(Date.now() + h * 3600e3));
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${p.minute < 30 ? '00' : '30'}` };
};
const ALL_DAY = Array.from({ length: 48 }, (_, i) => ({ startTime: `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}` }));
const attendsEveryDay = { weeklySchedule: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, slots: ALL_DAY })), blockedDates: [] };

let old;
const makeOld = (over = {}) => {
  const when = inHours(72);
  return {
    _id: id(), patient: PATIENT, professional: PROFESSIONAL, status: 'scheduled', type: 'entrenamiento',
    date: new Date(`${when.date}T00:00:00.000Z`), startTime: '09:00', endTime: '10:00',
    sessionDeducted: true, deduction: { source: 'clientPlan', refId: id() }, outsideCapacity: false,
    save: vi.fn().mockResolvedValue(undefined), ...over
  };
};
const reqOf = (body, user = { _id: PATIENT, role: 'patient' }) => ({ params: { id: 'x' }, user, body });
const target = () => ({ date: inHours(96).date, startTime: '10:00' });

function setup({ overlapping = 1, exempt = false } = {}) {
  vi.restoreAllMocks();
  mocks.deduct.mockReset().mockResolvedValue({ source: 'clientPlan', refId: id() });
  mocks.refund.mockReset().mockResolvedValue(undefined);
  mocks.guard.mockReset().mockResolvedValue(null);
  mocks.closed.value = false;
  old = makeOld();
  vi.spyOn(Appointment, 'findById').mockImplementation(async () => old);
  vi.spyOn(Availability, 'findOne').mockResolvedValue(attendsEveryDay);
  vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(overlapping);
  vi.spyOn(Appointment, 'exists').mockResolvedValue(null);
  vi.spyOn(User, 'findById').mockImplementation((uid) => {
    const doc = String(uid) === String(PATIENT) ? { _id: PATIENT, role: 'patient', exemptFromCapacity: exempt, firstName: 'Ana', lastName: 'P', email: 'a@x.invalid' } : { _id: PROFESSIONAL, role: 'professional', firstName: 'Andrea', lastName: 'S', email: 'p@x.invalid' };
    return { select: async () => doc, then: (r, j) => Promise.resolve(doc).then(r, j) };
  });
  return {
    create: vi.spyOn(Appointment, 'create').mockImplementation(async (d) => ({ ...d, _id: id(), toObject() { return { ...d }; } })),
    del: vi.spyOn(Appointment, 'deleteOne').mockResolvedValue({})
  };
}

describe('cambiar la hora a tiempo', () => {
  beforeEach(() => setup());

  it('crea la cita nueva, cancela la de origen y deja la sesión como estaba (se devuelve una y se descuenta una)', async () => {
    const { create } = setup();
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ patient: PATIENT, professional: PROFESSIONAL, startTime: '10:00', endTime: '11:00', type: 'entrenamiento', sessionDeducted: true, rescheduledFrom: old._id });
    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.deduct).toHaveBeenCalledTimes(1);
    expect(mocks.deduct.mock.calls[0][3]).toMatchObject({ startTime: '10:00' });
    expect(old.status).toBe('cancelled');
    expect(old.cancellationReason).toBe('Cambio de hora');
    expect(old.sessionDeducted).toBe(false);
    expect(old.rescheduledTo).toBeDefined();
    expect(old.save).toHaveBeenCalledTimes(1);
  });

  it('a la paciente solo le llega la lista cerrada (sin datos internos)', async () => {
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.body.data.appointment).not.toHaveProperty('deduction');
    expect(res.body.data.appointment).not.toHaveProperty('rescheduledFrom');
    expect(res.body.data.previousId).toBeDefined();
  });

  it('mover 30 minutos en el mismo día no cuenta la cita contra sí misma (4 de 4 con ella adentro)', async () => {
    setup({ overlapping: 4 });
    old.date = new Date(`${inHours(72).date}T00:00:00.000Z`);
    old.startTime = '09:00';
    const res = fakeRes();
    await rescheduleAppointment(reqOf({ date: inHours(72).date, startTime: '09:30' }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('lo que NO se puede', () => {
  it('con menos de 3 horas para la cita de origen: 409 CHANGE_TOO_LATE y no se toca nada', async () => {
    const { create } = setup();
    const soon = inHours(2);
    old.date = new Date(`${soon.date}T00:00:00.000Z`);
    old.startTime = soon.time;
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('CHANGE_TOO_LATE');
    expect(create).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(old.save).not.toHaveBeenCalled();
  });

  it('la hora nueva con menos de 2 horas de anticipación: 400', async () => {
    setup();
    const soon = inHours(1);
    const res = fakeRes();
    await rescheduleAppointment(reqOf({ date: soon.date, startTime: soon.time }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BOOKING_WINDOW');
  });

  it('el mismo horario: 400', async () => {
    setup();
    const res = fakeRes();
    await rescheduleAppointment(reqOf({ date: old.date.toISOString().slice(0, 10), startTime: old.startTime }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('SAME_SLOT');
  });

  it('datos mal escritos: 400', async () => {
    setup();
    for (const bad of [{}, { date: '2026-13-1', startTime: '10:00' }, { date: inHours(96).date, startTime: '10:15' }, { date: inHours(96).date, startTime: 1000 }]) {
      const res = fakeRes();
      await rescheduleAppointment(reqOf(bad), res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('una hora cerrada por el profesional: 409 SLOT_CLOSED', async () => {
    const { create } = setup();
    mocks.closed.value = true;
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('SLOT_CLOSED');
    expect(create).not.toHaveBeenCalled();
  });

  it('un horario lleno (4 de 4): 409 SLOT_FULL; una paciente «sobre cupo» sí puede', async () => {
    const { create } = setup({ overlapping: 4 });
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('SLOT_FULL');
    expect(create).not.toHaveBeenCalled();
    setup({ overlapping: 4, exempt: true });
    const res2 = fakeRes();
    await rescheduleAppointment(reqOf(target()), res2);
    expect(res2.statusCode).toBe(200);
  });

  it('un horario en el que el profesional no atiende: 409 NOT_AVAILABLE', async () => {
    setup();
    Availability.findOne.mockResolvedValue({ weeklySchedule: [], blockedDates: [] });
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('NOT_AVAILABLE');
  });

  it('ya tiene otra cita idéntica en esa hora: 409', async () => {
    setup();
    Appointment.exists.mockResolvedValue({ _id: id() });
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_APPOINTMENT');
  });

  it('el equipo no usa esta ruta (403); la cita de otro paciente es 404; una cancelada o completada, 409', async () => {
    setup();
    for (const role of ['professional', 'admin']) {
      const res = fakeRes();
      await rescheduleAppointment(reqOf(target(), { _id: id(), role }), res);
      expect(res.statusCode).toBe(403);
    }
    const res404 = fakeRes();
    await rescheduleAppointment(reqOf(target(), { _id: id(), role: 'patient' }), res404);
    expect(res404.statusCode).toBe(404);
    for (const status of ['cancelled', 'completed', 'no-show']) {
      old.status = status;
      const res = fakeRes();
      await rescheduleAppointment(reqOf(target()), res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('NOT_SCHEDULED');
    }
  });
});

describe('si algo falla, queda la cita original', () => {
  it('sin sesión disponible para la fecha nueva: 409, la original se mantiene y se vuelve a descontar su sesión', async () => {
    const { create } = setup();
    mocks.deduct.mockResolvedValueOnce(null);
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(409);
    expect(create).not.toHaveBeenCalled();
    expect(old.status).toBe('scheduled');
    expect(old.save).not.toHaveBeenCalled();
    // se devolvió la sesión y se volvió a tomar (la de origen)
    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.deduct).toHaveBeenCalledTimes(2);
    expect(mocks.deduct.mock.calls[1][3]).toMatchObject({ startTime: '09:00' });
  });

  it('si la regla de plan rechaza esa fecha (ej. plazo de pago), responde ese mismo error y restaura la sesión', async () => {
    const { create } = setup();
    mocks.guard.mockResolvedValueOnce({ status: 403, body: { success: false, code: 'PAYMENT_PENDING', message: 'Primero el pago' } });
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('PAYMENT_PENDING');
    expect(create).not.toHaveBeenCalled();
    expect(old.status).toBe('scheduled');
    expect(mocks.deduct).toHaveBeenCalledTimes(1); // solo el de restaurar la original
  });

  it('si no se puede crear la cita nueva: se devuelve la sesión nueva, se restaura la original y no se cancela nada', async () => {
    const { create } = setup();
    create.mockRejectedValueOnce(new Error('falló'));
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toMatch(/original sigue/);
    expect(old.status).toBe('scheduled');
    expect(mocks.refund).toHaveBeenCalledTimes(2); // la de origen y la nueva
    expect(mocks.deduct).toHaveBeenCalledTimes(2); // la nueva y la restauración
  });

  it('si no se puede cerrar la cita de origen: se borra la nueva y se restaura todo', async () => {
    const { del } = setup();
    old.save.mockRejectedValueOnce(new Error('falló'));
    const res = fakeRes();
    await rescheduleAppointment(reqOf(target()), res);
    expect(res.statusCode).toBe(500);
    expect(del).toHaveBeenCalledTimes(1);
  });
});

describe('quién ve las citas cambiadas', () => {
  it('la ruta existe y el paciente la usa con PUT /:id/reschedule', () => {
    const route = router.stack.find((l) => l.route?.path === '/:id/reschedule');
    expect(route.route.methods.put).toBe(true);
  });
  it('la lista del paciente excluye las citas que cambió de hora', async () => {
    vi.restoreAllMocks();
    const find = vi.spyOn(Appointment, 'find').mockReturnValue({ populate: () => ({ sort: async () => [] }) });
    const { getAppointments } = await import('../controllers/appointmentController.js');
    await getAppointments({ user: { _id: PATIENT, role: 'patient' }, query: {} }, fakeRes());
    expect(find.mock.calls[0][0]).toMatchObject({ patient: PATIENT, rescheduledTo: { $exists: false } });
  });
});
