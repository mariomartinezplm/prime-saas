/**
 * PRUEBAS — indicador de invitación para el personal (estado de la invitación y último ingreso).
 *
 * Mismo patrón que invite.test.js: vitest + vi.spyOn sobre los modelos, sin base de datos real.
 * Reglas: el estado (sin invitar / enviada / vencida / activada) lo ve SOLO el personal; el token de invitación
 * nunca sale por la API; un fallo al registrar el ingreso nunca impide entrar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import EVA from '../models/EVA.js';
import RefreshToken from '../models/RefreshToken.js';
import { inviteStatusOf } from '../services/inviteService.js';
import { getAllUsers, getPatientProfile } from '../controllers/userController.js';
import { acceptInvite } from '../controllers/authController.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-prueba-solo-para-tests';

const nuevoId = () => new mongoose.Types.ObjectId();
const AHORA = new Date();
const enDias = (n) => new Date(AHORA.getTime() + n * 24 * 60 * 60 * 1000);

const paciente = (extra = {}) => ({ role: 'patient', ...extra });
const conToken = (extra = {}) => ({ tokenHash: 'hash-secreto', expiresAt: enDias(5), usedAt: null, ...extra });

describe('inviteStatusOf: el estado de la invitación de un paciente', () => {
  it('sin invitación y sin haber entrado: "not_invited"', () => {
    expect(inviteStatusOf(paciente(), AHORA)).toBe('not_invited');
    expect(inviteStatusOf(paciente({ invite: undefined, lastLoginAt: undefined }), AHORA)).toBe('not_invited');
  });

  it('invitación enviada que todavía sirve: "pending"; si ya venció sin usarse: "expired"', () => {
    expect(inviteStatusOf(paciente({ invite: conToken({ expiresAt: enDias(5) }) }), AHORA)).toBe('pending');
    expect(inviteStatusOf(paciente({ invite: conToken({ expiresAt: enDias(-1) }) }), AHORA)).toBe('expired');
  });

  it('invitación usada o ingreso registrado: "activated"', () => {
    expect(inviteStatusOf(paciente({ invite: conToken({ usedAt: enDias(-2) }) }), AHORA)).toBe('activated');
    expect(inviteStatusOf(paciente({ lastLoginAt: enDias(-3) }), AHORA)).toBe('activated');
  });

  it('una invitación nueva sin usar manda sobre un ingreso anterior (se está reiniciando el acceso)', () => {
    expect(inviteStatusOf(paciente({ lastLoginAt: enDias(-30), invite: conToken() }), AHORA)).toBe('pending');
    expect(inviteStatusOf(paciente({ lastLoginAt: enDias(-30), invite: conToken({ expiresAt: enDias(-1) }) }), AHORA)).toBe('expired');
  });

  it('solo aplica a pacientes (el personal no tiene invitación que seguir)', () => {
    expect(inviteStatusOf({ role: 'professional', invite: conToken() }, AHORA)).toBeNull();
    expect(inviteStatusOf({ role: 'admin' }, AHORA)).toBeNull();
    expect(inviteStatusOf(null, AHORA)).toBeNull();
  });
});

// ── Listado y ficha ─────────────────────────────────────────────────────────
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

// Documento "de Mongoose": toJSON aplica el mismo filtro de seguridad real (quita la contraseña y el token)
const docUsuario = (campos) => ({
  ...campos,
  toJSON() {
    const { toJSON, password, invite, ...resto } = this;
    return resto;
  }
});

const cadena = (resultado) => {
  const chain = { select: () => chain, sort: () => chain, limit: () => chain, skip: () => chain, then: (res, rej) => Promise.resolve(resultado).then(res, rej) };
  return chain;
};

describe('listado de pacientes (getAllUsers)', () => {
  const pendiente = docUsuario({ _id: nuevoId(), role: 'patient', firstName: 'Ana', password: 'x', invite: conToken() });
  const activa = docUsuario({ _id: nuevoId(), role: 'patient', firstName: 'Luis', password: 'x', lastLoginAt: enDias(-1) });
  const sinInvitar = docUsuario({ _id: nuevoId(), role: 'patient', firstName: 'Eva', password: 'x' });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'find').mockReturnValue(cadena([pendiente, activa, sinInvitar]));
    vi.spyOn(User, 'countDocuments').mockResolvedValue(3);
  });

  it('el admin ve el estado de cada paciente, y el token de invitación NUNCA sale', async () => {
    const res = fakeRes();
    await getAllUsers({ user: { _id: nuevoId(), role: 'admin' }, query: { role: 'patient' } }, res);

    const users = res.body.data.users;
    expect(users.map((u) => [u.firstName, u.inviteStatus])).toEqual([['Ana', 'pending'], ['Luis', 'activated'], ['Eva', 'not_invited']]);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toMatch(/hash-secreto|tokenHash|"invite"|"password"/);
  });

  it('un profesional ve el estado de SUS pacientes', async () => {
    const res = fakeRes();
    await getAllUsers({ user: { _id: nuevoId(), role: 'professional' }, query: {} }, res);
    expect(res.body.data.users[0].inviteStatus).toBe('pending');
  });

  it('el directorio de profesionales y lo que ve un paciente NO llevan estado de invitación', async () => {
    const colegas = [docUsuario({ _id: nuevoId(), role: 'professional', firstName: 'Andrea', invite: conToken() })];
    User.find.mockReturnValue(cadena(colegas));
    const res = fakeRes();
    await getAllUsers({ user: { _id: nuevoId(), role: 'professional' }, query: { role: 'professional' } }, res);
    expect(res.body.data.users[0].inviteStatus).toBeUndefined();

    const comoPaciente = fakeRes();
    await getAllUsers({ user: { _id: nuevoId(), role: 'patient' }, query: { role: 'professional' } }, comoPaciente);
    expect(comoPaciente.body.data.users[0].inviteStatus).toBeUndefined();
    expect(JSON.stringify(comoPaciente.body)).not.toMatch(/hash-secreto/);
  });
});

describe('ficha del paciente (getPatientProfile)', () => {
  const PACIENTE = nuevoId();
  const ficha = () => docUsuario({ _id: PACIENTE, role: 'patient', firstName: 'Ana', password: 'x', invite: conToken(), lastLoginAt: enDias(-1) });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve(ficha()) });
    vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(Appointment, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ populate: () => Promise.resolve([]) }) }) });
    vi.spyOn(Measurement, 'find').mockReturnValue({ sort: () => ({ limit: () => Promise.resolve([]) }) });
    vi.spyOn(ExerciseProgress, 'distinct').mockResolvedValue([]);
    vi.spyOn(EVA, 'find').mockReturnValue({ sort: () => ({ limit: () => Promise.resolve([]) }) });
  });

  it('el personal recibe el estado y el último ingreso, sin el token', async () => {
    const res = fakeRes();
    await getPatientProfile({ user: { _id: nuevoId(), role: 'professional' }, params: { id: String(PACIENTE) } }, res);
    expect(res.body.data.patient.inviteStatus).toBe('pending');
    expect(res.body.data.patient.lastLoginAt).toEqual(enDias(-1));
    expect(JSON.stringify(res.body)).not.toMatch(/hash-secreto|tokenHash/);
  });

  it('el propio paciente NO recibe el estado de su invitación', async () => {
    const res = fakeRes();
    await getPatientProfile({ user: { _id: PACIENTE, role: 'patient' }, params: { id: String(PACIENTE) } }, res);
    expect(res.body.data.patient.inviteStatus).toBeUndefined();
  });
});

describe('último ingreso: un fallo al registrarlo nunca impide entrar', () => {
  it('si no se puede guardar el ingreso, la activación de la cuenta igual responde 200', async () => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = 'otro-token';
    const userMock = {
      _id: nuevoId(), firstName: 'Ana', lastName: 'T', fullName: 'Ana T', email: 'a@t.cl', role: 'patient', phone: '', profileImage: '',
      invite: { tokenHash: crypto.createHash('sha256').update(raw).digest('hex'), usedAt: null, expiresAt: enDias(5) },
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(User, 'findOne').mockResolvedValue(userMock);
    vi.spyOn(User, 'updateOne').mockRejectedValue(new Error('Mongo no responde'));
    vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({});
    vi.spyOn(RefreshToken, 'create').mockResolvedValue({});
    const res = { status: vi.fn(function (c) { this.statusCode = c; return this; }), json: vi.fn(function (b) { this.body = b; return this; }), cookie: vi.fn(), clearCookie: vi.fn() };

    await acceptInvite({ params: { token: raw }, body: { password: 'contrasenaValida1' }, headers: {}, ip: '127.0.0.1' }, res);

    expect(res.statusCode).toBe(200);
    expect(console.error).toHaveBeenCalled();
  });
});
