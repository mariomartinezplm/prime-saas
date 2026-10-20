/**
 * PRUEBAS — cancelar «esta y las siguientes» citas de un horario fijo (cancelAppointment con scope: 'following').
 * El recorrido contra MongoDB real se verificó aparte; aquí, las reglas de devolución y el alcance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import RecurringSlot from '../models/RecurringSlot.js';
import * as emailService from '../services/emailService.js';
import * as notificationService from '../services/notificationService.js';
import { cancelAppointment } from '../controllers/appointmentController.js';

vi.mock('../services/achievements/index.js', () => ({ triggerAchievementEvaluation: vi.fn(async () => {}) }));

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (c) { this.statusCode = c; return this; }),
  json: vi.fn(function (b) { this.body = b; return this; })
});
const SLOT = id();
const dia = (n) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString().split('T')[0];
const cita = (n, extra = {}) => ({
  _id: id(), patient: { _id: id(), firstName: 'Ana', lastName: 'T' }, professional: { _id: id(), firstName: 'P', lastName: 'U' },
  date: new Date(`${dia(n)}T00:00:00Z`), startTime: '18:00', status: 'scheduled', sessionDeducted: true,
  deduction: { source: 'clientPlan', refId: id() }, recurringSlot: SLOT,
  populate: vi.fn(async () => {}), save: vi.fn(async () => {}), ...extra
});

describe('cancelar «esta y las siguientes»', () => {
  let refund;
  let deleteSlot;
  beforeEach(() => {
    vi.restoreAllMocks();
    refund = vi.spyOn(ClientPlan, 'findOneAndUpdate').mockResolvedValue({});
    deleteSlot = vi.spyOn(RecurringSlot, 'deleteOne').mockResolvedValue({});
    vi.spyOn(emailService, 'sendAppointmentCancelledEmail').mockImplementation(() => {});
    vi.spyOn(notificationService, 'notify').mockResolvedValue({});
  });

  const personal = { _id: id(), role: 'admin' };
  const cancelar = async (apt, siguientes, scope, user = personal) => {
    vi.spyOn(Appointment, 'findById').mockResolvedValue(apt);
    vi.spyOn(Appointment, 'find').mockResolvedValue(siguientes);
    const res = fakeRes();
    await cancelAppointment({ params: { id: String(apt._id) }, user, body: { scope } }, res);
    return res;
  };

  it('«esta y las siguientes»: cancela y devuelve las siguientes y quita el horario', async () => {
    const [a, b, c] = [cita(3), cita(10), cita(17)];
    const res = await cancelar(a, [b, c], 'following');
    expect([a.status, b.status, c.status]).toEqual(['cancelled', 'cancelled', 'cancelled']);
    expect(refund).toHaveBeenCalledTimes(3);
    expect(deleteSlot).toHaveBeenCalledTimes(1);
    expect(res.body.data.alsoCancelled).toBe(2);
  });

  it('«solo esta»: no toca las siguientes ni el horario', async () => {
    const [a, b] = [cita(3), cita(10)];
    await cancelar(a, [b], 'this');
    expect(a.status).toBe('cancelled');
    expect(b.status).toBe('scheduled');
    expect(refund).toHaveBeenCalledTimes(1);
    expect(deleteSlot).not.toHaveBeenCalled();
  });

  it('una cita que no es de un horario fijo ignora «siguientes»', async () => {
    const a = cita(3, { recurringSlot: undefined });
    const res = await cancelar(a, [], 'following');
    expect(a.status).toBe('cancelled');
    expect(deleteSlot).not.toHaveBeenCalled();
    expect(res.body.data.alsoCancelled).toBe(0);
  });
});
