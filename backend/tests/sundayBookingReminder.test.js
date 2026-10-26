/**
 * PRUEBAS — recordatorio de los domingos por la noche para quienes vienen 2 o 3 veces por semana. Sin base real: se simulan los modelos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import Appointment from '../models/Appointment.js';
import * as notifications from '../services/notificationService.js';
import * as emails from '../services/emailService.js';
import { sendSundayBookingReminders, sundayKey, sundayMessage } from '../services/sundayBookingReminderService.js';
import { santiagoToUtc } from '../utils/timezone.js';

vi.mock('../services/notificationService.js', () => ({ notifyOnce: vi.fn() }));
vi.mock('../services/emailService.js', () => ({ sendNotificationEmail: vi.fn(async () => {}) }));

const id = () => new mongoose.Types.ObjectId();
const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });
const SUNDAY_20 = santiagoToUtc(2026, 10, 25, 20, 30); // domingo 25 de octubre de 2026, 20:30 en Chile (la semana que viene empieza el lunes 26)
const SUNDAY_19 = santiagoToUtc(2026, 10, 25, 19, 30);
const SUNDAY_22 = santiagoToUtc(2026, 10, 25, 22, 30);
const WEDNESDAY_9 = santiagoToUtc(2026, 10, 28, 9, 0);
const MONDAY_9 = santiagoToUtc(2026, 10, 26, 9, 0);

describe('recordatorio de los domingos', () => {
  const dos = id(); // 2 por semana, agendó 1
  const tres = id(); // 3 por semana, agendó 1
  const completo = id(); // 2 por semana, ya agendó 2
  const sinSesiones = id(); // le queda 1 sesión en el plan
  const nadaAgendado = id(); // 2 por semana, 0 agendadas

  const plans = [
    { patient: dos, sessionsTotal: 8, sessionsUsed: 3 },
    { patient: tres, sessionsTotal: 12, sessionsUsed: 4 },
    { patient: completo, sessionsTotal: 8, sessionsUsed: 4 },
    { patient: sinSesiones, sessionsTotal: 12, sessionsUsed: 11 },
    { patient: nadaAgendado, sessionsTotal: 8, sessionsUsed: 0 }
  ];
  const appointments = [dos, tres, completo, completo, sinSesiones].map((patient) => ({ patient }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ClientPlan, 'find').mockReturnValue(chain(plans));
    vi.spyOn(Appointment, 'find').mockReturnValue(chain(appointments));
    vi.spyOn(User, 'find').mockImplementation((filter) => chain(
      [dos, tres, sinSesiones, nadaAgendado].filter((pid) => filter._id.$in.includes(String(pid))).map((_id) => ({ _id, email: `${_id}@ejemplo.invalid`, firstName: 'Paciente' }))
    ));
    notifications.notifyOnce.mockResolvedValue({ _id: id() });
  });

  it('el domingo a las 20:00 avisa a quien le faltan sesiones de su frecuencia, con la cantidad que le falta', async () => {
    const summary = await sendSundayBookingReminders({ now: SUNDAY_20 });
    expect(summary).toMatchObject({ sent: 4, failed: 0 });
    const byPatient = Object.fromEntries(notifications.notifyOnce.mock.calls.map((c) => [String(c[0]), c[2]]));
    expect(byPatient[String(dos)].body).toContain('te falta agendar 1 sesión');
    expect(byPatient[String(tres)].body).toContain('te faltan 2 sesiones');
    expect(byPatient[String(nadaAgendado)].body).toContain('te faltan 2 sesiones');
    expect(byPatient[String(sinSesiones)].body).toContain('te falta agendar 1 sesión'); // le falta 1 por frecuencia pero también le queda solo 1
    expect(byPatient[String(dos)].dedupeKey).toBe(sundayKey(String(dos), '2026-10-26')); // la semana que empieza mañana, lunes 26
    expect(byPatient[String(dos)].body).toContain('Mañana empieza tu semana');
    expect(emails.sendNotificationEmail).toHaveBeenCalledTimes(4);
  });

  it('no avisa a quien ya agendó todas las de su semana', async () => {
    await sendSundayBookingReminders({ now: SUNDAY_20 });
    const asked = User.find.mock.calls[0][0]._id.$in;
    expect(asked).not.toContain(String(completo));
  });

  it('nunca le dice que le faltan más sesiones de las que le quedan en el plan', async () => {
    vi.mocked(ClientPlan.find).mockReturnValue(chain([{ patient: tres, sessionsTotal: 12, sessionsUsed: 11 }]));
    vi.mocked(Appointment.find).mockReturnValue(chain([]));
    await sendSundayBookingReminders({ now: SUNDAY_20 });
    expect(notifications.notifyOnce.mock.calls[0][2].body).toContain('te falta agendar 1 sesión');
  });

  it('solo toma planes de entrenamiento no ilimitados de 8 o 12 sesiones, vigentes', async () => {
    await sendSundayBookingReminders({ now: SUNDAY_20 });
    const filter = ClientPlan.find.mock.calls[0][0];
    expect(filter).toMatchObject({ status: 'active', serviceType: 'entrenamiento', unlimited: { $ne: true }, sessionsTotal: { $in: [8, 12] } });
    const appointmentFilter = Appointment.find.mock.calls[0][0];
    expect(appointmentFilter).toMatchObject({ type: 'entrenamiento', status: { $ne: 'cancelled' } });
  });

  it('cuenta la semana que viene, de lunes a domingo (desde mañana, lunes 26 de octubre)', async () => {
    await sendSundayBookingReminders({ now: SUNDAY_20 });
    const { date } = Appointment.find.mock.calls[0][0];
    expect(date.$gte.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(date.$lt.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('solo avisa el domingo entre las 20:00 y las 22:00: ni antes, ni de madrugada, ni otro día', async () => {
    expect((await sendSundayBookingReminders({ now: SUNDAY_19 })).sent).toBe(0);
    expect((await sendSundayBookingReminders({ now: SUNDAY_22 })).sent).toBe(0);
    expect((await sendSundayBookingReminders({ now: WEDNESDAY_9 })).sent).toBe(0);
    expect((await sendSundayBookingReminders({ now: MONDAY_9 })).sent).toBe(0);
    expect(notifications.notifyOnce).not.toHaveBeenCalled();
    expect((await sendSundayBookingReminders({ now: santiagoToUtc(2026, 10, 25, 20, 0) })).sent).toBe(4); // justo a las 20:00 sí
  });

  it('si la semana ya se avisó (clave repetida), no manda otro correo', async () => {
    notifications.notifyOnce.mockResolvedValue(null);
    const summary = await sendSundayBookingReminders({ now: SUNDAY_20 });
    expect(summary).toMatchObject({ sent: 0, duplicates: 4 });
    expect(emails.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('un error con un paciente no detiene la pasada, y el texto no lleva datos de salud', async () => {
    notifications.notifyOnce.mockRejectedValueOnce(new Error('boom'));
    const summary = await sendSundayBookingReminders({ now: SUNDAY_20 });
    expect(summary).toMatchObject({ sent: 3, failed: 1 });
    expect(sundayMessage(2).body).not.toMatch(/dolor|lesi|kine|diagn/i);
  });
});
