/**
 * PRUEBAS — export CSV de pacientes, solo admin (Paso 25 de BLUEPRINT.md).
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 * El 403 para no-admin lo aplica el middleware authorize('admin') en la ruta
 * (ya probado en otros lados de la suite) — aquí se prueba la lógica propia
 * del controller: qué contiene el CSV y qué NO contiene.
 */

import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import ClientPlan from '../models/ClientPlan.js';
import { exportUsers } from '../controllers/userController.js';

const nuevoId = () => new mongoose.Types.ObjectId();

const fakeRes = () => ({
  statusCode: null,
  headers: {},
  body: null,
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  setHeader: vi.fn(function (key, value) { this.headers[key] = value; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; }),
  send: vi.fn(function (body) { this.body = body; return this; })
});

describe('GET /users/export — CSV de pacientes', () => {
  it('genera un CSV con cabecera, datos base + plan, y contentType/disposition correctos', async () => {
    vi.restoreAllMocks();
    const patientId = nuevoId();
    const profId = nuevoId();
    const planId = nuevoId();

    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([
            {
              _id: patientId,
              firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.local',
              phone: '+56911111111', rut: '11.111.111-1', isActive: true,
              assignedProfessionalId: { firstName: 'Mario', lastName: 'Martínez' },
              createdAt: new Date('2026-01-15')
            }
          ])
        })
      })
    });
    vi.spyOn(ClientPlan, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { patient: patientId, serviceType: 'kinesiologia', sessionsTotal: 10, sessionsUsed: 3, endDate: new Date('2026-10-09') }
      ])
    });

    const req = { query: {} };
    const res = fakeRes();
    await exportUsers(req, res);

    expect(res.headers['Content-Type']).toContain('text/csv');
    expect(res.headers['Content-Disposition']).toContain('attachment');
    expect(res.statusCode).toBe(200);

    const csv = res.body;
    expect(csv).toContain('Ana,Pérez,ana@test.local');
    expect(csv).toContain('Mario Martínez');
    expect(csv).toContain('Kinesiología');
    expect(csv).toContain('3');
    expect(csv).toContain('10');
  });

  it('nunca incluye medicalInfo en el CSV (minimización de datos sensibles)', async () => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([{
            _id: nuevoId(), firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.local',
            isActive: true, createdAt: new Date(),
            medicalInfo: { chronicConditions: ['diabetes'], allergies: ['penicilina'] } // no debería usarse
          }])
        })
      })
    });
    vi.spyOn(ClientPlan, 'find').mockReturnValue({ select: vi.fn().mockResolvedValue([]) });

    const req = { query: {} };
    const res = fakeRes();
    await exportUsers(req, res);

    expect(res.body).not.toContain('diabetes');
    expect(res.body).not.toContain('penicilina');
    expect(res.body.toLowerCase()).not.toContain('medicalinfo');
  });

  it('paciente sin plan activo: la fila dice "Sin plan activo", no revienta', async () => {
    vi.restoreAllMocks();
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([{
            _id: nuevoId(), firstName: 'Bruno', lastName: 'Soto', email: 'bruno@test.local',
            isActive: true, createdAt: new Date()
          }])
        })
      })
    });
    vi.spyOn(ClientPlan, 'find').mockReturnValue({ select: vi.fn().mockResolvedValue([]) });

    const req = { query: {} };
    const res = fakeRes();
    await exportUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Sin plan activo');
  });

  it('formato inválido (distinto de csv): 400', async () => {
    vi.restoreAllMocks();
    const req = { query: { format: 'xlsx' } };
    const res = fakeRes();
    await exportUsers(req, res);

    expect(res.statusCode).toBe(400);
  });
});
