/**
 * PRUEBAS — recordatorio semanal de los lunes (campanita + correo). Sin base real: se simulan los modelos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import Appointment from '../models/Appointment.js';
import * as notifications from '../services/notificationService.js';
import * as emails from '../services/emailService.js';
import { sendWeeklyBookingReminders, weeklyKey } from '../services/weeklyBookingReminderService.js';
import { santiagoToUtc } from '../utils/timezone.js';

vi.mock('../services/notificationService.js', () => ({ notifyOnce: vi.fn() }));
vi.mock('../services/emailService.js', () => ({ sendNotificationEmail: vi.fn(async () => {}) }));

const id = () => new mongoose.Types.ObjectId();
const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });
const MONDAY_9 = santiagoToUtc(2026, 10, 26, 9, 0); // lunes 26 de octubre de 2026, 09:00 en Chile
const MONDAY_7 = santiagoToUtc(2026, 10, 26, 7, 0);
const TUESDAY = santiagoToUtc(2026, 10, 27, 9, 0);

describe('recordatorio semanal para agendar', () => {
  const ana = id();
  const luis = id();
  const sinSesiones = id();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ClientPlan, 'find').mockReturnValue(chain([
      { patient: ana, sessionsTotal: 8, sessionsUsed: 2 },
      { patient: luis, sessionsTotal: 8, sessionsUsed: 0 },
      { patient: sinSesiones, sessionsTotal: 8, sessionsUsed: 8 }
    ]));
    vi.spyOn(Appointment, 'distinct').mockResolvedValue([luis]); // Luis ya agendó esta semana
    vi.spyOn(User, 'find').mockReturnValue(chain([{ _id: ana, email: 'ana@ejemplo.invalid', firstName: 'Ana' }]));
    notifications.notifyOnce.mockResolvedValue({ _id: id() });
  });

  it('el lunes por la mañana avisa solo a quien tiene sesiones y todavía no agendó esa semana', async () => {
    const summary = await sendWeeklyBookingReminders({ now: MONDAY_9 });
    expect(summary).toMatchObject({ sent: 1, failed: 0 });
    expect(notifications.notifyOnce).toHaveBeenCalledTimes(1);
    expect(notifications.notifyOnce.mock.calls[0][0]).toEqual(ana);
    expect(notifications.notifyOnce.mock.calls[0][2].dedupeKey).toBe(weeklyKey(String(ana), '2026-10-26'));
    expect(emails.sendNotificationEmail).toHaveBeenCalledTimes(1);
    // Luis (ya agendó) y quien no tiene sesiones no entran a la consulta de usuarios
    expect(User.find.mock.calls[0][0]._id.$in.map(String)).toEqual([String(ana)]);
  });

  it('no avisa antes de las 08:00 ni cualquier otro día', async () => {
    expect((await sendWeeklyBookingReminders({ now: MONDAY_7 })).sent).toBe(0);
    expect((await sendWeeklyBookingReminders({ now: TUESDAY })).sent).toBe(0);
    expect(notifications.notifyOnce).not.toHaveBeenCalled();
  });

  it('si la semana ya se avisó (clave repetida), no manda otro correo', async () => {
    notifications.notifyOnce.mockResolvedValue(null);
    const summary = await sendWeeklyBookingReminders({ now: MONDAY_9 });
    expect(summary).toMatchObject({ sent: 0, duplicates: 1 });
    expect(emails.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('un error con un paciente no detiene la pasada', async () => {
    notifications.notifyOnce.mockRejectedValue(new Error('boom'));
    const summary = await sendWeeklyBookingReminders({ now: MONDAY_9 });
    expect(summary).toMatchObject({ sent: 0, failed: 1 });
  });
});
