/**
 * PRUEBAS — «Renovación automática» es una marca que solo el administrador pone o quita (User.autoRenew), al registrar, al renovar
 * o al editar al paciente. Mismo patrón que founderFlag.test.js.
 */
import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { createUser, updateUser } from '../controllers/userController.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});
const query = (value) => ({ select: () => query(value), then: (ok, no) => Promise.resolve(value).then(ok, no) });

const PATIENT_ID = nuevoId();
const PROF = nuevoId();

const prep = () => {
  vi.restoreAllMocks();
  const paciente = { _id: PATIENT_ID, role: 'patient', assignedProfessionalId: PROF, autoRenew: false, save: vi.fn().mockResolvedValue(true) };
  vi.spyOn(User, 'findById').mockImplementation(() => query(paciente));
  return paciente;
};
const pedido = (user, body) => ({ params: { id: PATIENT_ID.toString() }, user, body });

describe('quién puede activar la renovación automática de un paciente (editar)', () => {
  it('el admin la activa y la apaga', async () => {
    const paciente = prep();
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { autoRenew: true }), fakeRes());
    expect(paciente.autoRenew).toBe(true);
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { autoRenew: false }), fakeRes());
    expect(paciente.autoRenew).toBe(false);
  });

  it('un profesional (aunque sea el dueño del paciente) NO puede: se ignora el campo', async () => {
    const paciente = prep();
    await updateUser(pedido({ _id: PROF, role: 'professional' }, { autoRenew: true, phone: '+56911111111' }), fakeRes());
    expect(paciente.autoRenew).toBe(false);
    expect(paciente.phone).toBe('+56911111111');
  });

  it('un valor que no es verdadero/falso se rechaza con 400 y no guarda nada', async () => {
    const paciente = prep();
    const res = fakeRes();
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { autoRenew: 'si' }), res);
    expect(res.statusCode).toBe(400);
    expect(paciente.save).not.toHaveBeenCalled();
  });

  it('solo se marca a pacientes (a una cuenta de personal no)', async () => {
    const staff = { _id: PATIENT_ID, role: 'professional', autoRenew: false, save: vi.fn().mockResolvedValue(true) };
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockImplementation(() => query(staff));
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { autoRenew: true }), fakeRes());
    expect(staff.autoRenew).toBe(false);
  });

  it('el propio paciente no puede activársela desde su perfil', async () => {
    vi.restoreAllMocks();
    const { updateProfile } = await import('../controllers/authController.js');
    const spy = vi.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: async () => ({ _id: PATIENT_ID }) });
    await updateProfile({ user: { _id: PATIENT_ID, role: 'patient' }, body: { firstName: 'Ana', autoRenew: true } }, fakeRes());
    expect(spy.mock.calls[0]?.[1] ?? {}).not.toHaveProperty('autoRenew');
  });
});

describe('al registrar un paciente', () => {
  const alta = async (user, body) => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(User, 'create').mockImplementation(async (doc) => ({ _id: nuevoId(), ...doc }));
    const res = fakeRes();
    await createUser({ user, body: { firstName: 'Ana', lastName: 'Prueba', email: 'ana@ejemplo.invalid', dateOfBirth: '1990-05-05', ...body } }, res);
    return { res, create };
  };

  it('el admin puede dejarlo con renovación automática desde el primer día', async () => {
    const { res, create } = await alta({ _id: nuevoId(), role: 'admin' }, { autoRenew: true });
    expect(res.statusCode).toBe(201);
    expect(create.mock.calls[0][0].autoRenew).toBe(true);
  });

  it('sin pedirlo, no queda activada; y un profesional no puede activarla al registrar', async () => {
    expect((await alta({ _id: nuevoId(), role: 'admin' }, {})).create.mock.calls[0][0]).not.toHaveProperty('autoRenew');
    const { create } = await alta({ _id: PROF, role: 'professional' }, { autoRenew: true });
    expect(create.mock.calls[0][0]).not.toHaveProperty('autoRenew');
  });
});
