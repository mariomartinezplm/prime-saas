/**
 * PRUEBAS — profesional asignado al registrar un paciente y asignación de los que quedaron sin profesional.
 * Mismo patrón que userUpdate.test.js: vitest + vi.spyOn sobre los modelos, sin base de datos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import * as inviteService from '../services/inviteService.js';
import { createUser, countUnassignedPatients, assignUnassignedPatients } from '../controllers/userController.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const query = (value) => ({ select: () => query(value), then: (ok, no) => Promise.resolve(value).then(ok, no) });

const ADMIN = nuevoId();
const PROF = nuevoId();
const base = { firstName: 'Ana', lastName: 'Pérez', email: 'ana@ejemplo.invalid' };

describe('registrar un paciente: profesional asignado', () => {
  let creado;
  beforeEach(() => {
    vi.restoreAllMocks();
    creado = null;
    vi.spyOn(inviteService, 'createInvite').mockResolvedValue(undefined);
    vi.spyOn(User, 'create').mockImplementation(async (doc) => { creado = doc; return { _id: nuevoId(), ...doc }; });
    vi.spyOn(User, 'findOne').mockImplementation((filter) => {
      if (filter.email) return Promise.resolve(null); // el correo no existe
      return query(String(filter._id) === String(PROF) ? { _id: PROF } : null); // profesional activo
    });
  });

  it('el administrador que registra SIN elegir profesional queda como profesional del paciente', async () => {
    const res = fakeRes();
    await createUser({ user: { _id: ADMIN, role: 'admin' }, body: { ...base } }, res);
    expect(res.statusCode).toBe(201);
    expect(String(creado.assignedProfessionalId)).toBe(String(ADMIN));
  });

  it('el administrador puede elegir a otro profesional', async () => {
    const res = fakeRes();
    await createUser({ user: { _id: ADMIN, role: 'admin' }, body: { ...base, assignedProfessionalId: String(PROF) } }, res);
    expect(res.statusCode).toBe(201);
    expect(String(creado.assignedProfessionalId)).toBe(String(PROF));
  });

  it('dejarlo sin asignar es explícito (cadena vacía)', async () => {
    const res = fakeRes();
    await createUser({ user: { _id: ADMIN, role: 'admin' }, body: { ...base, assignedProfessionalId: '' } }, res);
    expect(res.statusCode).toBe(201);
    expect(creado.assignedProfessionalId).toBeUndefined();
  });

  it('un profesional que no existe, está inactivo o viene mal formado se rechaza y no se crea nada', async () => {
    for (const malo of [String(nuevoId()), 'abc']) {
      const res = fakeRes();
      await createUser({ user: { _id: ADMIN, role: 'admin' }, body: { ...base, assignedProfessionalId: malo } }, res);
      expect(res.statusCode).toBe(400);
    }
    expect(creado).toBeNull();
  });

  it('un profesional que registra queda siempre como el profesional (ignora lo que mande el formulario)', async () => {
    const res = fakeRes();
    await createUser({ user: { _id: PROF, role: 'professional' }, body: { ...base, assignedProfessionalId: String(ADMIN) } }, res);
    expect(res.statusCode).toBe(201);
    expect(String(creado.assignedProfessionalId)).toBe(String(PROF));
  });
});

describe('pacientes sin profesional: contar y asignar', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('cuenta solo pacientes sin profesional asignado', async () => {
    const spy = vi.spyOn(User, 'countDocuments').mockResolvedValue(7);
    const res = fakeRes();
    await countUnassignedPatients({}, res);
    expect(res.body.data.count).toBe(7);
    const filtro = spy.mock.calls[0][0];
    expect(filtro.role).toBe('patient');
    expect(JSON.stringify(filtro.$or)).toContain('assignedProfessionalId');
  });

  it('asigna el profesional elegido SOLO a quienes no tenían uno', async () => {
    vi.spyOn(User, 'findOne').mockImplementation(() => query({ _id: PROF }));
    const spy = vi.spyOn(User, 'updateMany').mockResolvedValue({ modifiedCount: 12 });
    const res = fakeRes();
    await assignUnassignedPatients({ body: { professionalId: String(PROF) } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.modified).toBe(12);
    const [filtro, cambio] = spy.mock.calls[0];
    expect(filtro.role).toBe('patient');
    expect(JSON.stringify(filtro.$or)).toContain('assignedProfessionalId'); // nunca pisa a quien ya tiene profesional
    expect(String(cambio.$set.assignedProfessionalId)).toBe(String(PROF));
  });

  it('sin un profesional válido no cambia nada', async () => {
    vi.spyOn(User, 'findOne').mockImplementation(() => query(null));
    const spy = vi.spyOn(User, 'updateMany');
    for (const body of [{}, { professionalId: 'abc' }, { professionalId: String(nuevoId()) }]) {
      const res = fakeRes();
      await assignUnassignedPatients({ body }, res);
      expect(res.statusCode).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });
});
