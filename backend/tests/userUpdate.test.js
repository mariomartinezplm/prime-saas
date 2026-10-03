/**
 * PRUEBAS — edición de datos de un paciente por el personal (updateUser).
 *
 * Mismo patrón que invite.test.js: vitest + vi.spyOn sobre los modelos, sin BD.
 * El 403 para pacientes lo aplica authorize('admin','professional') en la ruta;
 * aquí se prueba lo propio del controller: pertenencia, campos y validaciones.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import { updateUser } from '../controllers/userController.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// Query de Mongoose "thenable" con .select() encadenable (canAccessPatient lo usa)
const query = (value) => ({
  select: () => query(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  catch: (reject) => Promise.resolve(value).catch(reject)
});

const PROF_A = nuevoId();
const PROF_B = nuevoId();
const PACIENTE_ID = nuevoId();

function pacienteDe(profId, extra = {}) {
  return {
    _id: PACIENTE_ID,
    role: 'patient',
    firstName: 'Ana',
    lastName: 'Pérez',
    assignedProfessionalId: profId,
    save: vi.fn().mockResolvedValue(true),
    ...extra
  };
}

const pedido = (user, body) => ({ params: { id: PACIENTE_ID.toString() }, user, body });

describe('updateUser — edición por el personal', () => {
  let paciente;

  beforeEach(() => {
    vi.restoreAllMocks();
    paciente = pacienteDe(PROF_A);
    vi.spyOn(User, 'findById').mockImplementation(() => query(paciente));
  });

  it('el profesional dueño edita los campos que vienen de Airtable', async () => {
    const res = fakeRes();

    await updateUser(pedido({ _id: PROF_A, role: 'professional' }, {
      gender: 'Femenino',
      healthInsurance: ' Fonasa ',
      referralSource: 'Instagram',
      objectives: ['Bajar de peso', '  ', 'Mejorar postura'],
      phone: '+56911111111'
    }), res);

    expect(res.statusCode).toBe(200);
    expect(paciente.gender).toBe('Femenino');
    expect(paciente.healthInsurance).toBe('Fonasa');
    expect(paciente.referralSource).toBe('Instagram');
    expect(paciente.objectives).toEqual(['Bajar de peso', 'Mejorar postura']);
    expect(paciente.phone).toBe('+56911111111');
    expect(paciente.save).toHaveBeenCalledTimes(1);
  });

  it('un profesional NO edita a un paciente de otro profesional: 404 y no guarda nada', async () => {
    const res = fakeRes();

    await updateUser(pedido({ _id: PROF_B, role: 'professional' }, { phone: '999' }), res);

    expect(res.statusCode).toBe(404);
    expect(paciente.save).not.toHaveBeenCalled();
    expect(paciente.phone).toBeUndefined();
  });

  it('un paciente sin profesional asignado (pool) lo puede editar cualquier profesional', async () => {
    paciente = pacienteDe(undefined);
    const res = fakeRes();

    await updateUser(pedido({ _id: PROF_B, role: 'professional' }, { phone: '999' }), res);

    expect(res.statusCode).toBe(200);
    expect(paciente.phone).toBe('999');
  });

  it('género inválido: 400 y no se guarda nada', async () => {
    const res = fakeRes();

    await updateUser(pedido({ _id: PROF_A, role: 'professional' }, { gender: 'cualquier cosa', phone: '999' }), res);

    expect(res.statusCode).toBe(400);
    expect(paciente.save).not.toHaveBeenCalled();
    expect(paciente.phone).toBeUndefined();
  });

  it('correo que ya usa otra persona: 409 con mensaje claro (no un error técnico)', async () => {
    paciente.save.mockRejectedValue(Object.assign(new Error('E11000 duplicate key ... ana@test.local'), { code: 11000 }));
    const res = fakeRes();

    await updateUser(pedido({ _id: PROF_A, role: 'professional' }, { email: 'otro@test.local' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Ya existe otra persona con ese correo');
    expect(JSON.stringify(res.body)).not.toMatch(/E11000|test\.local/);
  });

  it('el profesional no puede reasignar al paciente ni cambiar su estado (se ignora); el admin sí', async () => {
    const otroProf = nuevoId();

    await updateUser(pedido({ _id: PROF_A, role: 'professional' }, { assignedProfessionalId: otroProf.toString(), isActive: false }), fakeRes());
    expect(paciente.assignedProfessionalId).toBe(PROF_A);
    expect(paciente.isActive).toBeUndefined();

    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { assignedProfessionalId: otroProf.toString() }), fakeRes());
    expect(paciente.assignedProfessionalId).toBe(otroProf.toString());
  });

  it('el profesional no puede editar a un miembro del equipo', async () => {
    paciente = pacienteDe(undefined, { role: 'professional' });
    const res = fakeRes();

    await updateUser(pedido({ _id: PROF_A, role: 'professional' }, { phone: '999' }), res);

    expect(res.statusCode).toBe(403);
    expect(paciente.save).not.toHaveBeenCalled();
  });
});
