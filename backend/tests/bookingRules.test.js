/**
 * PRUEBAS — reglas de agenda al 100% (Paso 17 de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { getDay, parseISO } from 'date-fns';

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import * as emailService from '../services/emailService.js';
import { nowInSantiago } from '../utils/timezone.js';
import { bulkCreateAppointments } from '../controllers/appointmentController.js';
import { getAvailableSlots } from '../controllers/availabilityController.js';

// El motor de ciclos de planes toca la base: en estas pruebas el plan ya viene "al día"
vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// ─────────────────────────────────────────────────────────────────────────────
describe('nowInSantiago', () => {
  it('devuelve una hora dentro de una ventana razonable de la hora real (±12h de margen para cubrir el offset)', () => {
    const result = nowInSantiago();
    const diffHours = Math.abs(result.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(diffHours).toBeLessThan(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /appointments/bulk — reserva masiva con todas las reglas', () => {
  const PATIENT_ID = nuevoId();
  const PROFESSIONAL_ID = nuevoId();

  // Antes esto combinaba una fecha "hoursAhead horas adelante" con una hora
  // fija ("10:00") — dejaba de representar "hoursAhead horas desde ahora" en
  // cuanto la hora real del día pasaba las 10:00, y el caso de "menos de 4h"
  // terminaba viéndose como "la fecha ya pasó" en su lugar (bug de la prueba,
  // no del código: se detectó porque esta sesión corrió muchas horas seguidas).
  // Ahora se suman las horas directo sobre nowInSantiago() — la misma "hora
  // actual" que usa el controller — así el resultado es exacto sin importar
  // qué hora sea cuando corre la prueba.
  const futureDateTime = (hoursAhead) => {
    const target = new Date(nowInSantiago().getTime() + hoursAhead * 60 * 60 * 1000);
    // Con los getters locales: el controller lee `${date}T${startTime}` en la zona del proceso, igual que nowInSantiago()
    const p2 = (n) => String(n).padStart(2, '0');
    return {
      date: `${target.getFullYear()}-${p2(target.getMonth() + 1)}-${p2(target.getDate())}`,
      startTime: `${p2(target.getHours())}:${p2(target.getMinutes())}`
    };
  };

  const item = (hoursAhead, overrides = {}) => ({
    professional: PROFESSIONAL_ID.toString(),
    ...futureDateTime(hoursAhead),
    type: 'kinesiologia',
    ...overrides
  });

  const baseSetup = () => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: PROFESSIONAL_ID, role: 'professional' });
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0); // cupo de horario nunca lleno
    vi.spyOn(Appointment, 'exists').mockResolvedValue(null);
    vi.spyOn(emailService, 'sendAppointmentCreatedEmail').mockImplementation(() => {});
    vi.spyOn(Appointment, 'create').mockImplementation(async (data) => ({
      ...data,
      _id: nuevoId(),
      populate: vi.fn().mockResolvedValue(undefined)
    }));
  };

  it('más de 20 citas: 400, no llega a procesar nada', async () => {
    baseSetup();
    const req = {
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { appointments: Array.from({ length: 21 }, () => item(48)) }
    };
    const res = fakeRes();

    await bulkCreateAppointments(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('con saldo para 2 y se piden 3: crea 2 (con descuento real) y deja 1 en skipped', async () => {
    baseSetup();
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 2 });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue(null);

    let sessionsUsed = 8;
    const sessionsTotal = 10;
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockImplementation(() => {
      if (sessionsUsed < sessionsTotal) {
        sessionsUsed += 1;
        return Promise.resolve({ _id: nuevoId() });
      }
      return Promise.resolve(null);
    });

    const req = {
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { appointments: [item(48), item(72), item(96)] }
    };
    const res = fakeRes();

    await bulkCreateAppointments(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.created).toHaveLength(2);
    expect(res.body.data.skipped).toHaveLength(1);
    // se guardan con el descuento; la respuesta al paciente ya no trae campos internos (ver appointmentPrivacy.test.js)
    expect(vi.mocked(Appointment.create).mock.calls[0][0].sessionDeducted).toBe(true);
    expect(res.body.data.created[0]).not.toHaveProperty('sessionDeducted');
    expect(res.body.data.skipped[0]).toHaveProperty('fecha');
    expect(res.body.data.skipped[0]).toHaveProperty('motivo');
  });

  it('un item con fecha en el pasado se salta con motivo, sin tocar el resto del lote', async () => {
    baseSetup();
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });

    const req = {
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { appointments: [item(-48), item(48)] }
    };
    const res = fakeRes();

    await bulkCreateAppointments(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].motivo).toMatch(/pasó/);
  });

  it('menos de 2 horas de anticipación: se salta con el motivo correcto', async () => {
    baseSetup();
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);

    const req = {
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { appointments: [item(1.9)] }
    };
    const res = fakeRes();

    await bulkCreateAppointments(req, res);

    expect(res.body.data.created).toHaveLength(0);
    expect(res.body.data.skipped[0].motivo).toMatch(/2 horas/);
  });

  it('el paciente puede agendar con 2 horas y un poco más de anticipación (el borde de las 2 horas)', async () => {
    baseSetup();
    vi.spyOn(ClientPlan, 'findOne').mockResolvedValue({ sessionsAvailable: () => 5 });
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });
    vi.spyOn(ExtraSession, 'countDocuments').mockResolvedValue(0);

    const res = fakeRes();
    await bulkCreateAppointments({ user: { _id: PATIENT_ID, role: 'patient' }, body: { appointments: [item(2.1)] } }, res);

    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.skipped).toHaveLength(0);
  });

  it('el personal puede agendar en cualquier momento (con solo minutos de anticipación), pero nunca en el pasado', async () => {
    baseSetup();
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });
    const res = fakeRes();
    await bulkCreateAppointments({ user: { _id: nuevoId(), role: 'admin' }, body: { patient: PATIENT_ID.toString(), appointments: [item(0.2), item(-1)] } }, res);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].motivo).toMatch(/pasó/);
  });

  it('el personal agendando en lote: no se le exige saldo ni ventana de 4h, y SÍ se descuenta la sesión de cada cita', async () => {
    baseSetup();
    const balanceSpy = vi.spyOn(ClientPlan, 'findOne');
    const deductSpy = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({ _id: nuevoId() });

    const req = {
      user: { _id: nuevoId(), role: 'admin' },
      body: { patient: PATIENT_ID.toString(), appointments: [item(1)] } // 1h, se saltaría para un paciente
    };
    const res = fakeRes();

    await bulkCreateAppointments(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.created[0].sessionDeducted).toBe(true);
    expect(balanceSpy).not.toHaveBeenCalled(); // no se bloquea por saldo: se descuenta si hay, y si no, se agenda igual
    expect(deductSpy).toHaveBeenCalledTimes(1);
  });

  it('el personal agendando en lote a un paciente sin plan ni sesiones: la cita se crea sin descontar', async () => {
    baseSetup();
    vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(ExtraSession, 'findOneAndUpdate').mockResolvedValue(null);

    const req = { user: { _id: nuevoId(), role: 'admin' }, body: { patient: PATIENT_ID.toString(), appointments: [item(3)] } };
    const res = fakeRes();
    await bulkCreateAppointments(req, res);

    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.created[0].sessionDeducted).toBe(false);
    expect(res.body.data.skipped).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /availability/:id/slots/:date — slots respetan el máximo de 4 pacientes simultáneos', () => {
  const PROFESSIONAL_ID = nuevoId();

  it('un slot con 2 citas solapadas (de 4 posibles) sigue disponible, no "lleno"', async () => {
    vi.restoreAllMocks();
    vi.spyOn(Availability, 'findOne').mockResolvedValue({
      weeklySchedule: [{ dayOfWeek: getDay(parseISO('2026-09-14')), slots: [{ startTime: '10:00' }] }],
      blockedDates: []
    });
    // countOverlappingAppointments usa Appointment.countDocuments por dentro
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(2);
    vi.spyOn(Appointment, 'exists').mockResolvedValue(null);

    const req = { params: { professionalId: PROFESSIONAL_ID.toString(), date: '2026-09-14' } };
    const res = fakeRes();

    await getAvailableSlots(req, res);

    expect(res.body.data.availableSlots).toContain('10:00');
    expect(res.body.data.bookedSlots).not.toContain('10:00');
  });

  it('un slot con 4 citas solapadas (el máximo) queda "lleno"', async () => {
    vi.restoreAllMocks();
    vi.spyOn(Availability, 'findOne').mockResolvedValue({
      weeklySchedule: [{ dayOfWeek: getDay(parseISO('2026-09-14')), slots: [{ startTime: '10:00' }] }],
      blockedDates: []
    });
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(4);
    vi.spyOn(Appointment, 'exists').mockResolvedValue(null);

    const req = { params: { professionalId: PROFESSIONAL_ID.toString(), date: '2026-09-14' } };
    const res = fakeRes();

    await getAvailableSlots(req, res);

    expect(res.body.data.bookedSlots).toContain('10:00');
    expect(res.body.data.availableSlots).not.toContain('10:00');
  });
});
