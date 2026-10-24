/**
 * PRUEBAS — Reconocimiento de objetivos conseguidos dentro del motor de logros existente:
 * idempotencia, solo objetivos activos, celebraciones desactivables, sin revertir lo ya reconocido.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import PatientGoal from '../models/PatientGoal.js';
import { celebrationOf, evaluateGoalAchievements, indicatorDetail } from '../services/goals/goalAchievements.js';
import * as achievementService from '../services/achievementService.js';
import { ACHIEVEMENTS, isValidPeriodKeyForKind, periodKindOf, CATEGORY_ORDER, CATEGORIES } from '../config/achievements.js';

vi.mock('../services/achievementService.js', async (orig) => ({ ...(await orig()), grantAchievement: vi.fn(async () => ({ created: true })) }));
vi.mock('../services/notificationService.js', () => ({ notifyOnce: vi.fn(), notify: vi.fn() }));

const gid = () => new mongoose.Types.ObjectId();
const patientId = new mongoose.Types.ObjectId();
const day = (d) => ({ day: d, value: 0, refId: d });
const pressGoal = (over = {}) => ({
  _id: gid(), patient: patientId, status: 'active', categoryId: 'strength', celebrate: true, startedAt: new Date('2026-09-01T15:00:00Z'),
  indicators: [{ indicatorId: 'exercise_max_load', label: 'Carga máxima en un ejercicio', unit: 'kg', params: { exerciseKey: 'press banca' }, seriesKey: 'exercise_max_load|exerciseKey=press banca', direction: 'increase', target: { value: 75 }, baseline: { value: 60, day: '2026-09-01' } }],
  ...over,
});
const reader = (series) => ({ series: async () => series });
const series = (...pairs) => pairs.map(([d, v]) => ({ ...day(d), value: v }));

let updated;
beforeEach(() => {
  vi.restoreAllMocks();
  achievementService.grantAchievement.mockClear();
  updated = [];
  vi.spyOn(PatientGoal, 'findOneAndUpdate').mockImplementation(async (filter, update) => { updated.push({ filter, update }); return { _id: filter._id }; });
});

describe('definición del logro', () => {
  it('existe, es de la categoría «Mis objetivos PRIME» y usa un periodo propio por objetivo', () => {
    const def = ACHIEVEMENTS.goal_achieved;
    expect(def.category).toBe('objetivos');
    expect(CATEGORY_ORDER).toContain('objetivos');
    expect(CATEGORIES.objetivos.label).toBe('Mis objetivos PRIME');
    expect(periodKindOf(def)).toBe('objective');
    expect(isValidPeriodKeyForKind('objective', `obj@${gid()}`)).toBe(true);
    expect(isValidPeriodKeyForKind('objective', 'once')).toBe(false);
    expect(def.message).not.toMatch(/culp|debes|fallaste/i);
  });
});

describe('texto de la celebración', () => {
  it('«Alcanzaste tu meta de 75 kg en Press banca»', () => {
    expect(celebrationOf(pressGoal()).headline).toBe('Alcanzaste tu meta de 75 kg en Press banca');
  });
  it('bíceps contraído derecho y dolor por zona', () => {
    const g = pressGoal({ categoryId: 'muscle_mass', indicators: [{ indicatorId: 'perimeter_muscle', unit: 'cm', params: { field: 'bicepFlexedRight' }, target: { value: 37 } }] });
    expect(celebrationOf(g).headline).toBe('Alcanzaste tu meta de 37 cm en Bíceps contraído derecho');
    expect(indicatorDetail({ indicatorId: 'pain_eva', params: { bodyArea: 'rodilla-derecha' } })).toBe('Rodilla derecha');
    const pain = pressGoal({ indicators: [{ indicatorId: 'pain_eva', unit: '/10', params: { bodyArea: 'rodilla-derecha' }, target: { value: 2 } }] });
    expect(celebrationOf(pain).headline).toBe('Alcanzaste tu meta de 2 de 10 en Rodilla derecha');
  });
  it('con varios indicadores no inventa un número protagonista', () => {
    const g = pressGoal({ categoryId: 'cardiometabolic', indicators: [pressGoal().indicators[0], { ...pressGoal().indicators[0], seriesKey: 'x' }] });
    expect(celebrationOf(g).value).toBeNull();
  });
});

describe('evaluar objetivos activos', () => {
  it('meta alcanzada: concede el logro (idempotente por objetivo) y cierra el objetivo liberando su cupo', async () => {
    const goal = pressGoal();
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([goal]);
    const done = await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-09-01', 60], ['2026-10-01', 75])) });
    expect(done).toEqual([String(goal._id)]);
    const call = achievementService.grantAchievement.mock.calls[0][0];
    expect(call).toMatchObject({ key: 'goal_achieved', periodKey: `obj@${goal._id}`, notify: true, seen: false });
    expect(call.evidence.summary).toBe('Alcanzaste tu meta de 75 kg en Press banca');
    expect(updated[0].filter).toEqual({ _id: goal._id, status: 'active' }); // solo si SIGUE activo
    expect(updated[0].update.$unset).toEqual({ slot: '' });
    expect(updated[0].update.$set.status).toBe('achieved');
  });

  it('meta no alcanzada: no concede nada', async () => {
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([pressGoal()]);
    expect(await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-09-01', 60], ['2026-10-01', 70])) })).toEqual([]);
    expect(achievementService.grantAchievement).not.toHaveBeenCalled();
  });

  it('solo mira objetivos ACTIVOS: pausados y pendientes de validación quedan fuera de la consulta', async () => {
    const find = vi.spyOn(PatientGoal, 'find').mockResolvedValue([]);
    await evaluateGoalAchievements(patientId, { reader: reader([]) });
    expect(find).toHaveBeenCalledWith({ patient: patientId, status: 'active' });
  });

  it('la primera medición no cuenta como mejora: un solo registro nunca consigue un objetivo', async () => {
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([pressGoal({ indicators: [{ ...pressGoal().indicators[0], baseline: undefined }] })]);
    expect(await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-10-01', 80])) })).toEqual([]);
  });

  it('un objetivo de cintura exige dos registros separados por 14 días (no celebra una fluctuación)', async () => {
    const waist = pressGoal({ categoryId: 'body_fat', indicators: [{ indicatorId: 'perimeter_waist', label: 'Cintura', unit: 'cm', params: {}, seriesKey: 'w', direction: 'decrease', target: { value: 86 }, baseline: { value: 94, day: '2026-09-01' } }] });
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([waist]);
    expect(await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-09-01', 94], ['2026-10-01', 85])) })).toEqual([]);
    expect(await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-09-01', 94], ['2026-10-01', 85], ['2026-10-20', 85.5])) })).toHaveLength(1);
  });

  it('celebraciones desactivadas: queda en el historial sin aviso ni animación', async () => {
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([pressGoal({ celebrate: false })]);
    await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-09-01', 60], ['2026-10-01', 75])) });
    expect(achievementService.grantAchievement.mock.calls[0][0]).toMatchObject({ notify: false, seen: true });
  });

  it('si otro proceso ya cerró el objetivo, no se duplica el cierre', async () => {
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([pressGoal()]);
    PatientGoal.findOneAndUpdate.mockResolvedValue(null);
    expect(await evaluateGoalAchievements(patientId, { reader: reader(series(['2026-09-01', 60], ['2026-10-01', 75])) })).toEqual([]);
  });

  it('reintentar la evaluación entrega siempre la misma clave de logro (sin duplicar celebraciones)', async () => {
    const goal = pressGoal();
    vi.spyOn(PatientGoal, 'find').mockResolvedValue([goal]);
    const r = reader(series(['2026-09-01', 60], ['2026-10-01', 75]));
    await evaluateGoalAchievements(patientId, { reader: r });
    await evaluateGoalAchievements(patientId, { reader: r });
    const keys = achievementService.grantAchievement.mock.calls.map((c) => `${c[0].key}:${c[0].periodKey}`);
    expect(new Set(keys).size).toBe(1);
  });
});
