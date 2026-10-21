/**
 * PRUEBAS — Mi camino PRIME, parte 4: resumen mensual (solo lo registrado, sin interpretaciones).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { santiagoToUtc } from '../utils/timezone.js';
import { buildMonthlySummary, validateMonth, monthRange, MAX_MONTHS_BACK } from '../services/achievements/monthly.js';
import { getMyMonthly } from '../controllers/achievementController.js';
import * as achievements from '../services/achievements/index.js';
import achievementRoutes from '../routes/achievementRoutes.js';
import ExerciseProgress from '../models/Exercise.js';

const id = () => new mongoose.Types.ObjectId();
const NOW = santiagoToUtc(2026, 10, 20, 12);
const day = (m, d) => santiagoToUtc(2026, m, d, 12);
const cita = (type, status, date, extra = {}) => ({ _id: id(), type, status, date, ...extra });
const plan = (over = {}) => ({ _id: 'p1', serviceType: 'entrenamiento', status: 'active', sessionsTotal: 8, unlimited: false, startDate: day(10, 1), endDate: santiagoToUtc(2026, 10, 31, 23), ...over });

describe('validateMonth', () => {
  it('acepta el mes actual y anteriores hasta 24 meses; rechaza futuro, formato malo y muy antiguo', () => {
    expect(validateMonth('2026-10', NOW)).toBe(true);
    expect(validateMonth('2026-01', NOW)).toBe(true);
    expect(validateMonth('2024-10', NOW)).toBe(true);
    expect(MAX_MONTHS_BACK).toBe(24);
    for (const bad of ['2026-11', '2027-01', '2024-09', '2026-13', '2026-00', '2026-1', 'octubre', '', null, undefined, 202610, '2026-10-01']) {
      expect(validateMonth(bad, NOW)).toBe(false);
    }
  });

  it('el rango del mes empieza y termina a medianoche de Chile', () => {
    expect(monthRange('2026-10')).toEqual({ from: santiagoToUtc(2026, 10, 1), to: santiagoToUtc(2026, 11, 1) });
    expect(monthRange('2026-12')).toEqual({ from: santiagoToUtc(2026, 12, 1), to: santiagoToUtc(2027, 1, 1) });
  });
});

describe('buildMonthlySummary', () => {
  it('cuenta solo sesiones completadas del mes, sin repetir, de kinesiología y entrenamiento', () => {
    const repetida = cita('entrenamiento', 'completed', day(10, 5));
    const appointments = [
      repetida, repetida,
      cita('entrenamiento', 'completed', day(10, 6), { deduction: { source: 'clientPlan', refId: 'p1' } }),
      cita('kinesiologia', 'completed', day(10, 7)),
      cita('entrenamiento', 'completed', day(9, 28)), // mes anterior
      cita('entrenamiento', 'scheduled', day(10, 8)),
      cita('entrenamiento', 'cancelled', day(10, 9)),
      cita('entrenamiento', 'no-show', day(10, 10)),
      cita('evaluacion', 'completed', day(10, 11))
    ];
    const s = buildMonthlySummary({ appointments, plans: [plan()] }, '2026-10', NOW);
    expect(s.sessions).toMatchObject({ completed: 3, training: 2, kinesiology: 1 });
    expect(s.isCurrent).toBe(true);
  });

  it('informa "X de N del plan" solo con las sesiones descontadas de ese plan', () => {
    const appointments = [cita('entrenamiento', 'completed', day(10, 5), { deduction: { source: 'clientPlan', refId: 'p1' } }), cita('entrenamiento', 'completed', day(10, 6))];
    expect(buildMonthlySummary({ appointments, plans: [plan()] }, '2026-10', NOW).sessions.plan).toEqual({ completed: 1, target: 8, met: false });
    expect(buildMonthlySummary({ appointments, plans: [] }, '2026-10', NOW).sessions.plan).toBeNull();
    expect(buildMonthlySummary({ appointments, plans: [plan({ unlimited: true })] }, '2026-10', NOW).sessions.plan).toBeNull();
  });

  it('lista los hitos del mes por fecha, y no los de otros meses', () => {
    const awards = [
      { key: 'kine_5', category: 'kinesiologia', awardedAt: day(10, 12) },
      { key: 'first_session', category: 'primeros', awardedAt: day(9, 30) },
      { key: 'desconocido', category: 'x', awardedAt: day(10, 2) }
    ];
    const s = buildMonthlySummary({ awards }, '2026-10', NOW);
    expect(s.milestones.map((m) => m.key)).toEqual(['kine_5']);
    expect(s.milestones[0]).toMatchObject({ title: '5 sesiones completadas', categoryLabel: 'Kinesiología' });
  });

  it('de los registros entrega SOLO cantidades, nunca valores, peso ni conclusiones', () => {
    const s = buildMonthlySummary({ counts: { measurements: 2, exercises: 5, readinessDays: 9 } }, '2026-10', NOW);
    expect(s.records).toEqual({ measurements: 2, exercises: 5, readinessDays: 9 });
    expect(JSON.stringify(s)).not.toMatch(/weight|peso|kg|eva|dolor|diagn/i);
  });

  it('un mes sin nada no tiene actividad (la pantalla no inventa ceros)', () => {
    const s = buildMonthlySummary({}, '2026-08', NOW);
    expect(s.hasActivity).toBe(false);
    expect(s.isCurrent).toBe(false);
  });
});

describe('GET /me/monthly/:month', () => {
  const res = () => {
    const r = { statusCode: 200, body: null };
    r.status = (c) => ((r.statusCode = c), r);
    r.json = (b) => ((r.body = b), r);
    return r;
  };
  beforeEach(() => vi.restoreAllMocks());

  it('un mes inválido da 400 sin consultar datos', async () => {
    const spy = vi.spyOn(achievements, 'getMonthlySummary');
    const r = res();
    await getMyMonthly({ params: { month: '2099-01' }, user: { _id: 'u1' } }, r);
    expect(r.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('la ruta es solo para pacientes y solo mira al propio usuario (no recibe id de paciente)', () => {
    const layer = achievementRoutes.stack.find((l) => l.route?.path === '/me/monthly/:month' && l.route.methods.get);
    expect(layer).toBeTruthy();
    expect(layer.route.path).not.toMatch(/patientId/);
    expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getMonthlySummary con la base simulada', () => {
  const query = (value) => ({ select: () => query(value), sort: () => query(value), lean: () => Promise.resolve(value) });
  it('cuenta los días de Readiness por texto de fecha y los registros del mes', async () => {
    const [{ default: Appointment }, { default: ClientPlan }, { default: AchievementAward }, { default: AchievementPause }, { default: WellnessCheckin }, { default: Measurement }, { default: ExerciseProgress }, { default: User }] = await Promise.all([
      import('../models/Appointment.js'), import('../models/ClientPlan.js'), import('../models/AchievementAward.js'), import('../models/AchievementPause.js'),
      import('../models/WellnessCheckin.js'), import('../models/Measurement.js'), import('../models/Exercise.js'), import('../models/User.js')
    ]);
    vi.spyOn(Appointment, 'find').mockImplementation(() => query([cita('entrenamiento', 'completed', day(10, 5))]));
    vi.spyOn(ClientPlan, 'find').mockImplementation(() => query([]));
    vi.spyOn(AchievementPause, 'find').mockImplementation(() => query([]));
    vi.spyOn(WellnessCheckin, 'find').mockImplementation(() => query([{ date: '2026-10-01' }, { date: '2026-10-02' }, { date: '2026-09-30' }]));
    vi.spyOn(Measurement, 'find').mockImplementation(() => query([]));
    vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => query([]));
    vi.spyOn(Measurement, 'findOne').mockImplementation(() => query(null));
    vi.spyOn(ExerciseProgress, 'findOne').mockImplementation(() => query(null));
    vi.spyOn(User, 'findById').mockImplementation(() => query(null));
    vi.spyOn(AchievementAward, 'find').mockImplementation(() => query([]));
    const count = vi.spyOn(Measurement, 'countDocuments').mockResolvedValue(2);
    vi.spyOn(ExerciseProgress, 'countDocuments').mockResolvedValue(4);

    const s = await achievements.getMonthlySummary(id(), '2026-10', { now: NOW });
    expect(s.records).toEqual({ measurements: 2, exercises: 4, readinessDays: 2 });
    expect(s.sessions.completed).toBe(1);
    // el filtro por fecha usa el rango del mes de Chile
    expect(count.mock.calls[0][0].date).toEqual({ $gte: santiagoToUtc(2026, 10, 1), $lt: santiagoToUtc(2026, 11, 1) });
  });
});
