/**
 * PRUEBAS — devolución de la sesión al borrar una cita (el personal agenda con descuento, así que un error de agenda no debe costarle una sesión al paciente).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { deleteAppointment } from '../controllers/appointmentController.js';

vi.mock('../services/achievements/index.js', () => ({ triggerAchievementEvaluation: vi.fn(async () => {}) }));

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const cita = (over = {}) => ({
  _id: id(), patient: id(), status: 'scheduled', sessionDeducted: true,
  deduction: { source: 'clientPlan', refId: id() }, deleteOne: vi.fn(async () => {}), ...over
});

describe('borrar una cita (administrador y kinesiólogo de ese paciente)', () => {
  let devolver;
  const admin = { _id: id(), role: 'admin' };
  beforeEach(() => {
    vi.restoreAllMocks();
    devolver = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({});
  });
  const borrar = async (apt, user = admin) => {
    vi.spyOn(Appointment, 'findById').mockResolvedValue(apt);
    const res = fakeRes();
    await deleteAppointment({ params: { id: String(apt._id) }, user }, res);
    return res;
  };

  it('una cita programada que ya descontó una sesión la devuelve al borrarla', async () => {
    const apt = cita();
    const res = await borrar(apt);
    expect(res.statusCode).toBe(200);
    expect(devolver).toHaveBeenCalledTimes(1);
    expect(apt.deleteOne).toHaveBeenCalled();
  });

  it('una cita ya realizada (sesión usada) también devuelve la sesión al borrarla', async () => {
    const res = await borrar(cita({ status: 'completed' }));
    expect(res.statusCode).toBe(200);
    expect(devolver).toHaveBeenCalledTimes(1);
  });

  it('una cita sin descuento no devuelve nada', async () => {
    const res = await borrar(cita({ sessionDeducted: false }));
    expect(res.statusCode).toBe(200);
    expect(devolver).not.toHaveBeenCalled();
  });

  it('un profesional que no atiende a ese paciente no puede borrarla (404) y no se toca nada', async () => {
    const apt = cita({ professional: id() });
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve({ _id: apt.patient, role: 'patient', assignedProfessionalId: id() }) });
    const res = await borrar(apt, { _id: id(), role: 'professional' });
    expect(res.statusCode).toBe(404);
    expect(apt.deleteOne).not.toHaveBeenCalled();
    expect(devolver).not.toHaveBeenCalled();
  });
});
