/**
 * PRUEBAS — archivo .ics para pacientes, sin OAuth (Paso 28.B de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import { generateAppointmentICS } from '../services/icsService.js';
import { getAppointmentICS } from '../controllers/appointmentController.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  statusCode: null,
  headers: {},
  body: null,
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  setHeader: vi.fn(function (key, value) { this.headers[key] = value; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; }),
  send: vi.fn(function (body) { this.body = body; return this; })
});

describe('icsService.generateAppointmentICS', () => {
  const baseAppointment = {
    _id: nuevoId(),
    date: new Date('2026-09-15T00:00:00.000Z'),
    startTime: '10:00',
    endTime: '11:00',
    type: 'kinesiologia',
    professional: { firstName: 'Mario', lastName: 'Martínez' }
  };

  it('genera un VCALENDAR/VEVENT válido con CRLF, TZID de Santiago y sin conversión a UTC', () => {
    const ics = generateAppointmentICS(baseAppointment);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('DTSTART;TZID=America/Santiago:20260915T100000');
    expect(ics).toContain('DTEND;TZID=America/Santiago:20260915T110000');
    expect(ics).toContain('Mario Martínez');
    expect(ics).toContain('Kinesiología');
    expect(ics.includes('\r\n')).toBe(true);
  });

  it('escapa comas y punto y coma en campos de texto libre (RFC 5545)', () => {
    const ics = generateAppointmentICS({
      ...baseAppointment,
      professional: { firstName: 'Ana; Test', lastName: 'Pérez, Soto' }
    });

    expect(ics).toContain('Ana\\; Test Pérez\\, Soto');
  });

  it('duración siempre 60 minutos (10:00 a 11:00), consistente con la regla de negocio', () => {
    const ics = generateAppointmentICS(baseAppointment);
    const startMatch = ics.match(/DTSTART;TZID=America\/Santiago:(\d{8}T\d{6})/);
    const endMatch = ics.match(/DTEND;TZID=America\/Santiago:(\d{8}T\d{6})/);
    expect(startMatch[1].slice(9)).toBe('100000');
    expect(endMatch[1].slice(9)).toBe('110000');
  });
});

describe('GET /appointments/:id/ics', () => {
  it('paciente dueño de la cita: 200, con headers de descarga', async () => {
    vi.restoreAllMocks();
    const patientId = nuevoId();
    vi.spyOn(Appointment, 'findById').mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        _id: nuevoId(), patient: patientId, date: new Date(), startTime: '10:00', endTime: '11:00',
        type: 'entrenamiento', professional: { firstName: 'P', lastName: 'X' }
      })
    });

    const req = { params: { id: nuevoId().toString() }, user: { _id: patientId, role: 'patient' } };
    const res = fakeRes();
    await getAppointmentICS(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/calendar');
    expect(res.headers['Content-Disposition']).toContain('attachment');
    expect(res.body).toContain('BEGIN:VCALENDAR');
  });

  it('paciente pidiendo la cita de OTRO paciente: 403, nunca genera el archivo', async () => {
    vi.restoreAllMocks();
    vi.spyOn(Appointment, 'findById').mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        _id: nuevoId(), patient: nuevoId(), date: new Date(), startTime: '10:00', endTime: '11:00', type: 'entrenamiento'
      })
    });

    const req = { params: { id: nuevoId().toString() }, user: { _id: nuevoId(), role: 'patient' } };
    const res = fakeRes();
    await getAppointmentICS(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false); // es el error JSON, nunca el archivo .ics
  });

  it('cita inexistente: 404', async () => {
    vi.restoreAllMocks();
    vi.spyOn(Appointment, 'findById').mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });

    const req = { params: { id: nuevoId().toString() }, user: { _id: nuevoId(), role: 'patient' } };
    const res = fakeRes();
    await getAppointmentICS(req, res);

    expect(res.statusCode).toBe(404);
  });
});
