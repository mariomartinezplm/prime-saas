/**
 * PRUEBAS — allowlist de orígenes y defensa CSRF en /auth/refresh
 * (Paso 09 de BLUEPRINT.md).
 */

import { describe, it, expect, vi } from 'vitest';

describe('ALLOWED_ORIGINS', () => {
  it('incluye el puerto real de desarrollo (8080, no el 5173 del blueprint)', async () => {
    const { ALLOWED_ORIGINS } = await import('../config/allowedOrigins.js');
    expect(ALLOWED_ORIGINS).toContain('http://localhost:8080');
  });

  it('no incluye undefined aunque FRONTEND_URL no esté seteada', async () => {
    const { ALLOWED_ORIGINS } = await import('../config/allowedOrigins.js');
    expect(ALLOWED_ORIGINS.every(Boolean)).toBe(true);
  });
});

describe('verificarOrigen — defensa extra anti-CSRF en /auth/refresh', () => {
  const fakeRes = () => ({
    status: vi.fn(function (code) { this.statusCode = code; return this; }),
    json: vi.fn(function (body) { this.body = body; return this; })
  });

  it('rechaza la petición si no viene ningún header Origin', async () => {
    const { verificarOrigen } = await import('../middleware/verifyOrigin.js');
    const req = { headers: {} };
    const res = fakeRes();
    const next = vi.fn();

    verificarOrigen(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza un Origin que no está en la allowlist', async () => {
    const { verificarOrigen } = await import('../middleware/verifyOrigin.js');
    const req = { headers: { origin: 'https://malicioso.cl' } };
    const res = fakeRes();
    const next = vi.fn();

    verificarOrigen(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar el origen de desarrollo local', async () => {
    const { verificarOrigen } = await import('../middleware/verifyOrigin.js');
    const req = { headers: { origin: 'http://localhost:8080' } };
    const res = fakeRes();
    const next = vi.fn();

    verificarOrigen(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
