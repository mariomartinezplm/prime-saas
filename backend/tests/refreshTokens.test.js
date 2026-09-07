/**
 * PRUEBAS — refresh tokens rotativos (Paso 08 de BLUEPRINT.md).
 *
 * Mismo patrón que security.test.js: vitest + vi.spyOn, sin base de datos ni
 * servidor real. Lo que no se puede probar así (el índice TTL de Mongo, los
 * atributos reales de la cookie vistos por un navegador, la secuencia
 * completa login→refresh→reuso contra un servidor de verdad) se verifica con
 * curl manual, tal como indica el Verify del propio blueprint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { leerCookie } from '../utils/cookies.js';
import {
  hashToken,
  generarRefreshToken,
  generarFamilyId,
  REFRESH_COOKIE_NAME
} from '../utils/refreshTokens.js';
import { generateToken } from '../middleware/auth.js';
import RefreshToken from '../models/RefreshToken.js';
import User from '../models/User.js';
import { refresh } from '../controllers/authController.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-de-prueba-solo-para-tests';

const nuevoId = () => new mongoose.Types.ObjectId();

// ─────────────────────────────────────────────────────────────────────────────
describe('leerCookie — parseo del header Cookie', () => {
  it('sin header de cookies devuelve undefined', () => {
    expect(leerCookie({ headers: {} }, 'refreshToken')).toBeUndefined();
  });

  it('lee un único par nombre=valor', () => {
    const req = { headers: { cookie: 'refreshToken=abc123' } };
    expect(leerCookie(req, 'refreshToken')).toBe('abc123');
  });

  it('lee el par correcto entre varios separados por "; "', () => {
    const req = { headers: { cookie: 'otra=1; refreshToken=abc123; masOtra=2' } };
    expect(leerCookie(req, 'refreshToken')).toBe('abc123');
  });

  it('decodifica valores con caracteres especiales', () => {
    const req = { headers: { cookie: 'refreshToken=a%20b%3Dc' } };
    expect(leerCookie(req, 'refreshToken')).toBe('a b=c');
  });

  it('no confunde un nombre que es substring de otro', () => {
    const req = { headers: { cookie: 'oldRefreshToken=viejo; refreshToken=nuevo' } };
    expect(leerCookie(req, 'refreshToken')).toBe('nuevo');
  });

  it('cookie inexistente devuelve undefined', () => {
    const req = { headers: { cookie: 'otra=1' } };
    expect(leerCookie(req, 'refreshToken')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Generación de refresh tokens', () => {
  it('hashToken es determinístico: el mismo valor produce el mismo hash', () => {
    expect(hashToken('mismo-valor')).toBe(hashToken('mismo-valor'));
  });

  it('generarRefreshToken produce un rawToken de 64 caracteres hex (32 bytes)', () => {
    const { rawToken } = generarRefreshToken();
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generarRefreshToken calcula el hash correcto del rawToken generado', () => {
    const { rawToken, tokenHash } = generarRefreshToken();
    expect(tokenHash).toBe(hashToken(rawToken));
  });

  it('dos llamadas seguidas producen tokens distintos', () => {
    const a = generarRefreshToken();
    const b = generarRefreshToken();
    expect(a.rawToken).not.toBe(b.rawToken);
  });

  it('generarFamilyId produce valores distintos en cada llamada', () => {
    expect(generarFamilyId()).not.toBe(generarFamilyId());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateToken — payload del access token', () => {
  it('el JWT incluye id y role', () => {
    const id = nuevoId().toString();
    const token = generateToken(id, 'professional');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(id);
    expect(decoded.role).toBe('professional');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /auth/refresh — rotación y detección de reuso', () => {
  const fakeRes = () => ({
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn(function (code) { this.statusCode = code; return this; }),
    json: vi.fn(function (body) { this.body = body; return this; })
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sin cookie responde 401 sin tocar la base de datos', async () => {
    const req = { headers: {} };
    const res = fakeRes();
    const spy = vi.spyOn(RefreshToken, 'findOneAndUpdate');

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('token inexistente (no reuso) responde 401 sin revocar ninguna familia', async () => {
    const req = { headers: { cookie: 'refreshToken=no-existe' } };
    const res = fakeRes();

    vi.spyOn(RefreshToken, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(RefreshToken, 'findOne').mockResolvedValue(null);
    const updateManySpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({});

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  it('reuso de un token ya revocado revoca TODA la familia', async () => {
    const req = { headers: { cookie: 'refreshToken=ya-usado' } };
    const res = fakeRes();
    const familyId = 'familia-123';

    vi.spyOn(RefreshToken, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(RefreshToken, 'findOne').mockResolvedValue({
      familyId,
      revokedAt: new Date(), // ya estaba revocado → señal de reuso
      replacedByHash: null
    });
    const updateManySpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({});

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(updateManySpy).toHaveBeenCalledWith(
      { familyId, revokedAt: null },
      { $set: { revokedAt: expect.any(Date) } }
    );
  });

  it('reuso de un token ya reemplazado (replacedByHash) también revoca la familia', async () => {
    const req = { headers: { cookie: 'refreshToken=ya-rotado' } };
    const res = fakeRes();
    const familyId = 'familia-456';

    vi.spyOn(RefreshToken, 'findOneAndUpdate').mockResolvedValue(null);
    vi.spyOn(RefreshToken, 'findOne').mockResolvedValue({
      familyId,
      revokedAt: null,
      replacedByHash: 'hash-del-nuevo'
    });
    const updateManySpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({});

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(updateManySpy).toHaveBeenCalledWith(
      { familyId, revokedAt: null },
      { $set: { revokedAt: expect.any(Date) } }
    );
  });

  it('token con expiresAt vencido responde 401 aunque siga "vivo" en BD', async () => {
    const req = { headers: { cookie: 'refreshToken=vencido' } };
    const res = fakeRes();

    vi.spyOn(RefreshToken, 'findOneAndUpdate').mockResolvedValue({
      _id: nuevoId(),
      familyId: 'familia-789',
      expiresAt: new Date(Date.now() - 1000), // ya venció
      user: nuevoId()
    });

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('token válido rota: crea uno nuevo heredando expiresAt y responde 200', async () => {
    const req = { headers: { cookie: 'refreshToken=valido' }, ip: '127.0.0.1' };
    const res = fakeRes();
    const userId = nuevoId();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // vigente

    vi.spyOn(RefreshToken, 'findOneAndUpdate').mockResolvedValue({
      _id: nuevoId(),
      familyId: 'familia-viva',
      expiresAt,
      user: userId
    });
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: userId,
      role: 'patient',
      isActive: true
    });
    const createSpy = vi.spyOn(RefreshToken, 'create').mockResolvedValue({});
    vi.spyOn(RefreshToken, 'updateOne').mockResolvedValue({});

    await refresh(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    // La familia se hereda tal cual, y expiresAt NO se recalcula (30 días
    // fijos desde el login original, no una ventana que se renueva sola).
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'familia-viva', expiresAt })
    );
  });

  it('usuario inactivo responde 401 aunque el refresh token sea válido', async () => {
    const req = { headers: { cookie: 'refreshToken=valido' } };
    const res = fakeRes();
    const userId = nuevoId();

    vi.spyOn(RefreshToken, 'findOneAndUpdate').mockResolvedValue({
      _id: nuevoId(),
      familyId: 'familia-x',
      expiresAt: new Date(Date.now() + 100000),
      user: userId
    });
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: userId, isActive: false });

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
  });
});
