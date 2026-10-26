/**
 * PRUEBAS — «Miembro Fundador» es una marca que solo el administrador pone o quita (User.isFounder).
 * Mismo patrón que capacityExempt.test.js: vitest + vi.spyOn sobre los modelos, sin base de datos.
 */
import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { updateUser } from '../controllers/userController.js';

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
  const paciente = { _id: PATIENT_ID, role: 'patient', assignedProfessionalId: PROF, isFounder: false, save: vi.fn().mockResolvedValue(true) };
  vi.spyOn(User, 'findById').mockImplementation(() => query(paciente));
  return paciente;
};
const pedido = (user, body) => ({ params: { id: PATIENT_ID.toString() }, user, body });

describe('quién puede marcar a un paciente como Miembro Fundador', () => {
  it('el admin lo marca y lo quita', async () => {
    const paciente = prep();
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { isFounder: true }), fakeRes());
    expect(paciente.isFounder).toBe(true);
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { isFounder: false }), fakeRes());
    expect(paciente.isFounder).toBe(false);
  });

  it('un profesional (aunque sea el dueño del paciente) NO puede: se ignora el campo', async () => {
    const paciente = prep();
    await updateUser(pedido({ _id: PROF, role: 'professional' }, { isFounder: true, phone: '+56911111111' }), fakeRes());
    expect(paciente.isFounder).toBe(false);
    expect(paciente.phone).toBe('+56911111111'); // lo demás sí se guarda
  });

  it('un valor que no es verdadero/falso se rechaza con 400 y no guarda nada', async () => {
    const paciente = prep();
    const res = fakeRes();
    await updateUser(pedido({ _id: nuevoId(), role: 'admin' }, { isFounder: 'si' }), res);
    expect(res.statusCode).toBe(400);
    expect(paciente.save).not.toHaveBeenCalled();
  });

  it('el propio paciente no puede darse la estrella desde su perfil (la lista de campos de /auth/profile no la incluye)', async () => {
    const { updateProfile } = await import('../controllers/authController.js');
    const spy = vi.spyOn(User, 'findByIdAndUpdate').mockReturnValue({ select: async () => ({ _id: PATIENT_ID }) });
    await updateProfile({ user: { _id: PATIENT_ID, role: 'patient' }, body: { firstName: 'Ana', isFounder: true } }, fakeRes());
    const applied = spy.mock.calls[0]?.[1] ?? {};
    expect(applied).not.toHaveProperty('isFounder');
  });
});
