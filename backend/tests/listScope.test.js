/**
 * PRUEBAS — alcance de dos listados de personal:
 *   GET /client-plans            → admin: todos los planes; profesional: solo los de SUS pacientes
 *   GET /appointments?patient=…  → filtro por paciente con control de acceso
 *
 * Regla de pertenencia (BLUEPRINT.md §8.5): profesional = pacientes asignados + pool sin
 * profesional. Antes /client-plans devolvía los planes (con nombre y correo) de todo el centro a
 * cualquier profesional, y no existía el filtro por paciente de las citas (la ficha bajaba todas
 * las citas de su alcance y filtraba en el navegador).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import { getAllClientPlans } from '../controllers/clientPlanController.js';
import { getAppointments } from '../controllers/appointmentController.js';

vi.mock('../services/planLifecycleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  advancePlans: vi.fn(async () => {})
}));

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const query = (value) => ({
  select: () => query(value),
  populate: () => query(value),
  sort: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
});

const MI_ID = nuevoId();
const OTRO_PRO_ID = nuevoId();
const PACIENTE_MIO = nuevoId();
const PACIENTE_AJENO = nuevoId();
const PACIENTE_POOL = nuevoId();
const pacientes = {
  [PACIENTE_MIO]: { _id: PACIENTE_MIO, role: 'patient', assignedProfessionalId: MI_ID },
  [PACIENTE_AJENO]: { _id: PACIENTE_AJENO, role: 'patient', assignedProfessionalId: OTRO_PRO_ID },
  [PACIENTE_POOL]: { _id: PACIENTE_POOL, role: 'patient' }
};
const profesional = { _id: MI_ID, role: 'professional' };
const admin = { _id: nuevoId(), role: 'admin' };

const POOL_Y_ASIGNADOS = [
  { assignedProfessionalId: MI_ID },
  { assignedProfessionalId: { $exists: false } },
  { assignedProfessionalId: null }
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(User, 'findById').mockImplementation((id) => query(pacientes[id.toString()] ?? null));
});

describe('GET /client-plans', () => {
  const prepare = () => {
    const distinct = vi.spyOn(User, 'distinct').mockResolvedValue([PACIENTE_MIO, PACIENTE_POOL]);
    const find = vi.spyOn(ClientPlan, 'find').mockReturnValue(query([]));
    return { distinct, find };
  };

  it('un profesional solo recibe los planes de sus pacientes (asignados + pool)', async () => {
    const { distinct, find } = prepare();
    const res = fakeRes();
    await getAllClientPlans({ user: profesional }, res);

    expect(res.statusCode).toBe(200);
    expect(distinct.mock.calls[0][0]).toBe('_id');
    expect(distinct.mock.calls[0][1]).toEqual({ role: 'patient', $or: POOL_Y_ASIGNADOS });
    expect(find.mock.calls[0][0].patient).toEqual({ $in: [PACIENTE_MIO, PACIENTE_POOL] });
    expect(find.mock.calls[0][0].status).toEqual({ $in: ['active', 'expired'] });
  });

  it('un profesional sin pacientes recibe una lista vacía (no todos los planes)', async () => {
    const { find } = prepare();
    User.distinct.mockResolvedValue([]);
    await getAllClientPlans({ user: profesional }, fakeRes());
    expect(find.mock.calls[0][0].patient).toEqual({ $in: [] });
  });

  it('el admin ve los planes de todos: sin filtro por paciente', async () => {
    const { distinct, find } = prepare();
    const res = fakeRes();
    await getAllClientPlans({ user: admin }, res);

    expect(res.statusCode).toBe(200);
    expect(distinct).not.toHaveBeenCalled();
    expect(find.mock.calls[0][0].patient).toBeUndefined();
  });
});

describe('GET /appointments — filtro por paciente', () => {
  const prepare = () => vi.spyOn(Appointment, 'find').mockReturnValue(query([]));
  const req = (user, qs = {}) => ({ user, query: qs });

  it('sin el filtro, el profesional sigue viendo solo SUS citas (sin cambios)', async () => {
    const find = prepare();
    await getAppointments(req(profesional), fakeRes());
    expect(find.mock.calls[0][0]).toEqual({ professional: MI_ID });
  });

  it('con un paciente suyo ve TODAS las citas de ese paciente, también las de un colega', async () => {
    const find = prepare();
    const res = fakeRes();
    await getAppointments(req(profesional, { patient: PACIENTE_MIO.toString(), status: 'scheduled' }), res);

    expect(res.statusCode).toBe(200);
    const filtro = find.mock.calls[0][0];
    expect(filtro.patient).toBe(PACIENTE_MIO.toString());
    expect(filtro.professional).toBeUndefined();
    expect(filtro.status).toBe('scheduled');
  });

  it('también con un paciente del pool', async () => {
    prepare();
    const res = fakeRes();
    await getAppointments(req(profesional, { patient: PACIENTE_POOL.toString() }), res);
    expect(res.statusCode).toBe(200);
  });

  it('con un paciente de OTRO profesional responde 404 y no consulta ninguna cita', async () => {
    const find = prepare();
    const res = fakeRes();
    await getAppointments(req(profesional, { patient: PACIENTE_AJENO.toString() }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Paciente no encontrado');
    expect(find).not.toHaveBeenCalled();
  });

  it('un id inválido responde 404 (no un error del servidor)', async () => {
    const find = prepare();
    const res = fakeRes();
    await getAppointments(req(admin, { patient: 'no-es-un-id' }), res);
    expect(res.statusCode).toBe(404);
    expect(find).not.toHaveBeenCalled();
  });

  it('el admin filtra por cualquier paciente', async () => {
    const find = prepare();
    await getAppointments(req(admin, { patient: PACIENTE_AJENO.toString() }), fakeRes());
    expect(find.mock.calls[0][0].patient).toBe(PACIENTE_AJENO.toString());
  });

  it('un paciente ignora el filtro: siempre ve solo lo suyo', async () => {
    const find = prepare();
    const yo = { _id: PACIENTE_MIO, role: 'patient' };
    await getAppointments(req(yo, { patient: PACIENTE_AJENO.toString() }), fakeRes());
    expect(find.mock.calls[0][0].patient).toBe(PACIENTE_MIO);
  });
});
