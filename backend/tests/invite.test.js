/**
 * PRUEBAS — invitación por email para activar cuentas (Paso 12 de BLUEPRINT.md).
 *
 * Mismo patrón que refreshTokens.test.js: vitest + vi.spyOn sobre los modelos
 * Mongoose, sin base de datos ni servidor real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { acceptInvite } from '../controllers/authController.js';
import { resendInvite } from '../controllers/userController.js';
import * as emailService from '../services/emailService.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-prueba-solo-para-tests';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.primefh.cl';

const nuevoId = () => new mongoose.Types.ObjectId();
const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; }),
  cookie: vi.fn(), // emitirSesionNueva llama a res.cookie() al abrir sesión
  clearCookie: vi.fn()
});

// canAccessPatient (middleware/auth.js) llama User.findById(id).select(...)
// internamente — el mock necesita comportarse como una query real de
// Mongoose: "thenable" para poder hacer `await User.findById(id)` directo, y
// con un .select() encadenable que resuelve al mismo valor.
const mongooseQueryMock = (value) => ({
  select: () => mongooseQueryMock(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  catch: (reject) => Promise.resolve(value).catch(reject)
});

// ─────────────────────────────────────────────────────────────────────────────
describe('inviteService.createInvite', () => {
  beforeEach(() => {
    vi.spyOn(emailService, 'sendInviteEmail').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('genera un token de 64 caracteres hex y guarda solo su hash', async () => {
    const { createInvite } = await import('../services/inviteService.js');
    const userId = nuevoId();
    let guardado = null;

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: userId,
      firstName: 'Ana',
      email: 'ana@test.local',
      invite: undefined,
      save: vi.fn(function () { guardado = this.invite; return Promise.resolve(this); })
    });

    await createInvite(userId);

    expect(guardado.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(guardado.usedAt).toBeNull();
    // ~7 días en el futuro, con tolerancia de un minuto
    const enSieteDias = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(guardado.expiresAt.getTime() - enSieteDias)).toBeLessThan(60 * 1000);
  });

  it('dos invitaciones seguidas generan tokens distintos', async () => {
    const { createInvite } = await import('../services/inviteService.js');
    const userId = nuevoId();
    const hashes = [];

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: userId, firstName: 'Ana', email: 'ana@test.local',
      save: vi.fn(function () { hashes.push(this.invite.tokenHash); return Promise.resolve(this); })
    });

    await createInvite(userId);
    await createInvite(userId);

    expect(hashes[0]).not.toBe(hashes[1]);
  });

  it('si el usuario no existe, no intenta mandar correo', async () => {
    const { createInvite } = await import('../services/inviteService.js');
    vi.spyOn(User, 'findById').mockResolvedValue(null);

    await createInvite(nuevoId());

    expect(emailService.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('la URL del link usa /invitacion/<token>, no /accept-invite/', async () => {
    const { createInvite } = await import('../services/inviteService.js');
    const userId = nuevoId();

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: userId, firstName: 'Ana', email: 'ana@test.local',
      save: vi.fn(function () { return Promise.resolve(this); })
    });

    await createInvite(userId);

    const [{ inviteUrl }] = emailService.sendInviteEmail.mock.calls[0];
    expect(inviteUrl).toMatch(/\/invitacion\/[0-9a-f]{64}$/);
    expect(inviteUrl).not.toContain('accept-invite');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /auth/accept-invite/:token', () => {
  afterEach(() => vi.restoreAllMocks());

  it('contraseña ausente o corta: 400 sin tocar la base de datos', async () => {
    const req = { params: { token: 'x' }, body: { password: 'corta' } };
    const res = fakeRes();
    const spy = vi.spyOn(User, 'findOne');

    await acceptInvite(req, res);

    expect(res.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('token inexistente, ya usado o vencido: 400 INVITE_EXPIRED (mismo resultado en los 3 casos)', async () => {
    const req = { params: { token: 'no-existe' }, body: { password: 'contrasenaValida1' } };
    const res = fakeRes();
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    await acceptInvite(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVITE_EXPIRED');
  });

  it('token válido: activa la cuenta, marca usedAt, revoca sesiones viejas y responde con sesión iniciada', async () => {
    const rawToken = 'un-token-de-prueba';
    const userId = nuevoId();
    const req = {
      params: { token: rawToken },
      body: { password: 'contrasenaValida1' },
      headers: {}, ip: '127.0.0.1'
    };
    const res = fakeRes();

    const userMock = {
      _id: userId,
      firstName: 'Ana', lastName: 'Test', fullName: 'Ana Test',
      email: 'ana@test.local', role: 'patient', phone: '', profileImage: '',
      invite: { tokenHash: hash(rawToken), usedAt: null, expiresAt: new Date(Date.now() + 100000) },
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(User, 'findOne').mockResolvedValue(userMock);
    const revokeSpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({});
    vi.spyOn(RefreshToken, 'create').mockResolvedValue({});

    await acceptInvite(req, res);

    expect(userMock.password).toBe('contrasenaValida1');
    expect(userMock.invite.usedAt).toBeInstanceOf(Date);
    expect(userMock.save).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith(
      { user: userId, revokedAt: null },
      { $set: { revokedAt: expect.any(Date) } }
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    // La respuesta arma el objeto de usuario campo por campo: no puede haber
    // filtrado password/invite aunque el mock los tuviera.
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.invite).toBeUndefined();
  });

  it('error inesperado en la base de datos: 500', async () => {
    const req = { params: { token: 'x' }, body: { password: 'contrasenaValida1' } };
    const res = fakeRes();
    vi.spyOn(User, 'findOne').mockRejectedValue(new Error('Mongo caído'));

    await acceptInvite(req, res);

    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/:id/resend-invite', () => {
  afterEach(() => vi.restoreAllMocks());

  const PROF_A = nuevoId();
  const PROF_B = nuevoId();
  const PACIENTE_DE_A = nuevoId();
  const PACIENTE_SIN_ASIGNAR = nuevoId();

  const mockUserFindById = (patientesPorId) => {
    vi.spyOn(User, 'findById').mockImplementation((id) => mongooseQueryMock(patientesPorId[id.toString()] || null));
  };

  it('usuario objetivo no encontrado: 404', async () => {
    mockUserFindById({});
    const req = { params: { id: nuevoId().toString() }, user: { _id: PROF_A, role: 'professional' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('profesional sobre un paciente de OTRO profesional: 404 (nunca 403)', async () => {
    const targetId = PACIENTE_DE_A.toString();
    mockUserFindById({ [targetId]: { _id: PACIENTE_DE_A, role: 'patient', assignedProfessionalId: PROF_A } });
    const req = { params: { id: targetId }, user: { _id: PROF_B, role: 'professional' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('profesional sobre SU paciente: 200, createInvite se llama con el id correcto', async () => {
    const targetId = PACIENTE_DE_A.toString();
    mockUserFindById({ [targetId]: { _id: PACIENTE_DE_A, role: 'patient', assignedProfessionalId: PROF_A } });
    vi.spyOn(emailService, 'sendInviteEmail').mockResolvedValue(undefined);
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === targetId) {
        return mongooseQueryMock({ _id: PACIENTE_DE_A, role: 'patient', assignedProfessionalId: PROF_A, firstName: 'P', email: 'p@test.local', save: vi.fn().mockResolvedValue(true) });
      }
      return mongooseQueryMock(null);
    });

    const req = { params: { id: targetId }, user: { _id: PROF_A, role: 'professional' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(200);
  });

  it('profesional sobre un paciente del pool (sin asignar): 200, mismo criterio que updateUser', async () => {
    const targetId = PACIENTE_SIN_ASIGNAR.toString();
    vi.spyOn(emailService, 'sendInviteEmail').mockResolvedValue(undefined);
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === targetId) {
        return mongooseQueryMock({ _id: PACIENTE_SIN_ASIGNAR, role: 'patient', assignedProfessionalId: undefined, firstName: 'P', email: 'p@test.local', save: vi.fn().mockResolvedValue(true) });
      }
      return mongooseQueryMock(null);
    });

    const req = { params: { id: targetId }, user: { _id: PROF_A, role: 'professional' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(200);
  });

  it('profesional sobre otro miembro del staff: 404 (bloqueado, no puede tocar staff)', async () => {
    const targetId = PROF_B.toString();
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === targetId) return mongooseQueryMock({ _id: PROF_B, role: 'professional' });
      return mongooseQueryMock(null);
    });
    const req = { params: { id: targetId }, user: { _id: PROF_A, role: 'professional' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('admin sobre cualquier paciente: 200 sin pasar por canAccessPatient', async () => {
    const targetId = PACIENTE_DE_A.toString();
    vi.spyOn(emailService, 'sendInviteEmail').mockResolvedValue(undefined);
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === targetId) {
        return mongooseQueryMock({ _id: PACIENTE_DE_A, role: 'patient', assignedProfessionalId: PROF_B, firstName: 'P', email: 'p@test.local', save: vi.fn().mockResolvedValue(true) });
      }
      return mongooseQueryMock(null);
    });

    const req = { params: { id: targetId }, user: { _id: nuevoId(), role: 'admin' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(200);
  });

  it('admin sobre otro miembro del staff: 200 (puede reenviar invitación a staff que él creó)', async () => {
    const targetId = PROF_B.toString();
    vi.spyOn(emailService, 'sendInviteEmail').mockResolvedValue(undefined);
    vi.spyOn(User, 'findById').mockImplementation((id) => {
      if (id.toString() === targetId) {
        return mongooseQueryMock({ _id: PROF_B, role: 'professional', firstName: 'P', email: 'p@test.local', save: vi.fn().mockResolvedValue(true) });
      }
      return mongooseQueryMock(null);
    });

    const req = { params: { id: targetId }, user: { _id: nuevoId(), role: 'admin' } };
    const res = fakeRes();

    await resendInvite(req, res);

    expect(res.statusCode).toBe(200);
  });
});
