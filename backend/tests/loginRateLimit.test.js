/**
 * PRUEBAS — límite de intentos de login (Paso 06 de BLUEPRINT.md).
 *
 * Se prueba con un servidor Express real en un puerto libre (no hay supertest).
 * Caso que protege: detrás de los intermediarios de Railway el servidor ve IPs
 * distintas alternándose, y el límite por IP+correo no bastaba: en producción
 * 7 claves malas seguidas no devolvieron 429. loginEmailLimiter cuenta por cuenta.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { loginLimiter, loginEmailLimiter } from '../middleware/rateLimiter.js';

let server;
let base;
let ipActual = '10.0.0.1';

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  // Simula la clave siempre incorrecta, y toma la IP que mande la prueba
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', { value: ipActual, configurable: true });
    next();
  });
  app.post('/login', loginLimiter, loginEmailLimiter, (req, res) => {
    res.status(req.body.password === 'buena' ? 200 : 401).json({ ok: req.body.password === 'buena' });
  });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const intentar = async (email, password = 'mala') => {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.status;
};

describe('login — límite de intentos por cuenta', () => {
  it('alternando IPs (como en Railway) igual se bloquea al pasar el tope por cuenta', async () => {
    const estados = [];
    for (let i = 0; i < 14; i++) {
      ipActual = i % 2 === 0 ? '10.0.0.1' : '10.0.0.2';
      estados.push(await intentar('victima@test.local'));
    }

    expect(estados.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(estados.slice(10).every((s) => s === 429)).toBe(true);
  });

  it('el bloqueo de una cuenta no afecta a otra', async () => {
    ipActual = '10.0.0.3';
    expect(await intentar('otra@test.local')).toBe(401);
  });

  it('un login correcto no gasta intentos', async () => {
    ipActual = '10.0.0.4';
    for (let i = 0; i < 15; i++) {
      expect(await intentar('buena@test.local', 'buena')).toBe(200);
    }
  });

  it('el correo se compara sin importar mayúsculas', async () => {
    ipActual = '10.0.0.5';
    const estados = [];
    for (let i = 0; i < 12; i++) {
      estados.push(await intentar(i % 2 ? 'MAYUS@test.local' : 'mayus@test.local'));
    }
    expect(estados[11]).toBe(429);
  });
});
