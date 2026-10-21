/**
 * PRUEBAS — PUT /api/achievements/patients/:patientId/weekly-goal (validación y permisos).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import User from '../models/User.js';
import achievementRoutes from '../routes/achievementRoutes.js';
import { updatePatientWeeklyGoal } from '../controllers/achievementController.js';

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const call = async (sessions, patient = { _id: 'pt1', role: 'patient' }) => {
  vi.spyOn(User, 'findById').mockReturnValue({ select: () => Promise.resolve(patient) });
  const update = vi.spyOn(User, 'updateOne').mockResolvedValue({});
  const r = res();
  await updatePatientWeeklyGoal({ params: { patientId: 'pt1' }, body: { sessions }, user: { _id: 'staff1' } }, r);
  return { r, update };
};

beforeEach(() => vi.restoreAllMocks());

describe('updatePatientWeeklyGoal', () => {
  it('guarda un entero entre 1 y 7 con quién lo fijó', async () => {
    const { r, update } = await call(3);
    expect(r.statusCode).toBe(200);
    const set = update.mock.calls[0][1].$set['preferences.weeklyGoal'];
    expect(set).toMatchObject({ sessions: 3, setBy: 'staff1' });
  });

  it('null vuelve al valor por defecto', async () => {
    const { r, update } = await call(null);
    expect(r.statusCode).toBe(200);
    expect(update.mock.calls[0][1]).toEqual({ $unset: { 'preferences.weeklyGoal': '' } });
  });

  it.each([0, 8, 2.5, '3', undefined, NaN, -1])('rechaza %s', async (value) => {
    const { r, update } = await call(value);
    expect(r.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('un usuario que no es paciente da 404', async () => {
    const { r, update } = await call(2, { _id: 'x', role: 'professional' });
    expect(r.statusCode).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('ruta', () => {
  it('solo admin/profesional y con pertenencia verificada', () => {
    const layer = achievementRoutes.stack.find((l) => l.route?.path === '/patients/:patientId/weekly-goal' && l.route.methods.put);
    expect(layer).toBeTruthy();
    // protect se aplica al router completo; aquí van authorize(...) y authorizePatientAccess(...) antes del controlador
    expect(layer.route.stack.length).toBeGreaterThanOrEqual(3);
  });
});
