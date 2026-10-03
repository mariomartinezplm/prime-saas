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
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('BD desconectada (readyState !== 1): 503', () => {
    vi.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 });

    const res = fakeRes();
    getHealth({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'disconnected' });
  });

  it('informa la versión desplegada (7 caracteres del commit) y si el programador está encendido', () => {
    vi.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 });
    process.env.RAILWAY_GIT_COMMIT_SHA = '134c4573d9f0e1a2b3c4';
    process.env.ENABLE_SCHEDULER = 'true';

    const res = fakeRes();
    getHealth({}, res);

    expect(res.body.version).toBe('134c457');
    expect(res.body.scheduler).toBe('on');
  });

  it('sin variables: version "local" y programador apagado; nunca expone secretos', () => {
    vi.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 });
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.ENABLE_SCHEDULER;
    delete process.env.RESEND_API_KEY;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_BUCKET;

    const res = fakeRes();
    getHealth({}, res);

    expect(res.body.version).toBe('local');
    expect(res.body.scheduler).toBe('off');
    expect(res.body.storage).toBe('off');
    expect(res.body.email).toBe('off');
    expect(Object.keys(res.body).sort()).toEqual(['db', 'email', 'scheduler', 'status', 'storage', 'version']);
  });

  it('con las variables de R2 y Resend cargadas: storage y email "on", sin mostrar ningún valor', () => {
    vi.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 });
    process.env.R2_ACCOUNT_ID = 'cuenta-secreta';
    process.env.R2_ACCESS_KEY_ID = 'clave-secreta';
    process.env.R2_SECRET_ACCESS_KEY = 'secreto-secreto';
    process.env.R2_BUCKET_NAME = 'bucket';
    process.env.RESEND_API_KEY = 're_secreta';

    const res = fakeRes();
    getHealth({}, res);

    expect(res.body.storage).toBe('on');
    expect(res.body.email).toBe('on');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|re_secreta|cuenta-secreta/);

    ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'RESEND_API_KEY'].forEach((k) => delete process.env[k]);
  });
});
