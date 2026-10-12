/**
 * PRUEBAS — alcance de GET /users/stats/dashboard.
 *
 * Regla de seguridad: un profesional solo ve cifras y citas de SUS pacientes (los
 * asignados + el "pool" sin profesional) y de SUS citas; el admin ve todo el centro.
 * Antes el endpoint devolvía datos globales también a los profesionales.
 *
 * Mismo patrón que el resto de backend/tests/ (vitest + vi.spyOn, sin BD real).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { getDashboardStats } from '../controllers/userController.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({
  status: vi.fn(function (code) { this.statusCode = code; return this; }),
  json: vi.fn(function (body) { this.body = body; return this; })
});

const PRO_ID = nuevoId();

function prepare() {
  vi.restoreAllMocks();
  const userCount = vi.spyOn(User, 'countDocuments').mockResolvedValue(3);
  const userFind = vi.spyOn(User, 'find').mockReturnValue({
    sort: () => ({ limit: () => ({ select: () => Promise.resolve([]) }) })
  });
  const aptCount = vi.spyOn(Appointment, 'countDocuments').mockResolvedValue(2);
  const aptFind = vi.spyOn(Appointment, 'find').mockReturnValue({
    sort: () => ({ limit: () => ({ populate: () => ({ populate: () => Promise.resolve([]) }) }) })
  });
  return { userCount, userFind, aptCount, aptFind };
}

const POOL_Y_ASIGNADOS = [
  { assignedProfessionalId: PRO_ID },
  { assignedProfessionalId: { $exists: false } },
  { assignedProfessionalId: null }
];

describe('dashboard stats — profesional', () => {
  it('cuenta solo sus pacientes (asignados + pool), nunca la base completa', async () => {
    const { userCount } = prepare();
    const res = fakeRes();
    await getDashboardStats({ user: { _id: PRO_ID, role: 'professional' } }, res);

    expect(res.statusCode).toBe(200);
    for (const [query] of userCount.mock.calls) {
      expect(query.role).toBe('patient');
      expect(query.$or).toEqual(POOL_Y_ASIGNADOS);
    }
    // el total y los activos usan el mismo alcance
    expect(userCount.mock.calls.some(([q]) => q.isActive === true)).toBe(true);
  });

  it('las citas de hoy y las próximas son solo las suyas', async () => {
    const { aptCount, aptFind } = prepare();
    await getDashboardStats({ user: { _id: PRO_ID, role: 'professional' } }, fakeRes());

    expect(aptCount.mock.calls[0][0].professional).toBe(PRO_ID);
    expect(aptFind.mock.calls[0][0].professional).toBe(PRO_ID);
  });

  it('los últimos pacientes registrados también se acotan', async () => {
    const { userFind } = prepare();
    await getDashboardStats({ user: { _id: PRO_ID, role: 'professional' } }, fakeRes());

    const query = userFind.mock.calls[0][0];
    expect(query.role).toBe('patient');
    expect(query.$or).toEqual(POOL_Y_ASIGNADOS);
  });
});

describe('dashboard stats — admin', () => {
  it('ve todo el centro: sin filtro de profesional ni de asignación', async () => {
    const { userCount, userFind, aptCount, aptFind } = prepare();
    const res = fakeRes();
    await getDashboardStats({ user: { _id: nuevoId(), role: 'admin' } }, res);

    expect(res.statusCode).toBe(200);
    for (const [query] of userCount.mock.calls) expect(query.$or).toBeUndefined();
    expect(userFind.mock.calls[0][0].$or).toBeUndefined();
    expect(aptCount.mock.calls[0][0].professional).toBeUndefined();
    expect(aptFind.mock.calls[0][0].professional).toBeUndefined();
  });

  it('devuelve las cifras y mantiene la forma de la respuesta', async () => {
    prepare();
    const res = fakeRes();
    await getDashboardStats({ user: { _id: nuevoId(), role: 'admin' } }, res);

    expect(res.body.data).toMatchObject({ totalPatients: 3, activePatients: 3, todayAppointments: 2 });
    expect(Object.keys(res.body.data).sort()).toEqual(
      ['activePatients', 'recentPatients', 'todayAppointments', 'totalPatients', 'upcomingAppointments']
    );
  });
});
