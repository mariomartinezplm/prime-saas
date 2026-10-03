/**
 * PRUEBAS — recordatorios de cita por correo, 24 h y 4 h antes, y correo de
 * confirmación con .ics. Sin BD ni red: modelos espiados, correo simulado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import { nowInSantiago } from '../utils/timezone.js';
import { sendDueReminders } from '../services/appointmentReminderService.js';
import { sendAppointmentReminderEmail } from '../services/emailService.js';

vi.mock('../services/emailService.js', () => ({
  sendAppointmentReminderEmail: vi.fn(async () => ({ ok: true }))
}));

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-05T15:00:00Z');
const wallNow = nowInSantiago(NOW);

// hoursLeft: horas que faltan para la sesión; bookedAgoHours: hace cuánto se agendó
const apt = ({ hoursLeft, bookedAgoHours = 100, sent24 = null, sent4 = null, patient } = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  fullDateTime: new Date(wallNow.getTime() + hoursLeft * HOUR),
  createdAt: new Date(NOW.getTime() - bookedAgoHours * HOUR),
  reminder24hSentAt: sent24,
  reminder4hSentAt: sent4,
  startTime: '10:00',
  endTime: '11:00',
  date: new Date('2026-10-06T00:00:00Z'),
  type: 'kinesiologia',
  status: 'scheduled',
  patient: patient ?? { firstName: 'Ana', lastName: 'Pérez', email: 'ana@x.cl', isActive: true },
  professional: { firstName: 'Mario', lastName: 'Martínez' }
});

const mockFind = (list) =>
  vi.spyOn(Appointment, 'find').mockReturnValue({
    populate: () => ({ populate: () => Promise.resolve(list) })
  });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(sendAppointmentReminderEmail).mockClear();
  vi.mocked(sendAppointmentReminderEmail).mockResolvedValue({ ok: true });
  vi.spyOn(Appointment, 'findOneAndUpdate').mockResolvedValue({});
  vi.spyOn(Appointment, 'updateOne').mockResolvedValue({});
});

describe('sendDueReminders — ventanas de 24 h y 4 h', () => {
  it('a 22 h de la sesión (agendada hace días): manda el recordatorio de 24 h', async () => {
    mockFind([apt({ hoursLeft: 22 })]);
    const summary = await sendDueReminders(NOW);
    expect(summary.sent24h).toBe(1);
    expect(sendAppointmentReminderEmail).toHaveBeenCalledWith(expect.objectContaining({ hoursBefore: 24 }));
  });

  it('a 3 h de la sesión con el de 24 h ya enviado: manda solo el de 4 h', async () => {
    mockFind([apt({ hoursLeft: 3, sent24: new Date() })]);
    const summary = await sendDueReminders(NOW);
    expect(summary.sent4h).toBe(1);
    expect(summary.sent24h).toBe(0);
    expect(sendAppointmentReminderEmail).toHaveBeenCalledOnce();
    expect(sendAppointmentReminderEmail).toHaveBeenCalledWith(expect.objectContaining({ hoursBefore: 4 }));
  });

  it('a 3 h sin haber mandado el de 24 h (servidor caído): manda solo el de 4 h, no ambos', async () => {
    mockFind([apt({ hoursLeft: 3 })]);
    const summary = await sendDueReminders(NOW);
    expect(summary.sent4h).toBe(1);
    expect(summary.sent24h).toBe(0);
  });

  it('a 30 h de la sesión: todavía no manda nada', async () => {
    mockFind([apt({ hoursLeft: 30 })]);
    const summary = await sendDueReminders(NOW);
    expect(summary.sent24h + summary.sent4h).toBe(0);
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });

  it('sesión que ya pasó: no manda nada', async () => {
    mockFind([apt({ hoursLeft: -1 })]);
    await sendDueReminders(NOW);
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });

  it('agendada hace 2 h para dentro de 6 h: no recibe un "recordatorio de 24 h"', async () => {
    mockFind([apt({ hoursLeft: 6, bookedAgoHours: 2 })]);
    await sendDueReminders(NOW);
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });

  it('recordatorio ya enviado: no se repite', async () => {
    mockFind([apt({ hoursLeft: 22, sent24: new Date() })]);
    await sendDueReminders(NOW);
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });

  it('paciente sin correo o desactivado: se omite', async () => {
    mockFind([
      apt({ hoursLeft: 22, patient: { firstName: 'A', lastName: 'B', email: '', isActive: true } }),
      apt({ hoursLeft: 22, patient: { firstName: 'C', lastName: 'D', email: 'c@x.cl', isActive: false } })
    ]);
    await sendDueReminders(NOW);
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });

  it('solo busca citas agendadas (no canceladas ni completadas)', async () => {
    const findSpy = mockFind([]);
    await sendDueReminders(NOW);
    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled' }));
  });
});

describe('sendDueReminders — nunca duplica ni pierde', () => {
  it('si otro proceso ya reclamó el recordatorio, no envía', async () => {
    mockFind([apt({ hoursLeft: 22 })]);
    vi.spyOn(Appointment, 'findOneAndUpdate').mockResolvedValue(null);
    const summary = await sendDueReminders(NOW);
    expect(summary.sent24h).toBe(0);
    expect(sendAppointmentReminderEmail).not.toHaveBeenCalled();
  });

  it('reclama la marca con la condición "aún sin enviar" (atómico)', async () => {
    mockFind([apt({ hoursLeft: 22 })]);
    const claimSpy = vi.spyOn(Appointment, 'findOneAndUpdate').mockResolvedValue({});
    await sendDueReminders(NOW);
    expect(claimSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reminder24hSentAt: null }),
      { $set: { reminder24hSentAt: NOW } }
    );
  });

  it('si el correo falla, libera la marca para reintentar en la próxima vuelta', async () => {
    mockFind([apt({ hoursLeft: 22 })]);
    vi.mocked(sendAppointmentReminderEmail).mockResolvedValue({ ok: false });
    const updateSpy = vi.spyOn(Appointment, 'updateOne').mockResolvedValue({});
    const summary = await sendDueReminders(NOW);
    expect(summary.failed).toBe(1);
    expect(updateSpy).toHaveBeenCalledWith(expect.anything(), { $set: { reminder24hSentAt: null } });
  });
});

describe('correos al paciente (contenido)', () => {
  const ORIGINAL_KEY = process.env.RESEND_API_KEY;
  afterEach(() => { process.env.RESEND_API_KEY = ORIGINAL_KEY; });

  const data = {
    patient: { firstName: 'Ana', lastName: 'Pérez', email: 'ana@x.cl' },
    professional: { firstName: 'Mario', lastName: 'Martínez' },
    date: new Date('2026-10-06T00:00:00Z'),
    startTime: '10:00',
    endTime: '11:00',
    type: 'kinesiologia'
  };

  it('la confirmación va al paciente y adjunta el .ics en base64', async () => {
    vi.resetModules();
    vi.doUnmock('../services/emailService.js');
    process.env.RESEND_API_KEY = 'clave-prueba';
    const real = await vi.importActual('../services/emailService.js');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

    await real.sendAppointmentConfirmationToPatientEmail({
      ...data,
      icsContent: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
      appointmentId: 'abc123'
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.to).toBe('ana@x.cl');
    expect(body.attachments[0].filename).toBe('cita-primefh-abc123.ics');
    expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain('BEGIN:VCALENDAR');
    expect(body.html).toContain('24 horas y 4 horas');
  });

  it('el recordatorio de 24 h y el de 4 h llevan asuntos distintos y se escapa el nombre', async () => {
    vi.resetModules();
    vi.doUnmock('../services/emailService.js');
    process.env.RESEND_API_KEY = 'clave-prueba';
    const real = await vi.importActual('../services/emailService.js');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

    await real.sendAppointmentReminderEmail({ ...data, patient: { ...data.patient, firstName: '<b>Ana</b>' }, hoursBefore: 24 });
    await real.sendAppointmentReminderEmail({ ...data, hoursBefore: 4 });

    const b24 = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const b4 = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(b24.subject).toContain('Recordatorio');
    expect(b4.subject).toContain('Hoy a las 10:00');
    expect(b24.html).not.toContain('<b>Ana</b>');
    expect(b24.html).toContain('&lt;b&gt;');
    expect(b24.attachments).toBeUndefined();
  });
});
