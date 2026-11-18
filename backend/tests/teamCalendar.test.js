/**
 * PRUEBAS — agenda de los demás profesionales (solo lectura): el equipo puede ver cuándo y con quién atienden sus colegas,
 * sin acceder a sus fichas.
 */
import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { getTeamAppointments } from '../controllers/teamCalendarController.js';
import router from '../routes/appointmentRoutes.js';

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (c) { this.statusCode = c; return this; }),
  json: vi.fn(function (b) { this.body = b; return this; })
});
const ME = id();
const FELIPE = id();

const prep = (rows = []) => {
  vi.restoreAllMocks();
  const userFind = vi.spyOn(User, 'find').mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [{ _id: FELIPE, firstName: 'Felipe', lastName: 'Rojas' }] }) }) });
  const aptFind = vi.spyOn(Appointment, 'find').mockReturnValue({ populate: () => ({ populate: () => ({ sort: () => ({ limit: () => ({ lean: async () => rows }) }) }) }) });
  return { userFind, aptFind };
};
const row = (extra = {}) => ({
  _id: id(), professional: { _id: FELIPE, firstName: 'Felipe', lastName: 'Rojas' },
  patient: { _id: id(), firstName: 'Camila', lastName: 'Soto', email: 'c@x.invalid', phone: '+56911112222', rut: '1-9' },
  date: new Date('2026-11-19T00:00:00.000Z'), startTime: '18:00', endTime: '19:00', type: 'entrenamiento', status: 'scheduled',
  notes: 'dato clínico', deduction: { source: 'clientPlan', refId: id() }, sessionNotes: 'privado', ...extra
});

describe('agenda del equipo', () => {
  it('devuelve solo lo necesario para organizarse: quién, cuándo y tipo', async () => {
    prep([row()]);
    const res = fakeRes();
    await getTeamAppointments({ user: { _id: ME, role: 'professional' }, query: {} }, res);
    expect(res.statusCode).toBe(200);
    const [a] = res.body.data.appointments;
    expect(a).toEqual({
      id: expect.any(String),
      professional: { id: String(FELIPE), firstName: 'Felipe', lastName: 'Rojas' },
      patientName: 'Camila Soto',
      date: expect.any(Date), startTime: '18:00', endTime: '19:00', type: 'entrenamiento', status: 'scheduled'
    });
  });

  it('nunca expone correo, teléfono, RUT, ids de paciente, notas, sesiones ni descuentos', async () => {
    prep([row()]);
    const res = fakeRes();
    await getTeamAppointments({ user: { _id: ME, role: 'professional' }, query: {} }, res);
    const text = JSON.stringify(res.body);
    for (const secret of ['c@x.invalid', '+56911112222', '1-9', 'dato clínico', 'privado', 'deduction', 'refId']) expect(text).not.toContain(secret);
  });

  it('no incluye las citas del propio usuario ni las canceladas (lo pide en la consulta)', async () => {
    const { aptFind, userFind } = prep([]);
    await getTeamAppointments({ user: { _id: ME, role: 'professional' }, query: {} }, fakeRes());
    expect(aptFind.mock.calls[0][0]).toMatchObject({ professional: { $ne: ME }, status: { $ne: 'cancelled' } });
    expect(userFind.mock.calls[0][0]).toMatchObject({ _id: { $ne: ME } });
  });

  it('entrega también la lista de colegas para el filtro', async () => {
    prep([]);
    const res = fakeRes();
    await getTeamAppointments({ user: { _id: ME, role: 'professional' }, query: {} }, res);
    expect(res.body.data.professionals).toEqual([{ id: String(FELIPE), firstName: 'Felipe', lastName: 'Rojas' }]);
  });

  it('fechas inválidas: 400', async () => {
    prep([]);
    const res = fakeRes();
    await getTeamAppointments({ user: { _id: ME, role: 'professional' }, query: { from: 'mañana' } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('la ruta es solo para el equipo y va antes de /:id', () => {
    const idx = router.stack.findIndex((l) => l.route?.path === '/team');
    const idxId = router.stack.findIndex((l) => l.route?.path === '/:id');
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(idxId);
    expect(router.stack[idx].route.stack.length).toBe(2); // authorize(admin, professional) + controlador
  });
});
