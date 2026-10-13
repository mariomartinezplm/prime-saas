/**
 * PRUEBAS — Fase F del plan de logros: descanso y equilibrio (estrés), basados en el autorreporte del Readiness.
 *
 * Reglas aprobadas: respuesta favorable = 7 o más (escala 1-9); logro = 5 días favorables en una ventana de 7;
 * un día sin registro no cuenta ni a favor ni en contra; nunca por una sola medición; fuente = autorreporte.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import Appointment from '../models/Appointment.js';
import ClientPlan from '../models/ClientPlan.js';
import AchievementAward from '../models/AchievementAward.js';
import AchievementPause from '../models/AchievementPause.js';
import WellnessCheckin from '../models/WellnessCheckin.js';
import Measurement from '../models/Measurement.js';
import ExerciseProgress from '../models/Exercise.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {
  computeWellbeingCandidates,
  favorableDays,
  findFavorableWindow,
  wellbeingProgress,
  answerOf,
  WELLBEING_RULES
} from '../services/achievements/wellbeing.js';
import { evaluatePatientAchievements } from '../services/achievements/index.js';
import { ACHIEVEMENTS } from '../config/achievements.js';

const nuevoId = () => new mongoose.Types.ObjectId();
const fecha = (n) => `2026-10-${String(n).padStart(2, '0')}`;
// Un check-in del día n con respuestas de sueño y estrés (escala 9 por defecto)
const ci = (n, { sleep = 8, stress = 8, scale = 9 } = {}) => ({ _id: nuevoId(), date: fecha(n), scale, sleep, stress });
const claves = (c) => c.map((x) => x.key);

beforeEach(() => vi.restoreAllMocks());

describe('"Una semana de buen descanso" (autorreporte de sueño)', () => {
  it('5 días con sueño >= 7 dentro de 7 días lo conceden', () => {
    const checkins = [1, 2, 3, 5, 7].map((n) => ci(n, { sleep: 7, stress: 3 }));
    const result = computeWellbeingCandidates(checkins);
    expect(claves(result)).toEqual(['rest_week']);
    expect(result[0].evidence.values).toMatchObject({ metric: 'sleep', source: 'autorreporte', days: 5, windowDays: 7, threshold: 7 });
  });

  it('un día SIN registro no cuenta ni a favor ni en contra: 4 favorables + huecos no alcanzan', () => {
    expect(computeWellbeingCandidates([1, 2, 4, 6].map((n) => ci(n)))).toEqual([]);
  });

  it('un día sin registro no resta: 5 favorables con 2 huecos en la semana SÍ alcanzan', () => {
    expect(claves(computeWellbeingCandidates([1, 3, 4, 6, 7].map((n) => ci(n, { stress: 2 }))))).toEqual(['rest_week']);
  });

  it('los días con sueño bajo no suman, y 4 favorables + 1 bajo no alcanzan (no se inventa una buena noche)', () => {
    const checkins = [ci(1), ci(2), ci(3), ci(4), ci(5, { sleep: 6 })];
    expect(computeWellbeingCandidates(checkins).filter((c) => c.key === 'rest_week')).toEqual([]);
  });

  it('el valor 6 NO es favorable y el 7 SÍ (umbral exacto)', () => {
    expect(favorableDays([ci(1, { sleep: 6 })], 'sleep')).toHaveLength(0);
    expect(favorableDays([ci(1, { sleep: 7 })], 'sleep')).toHaveLength(1);
  });

  it('5 días repartidos en más de 7 días NO alcanzan (no basta con acumular)', () => {
    expect(computeWellbeingCandidates([1, 3, 5, 8, 10].map((n) => ci(n, { stress: 1 })))).toEqual([]);
  });

  it('una sola medición aislada nunca concede', () => {
    expect(computeWellbeingCandidates([ci(1, { sleep: 9, stress: 9 })])).toEqual([]);
  });

  it('un mismo día repetido cuenta una vez', () => {
    expect(computeWellbeingCandidates([ci(1), ci(1), ci(2), ci(2), ci(3)])).toEqual([]);
  });

  it('convierte los check-ins antiguos en escala 1-5 (5 = 9 = favorable; 3 = 5 = no favorable)', () => {
    expect(answerOf({ scale: 5, sleep: 4 }, 'sleep')).toBe(7);
    expect(answerOf({ scale: 5, sleep: 3 }, 'sleep')).toBe(5);
    expect(answerOf({ scale: 9, sleep: 4 }, 'sleep')).toBe(4);
    const antiguos = [1, 2, 3, 4, 5].map((n) => ci(n, { scale: 5, sleep: 4, stress: 1 }));
    expect(claves(computeWellbeingCandidates(antiguos))).toEqual(['rest_week']);
  });

  it('datos ausentes (sin respuesta) no se interpretan como favorables ni desfavorables', () => {
    expect(answerOf({ date: fecha(1), scale: 9 }, 'sleep')).toBeNull();
    expect(favorableDays([{ _id: nuevoId(), date: fecha(1), scale: 9 }], 'sleep')).toEqual([]);
  });
});

describe('"Semana de equilibrio" (autorreporte de estrés)', () => {
  it('5 días con calma >= 7 en 7 días lo conceden (el estrés ya se guarda invertido: 9 = calma)', () => {
    const result = computeWellbeingCandidates([1, 2, 3, 4, 5].map((n) => ci(n, { sleep: 2, stress: 8 })));
    expect(claves(result)).toEqual(['balance_week']);
    expect(result[0].evidence.values).toMatchObject({ metric: 'stress', source: 'autorreporte' });
  });

  it('un periodo de estrés alto NO penaliza: simplemente no concede, sin consecuencias', () => {
    const tenso = [1, 2, 3, 4, 5, 6, 7].map((n) => ci(n, { stress: 2 }));
    expect(computeWellbeingCandidates(tenso).filter((c) => c.key === 'balance_week')).toEqual([]);
  });

  it('descanso y equilibrio son independientes: se pueden ganar los dos con los mismos días', () => {
    const buenos = [1, 2, 3, 4, 5].map((n) => ci(n, { sleep: 9, stress: 9 }));
    expect(claves(computeWellbeingCandidates(buenos))).toEqual(['rest_week', 'balance_week']);
  });

  it('el progreso muestra el mejor tramo y declara la fuente', () => {
    expect(wellbeingProgress([1, 2, 3].map((n) => ci(n)), 'rest_week')).toEqual({ best: 3, target: 5, source: 'autorreporte' });
    expect(wellbeingProgress([1, 2, 3, 4, 5, 6, 7].map((n) => ci(n)), 'balance_week')).toMatchObject({ best: 5, target: 5 });
    expect(wellbeingProgress([], 'inventado')).toBeNull();
  });

  it('findFavorableWindow devuelve null si no hay ventana', () => {
    expect(findFavorableWindow([ci(1)], WELLBEING_RULES.rest_week)).toBeNull();
  });
});

describe('catálogo: honestidad y tono', () => {
  it('dice que es autorreporte y no un diagnóstico ni una medición', () => {
    for (const key of ['rest_week', 'balance_week']) {
      const def = ACHIEVEMENTS[key];
      expect(def.criteria).toMatch(/autorreporte/i);
      expect(def.criteria).toMatch(/no una medición/i);
      expect(def.criteria).toMatch(/sin registro no cuenta ni a favor ni en contra/i);
      expect(def.periodic).toBe(false);
      expect(JSON.stringify(def)).not.toMatch(/diagn[oó]stic[oa] de|perdiste|racha rota|enferm|ansiedad|depresi/i);
    }
    expect(ACHIEVEMENTS.rest_week.category).toBe('descanso');
    expect(ACHIEVEMENTS.balance_week.category).toBe('estres');
  });
});

describe('servicio: se concede una sola vez y sin datos suficientes no concede nada', () => {
  const query = (value) => ({ select: () => query(value), lean: () => Promise.resolve(value) });

  function montar(checkins) {
    vi.spyOn(Appointment, 'find').mockImplementation(() => query([]));
    vi.spyOn(ClientPlan, 'find').mockImplementation(() => query([]));
    vi.spyOn(AchievementPause, 'find').mockImplementation(() => query([]));
    vi.spyOn(WellnessCheckin, 'find').mockImplementation(() => query(checkins));
    vi.spyOn(Measurement, 'find').mockImplementation(() => query([]));
    vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => query([]));
    vi.spyOn(User, 'findById').mockImplementation(() => query(null));
    const filas = [];
    const llave = (f) => `${f.patient}|${f.key}|${f.periodKey}`;
    vi.spyOn(AchievementAward, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      const existing = filas.find((r) => llave(r) === llave(filter));
      if (existing) return { value: existing, lastErrorObject: { updatedExisting: true } };
      const row = { _id: nuevoId(), ...filter, ...update.$setOnInsert };
      filas.push(row);
      return { value: row, lastErrorObject: { updatedExisting: false } };
    });
    const avisos = [];
    vi.spyOn(Notification, 'create').mockImplementation(async (doc) => {
      if (avisos.some((n) => n.dedupeKey === doc.dedupeKey)) throw Object.assign(new Error('dup'), { code: 11000 });
      avisos.push(doc);
      return doc;
    });
    return { filas, avisos };
  }

  it('concede descanso y equilibrio una vez, aunque se evalúe muchas veces, con aviso genérico', async () => {
    const { filas, avisos } = montar([1, 2, 3, 4, 5].map((n) => ci(n, { sleep: 9, stress: 9 })));
    const patientId = nuevoId();
    await evaluatePatientAchievements(patientId);
    await evaluatePatientAchievements(patientId);

    expect(filas.map((f) => f.key).sort()).toEqual(['balance_week', 'readiness_week', 'rest_week']);
    expect(filas.find((f) => f.key === 'rest_week')).toMatchObject({ category: 'descanso' });
    expect(avisos).toHaveLength(3);
    // el aviso no revela datos de salud
    expect(JSON.stringify(avisos)).not.toMatch(/sueño|estrés|descanso|calma/i);
  });

  it('con 4 días favorables no concede ningún logro de descanso ni equilibrio', async () => {
    const { filas } = montar([1, 2, 3, 4].map((n) => ci(n)));
    await evaluatePatientAchievements(nuevoId());
    expect(filas.filter((f) => ['rest_week', 'balance_week'].includes(f.key))).toEqual([]);
  });
});
