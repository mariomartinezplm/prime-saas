/**
 * PRUEBAS — devolución de la sesión al borrar una cita (el personal agenda con descuento, así que un error de agenda no debe costarle una sesión al paciente).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
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

describe('borrar una cita (solo administrador)', () => {
  let devolver;
  beforeEach(() => {
    vi.restoreAllMocks();
    devolver = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({});
  });

  it('una cita programada que ya descontó una sesión la devuelve al borrarla', async () => {
    const apt = cita();
    vi.spyOn(Appointment, 'findById').mockResolvedValue(apt);
    const res = fakeRes();
    await deleteAppointment({ params: { id: String(apt._id) } }, res);
    expect(res.statusCode).toBe(200);
    expect(devolver).toHaveBeenCalledTimes(1);
    expect(apt.deleteOne).toHaveBeenCalled();
  });

  it('una cita sin descuento, o ya completada, no devuelve nada', async () => {
    for (const apt of [cita({ sessionDeducted: false }), cita({ status: 'completed' })]) {
      devolver.mockClear();
      vi.spyOn(Appointment, 'findById').mockResolvedValue(apt);
      const res = fakeRes();
      await deleteAppointment({ params: { id: String(apt._id) } }, res);
      expect(res.statusCode).toBe(200);
      expect(devolver).not.toHaveBeenCalled();
    }
  });
});
