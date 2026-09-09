/**
 * PRUEBAS — notificaciones (Paso 19 de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';

import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Measurement from '../models/Measurement.js';
import * as emailService from '../services/emailService.js';
import { notify } from '../services/notificationService.js';
import { createMeasurement } from '../controllers/measurementController.js';
import { getUnreadCount, markAsRead } from '../controllers/notificationController.js';
import { hasActivePlan } from '../services/clientPlanService.js';

vi.mock('../services/clientPlanService.js', () => ({
  hasActivePlan: vi.fn().mockResolvedValue(true)
}));

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

describe('notificationService.notify', () => {
  it('crea el registro in-app', async () => {
    const userId = nuevoId();
    const createSpy = vi.spyOn(Notification, 'create').mockResolvedValue({ _id: nuevoId() });
    vi.spyOn(User, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    await notify(userId, 'appointment_booked', { title: 'T', body: 'B', link: '/x' });

    expect(createSpy).toHaveBeenCalledWith({ user: userId, type: 'appointment_booked', title: 'T', body: 'B', link: '/x' });
  });

  it('espeja por email los tipos importantes (plan_expiring)', async () => {
    const userId = nuevoId();
    vi.spyOn(Notification, 'create').mockResolvedValue({ _id: nuevoId() });
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockResolvedValue({ email: 'p@test.local', firstName: 'Pat' })
    });
    const emailSpy = vi.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue(undefined);

    await notify(userId, 'plan_expiring', { title: 'Vence pronto', body: 'B' });
    await new Promise((r) => setTimeout(r, 0)); // deja correr el .then() fire-and-forget

    expect(emailSpy).toHaveBeenCalled();
  });

  it('NO espeja por email appointment_booked/appointment_cancelled (ya tienen su propio email)', async () => {
    const userId = nuevoId();
    vi.spyOn(Notification, 'create').mockResolvedValue({ _id: nuevoId() });
    const findByIdSpy = vi.spyOn(User, 'findById');
    const emailSpy = vi.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue(undefined);

    await notify(userId, 'appointment_booked', { title: 'T', body: 'B' });
    await notify(userId, 'appointment_cancelled', { title: 'T', body: 'B' });
    await new Promise((r) => setTimeout(r, 0));

    expect(findByIdSpy).not.toHaveBeenCalled();
    expect(emailSpy).not.toHaveBeenCalled();
  });
});

describe('POST /measurements — evento evolución cableado', () => {
  const PATIENT_ID = nuevoId();
  const PROF_ID = nuevoId();

  it('paciente registra una medición: notifica SOLO a su profesional asignado', async () => {
    vi.restoreAllMocks();
    vi.mocked(hasActivePlan).mockResolvedValue(true);
    vi.spyOn(Measurement, 'create').mockResolvedValue({
      _id: nuevoId(), populate: vi.fn().mockResolvedValue(undefined)
    });
    const notifCreateSpy = vi.spyOn(Notification, 'create').mockResolvedValue({ _id: nuevoId() });
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === PATIENT_ID.toString()) {
        return Promise.resolve({ _id: PATIENT_ID, firstName: 'Ana', lastName: 'Paciente', assignedProfessionalId: PROF_ID });
      }
      return { select: vi.fn().mockResolvedValue(null) };
    });

    const req = {
      user: { _id: PATIENT_ID, role: 'patient' },
      body: { date: new Date(), perimeters: {}, weight: 70 }
    };
    const res = fakeRes();

    await createMeasurement(req, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.statusCode).toBe(201);
    expect(notifCreateSpy).toHaveBeenCalledWith(expect.objectContaining({
      user: PROF_ID,
      type: 'evolution_updated'
    }));
  });

  it('staff registra la medición de un paciente: no se notifica a nadie', async () => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: PATIENT_ID, firstName: 'Ana', lastName: 'Paciente', assignedProfessionalId: PROF_ID
    });
    vi.spyOn(Measurement, 'create').mockResolvedValue({
      _id: nuevoId(), populate: vi.fn().mockResolvedValue(undefined)
    });
    const notifCreateSpy = vi.spyOn(Notification, 'create');

    const req = {
      user: { _id: PROF_ID, role: 'professional' },
      body: { patient: PATIENT_ID.toString(), date: new Date(), perimeters: {}, weight: 70 }
    };
    const res = fakeRes();

    await createMeasurement(req, res);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.statusCode).toBe(201);
    expect(notifCreateSpy).not.toHaveBeenCalled();
  });
});

describe('Notificaciones — el usuario solo ve/marca lo suyo', () => {
  it('getUnreadCount cuenta solo las del usuario autenticado', async () => {
    const userId = nuevoId();
    const countSpy = vi.spyOn(Notification, 'countDocuments').mockResolvedValue(3);

    const req = { user: { _id: userId } };
    const res = fakeRes();
    await getUnreadCount(req, res);

    expect(countSpy).toHaveBeenCalledWith({ user: userId, read: false });
    expect(res.body.data.count).toBe(3);
  });

  it('markAsRead filtra por user en la query — no se puede marcar una ajena', async () => {
    const userId = nuevoId();
    const otherId = nuevoId();
    const findSpy = vi.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(null);

    const req = { user: { _id: userId }, params: { id: otherId.toString() } };
    const res = fakeRes();
    await markAsRead(req, res);

    expect(findSpy).toHaveBeenCalledWith(
      { _id: otherId.toString(), user: userId },
      expect.objectContaining({ $set: expect.objectContaining({ read: true }) }),
      expect.objectContaining({ new: true })
    );
    expect(res.statusCode).toBe(404);
  });
});
