/**
 * PRUEBAS — chequeo de salud para monitoreo externo (Paso 27 de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { getHealth } from '../controllers/healthController.js';

const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

describe('GET /api/health', () => {
  it('BD conectada (readyState 1): 200, sin datos sensibles', () => {
    vi.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 });

    const res = fakeRes();
    getHealth({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'connected' });
  });

  it('BD desconectada (readyState !== 1): 503', () => {
    vi.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 });

    const res = fakeRes();
    getHealth({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ status: 'error', db: 'disconnected' });
  });
});
