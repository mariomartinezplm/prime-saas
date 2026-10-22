/**
 * PRUEBAS — Identidad canónica de los ejercicios (Press Banca = press banca = PRESS BANCA) y normalización histórica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import ExerciseProgress from '../models/Exercise.js';
import { exerciseKey } from '../utils/exerciseKey.js';
import { canonicalSpelling } from '../services/exerciseNames.js';
import { planNormalization } from '../services/exerciseNormalization.js';

const { exerciseKeyOf } = await import('../../src/lib/exerciseKey.ts');
const id = () => new mongoose.Types.ObjectId();
const lean = (v) => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: () => Promise.resolve(v) }) }) }) });

describe('clave canónica', () => {
  it('Press Banca, press banca y PRESS BANCA son el mismo ejercicio', () => {
    const keys = ['Press Banca', 'press banca', 'PRESS BANCA', '  press   banca ', 'Préss Bánca'].map(exerciseKey);
    expect(new Set(keys).size).toBe(1);
  });
  it('plano, inclinado y con mancuernas NO se unen', () => {
    const keys = ['Press banca plano', 'Press banca inclinado', 'Press banca con mancuernas', 'Press banca'].map(exerciseKey);
    expect(new Set(keys).size).toBe(4);
  });
  it('el navegador y el servidor usan EXACTAMENTE la misma regla', () => {
    for (const n of ['Press Banca', '  SENTADILLA  Búlgara ', 'Peso muerto rumano', 'Plancha con toque de hombro', 'Remo (mancuerna)', 'ñandú', '', '   ']) {
      expect(exerciseKeyOf(n)).toBe(exerciseKey(n));
    }
  });
});

describe('dos creaciones simultáneas del mismo ejercicio', () => {
  it('quedan con la MISMA clave aunque se escriban distinto (la identidad no depende de la escritura)', async () => {
    const docs = ['Press Banca', 'press banca'].map((n) => new ExerciseProgress({ patient: id(), recordedBy: id(), exerciseName: n, reps: 5, weight: 60 }));
    await Promise.all(docs.map((d) => d.validate()));
    expect(docs[0].exerciseKey).toBe(docs[1].exerciseKey);
    expect(docs[0].exerciseKey).toBe('press banca');
  });
  it('la clave sigue al nombre si se corrige', async () => {
    const d = new ExerciseProgress({ patient: id(), recordedBy: id(), exerciseName: 'Remo', reps: 5, weight: 20 });
    await d.validate();
    d.exerciseName = 'Remo con barra';
    await d.validate();
    expect(d.exerciseKey).toBe('remo con barra');
  });
});

describe('escritura al guardar en el flujo clásico', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('«press banca» reutiliza la escritura que ya existe; un ejercicio distinto conserva la suya', async () => {
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(lean([{ exerciseName: 'Press banca', date: new Date(), workoutSession: undefined }]));
    expect(await canonicalSpelling(id(), 'PRESS BANCA ')).toBe('Press banca');
    expect(await canonicalSpelling(id(), 'Press banca inclinado')).toBe('Press banca inclinado');
    expect(await canonicalSpelling(id(), '  remo   con barra ')).toBe('remo con barra');
  });
});

describe('normalización histórica (plan puro)', () => {
  const p1 = id();
  const p2 = id();
  const row = (patient, name, day, key) => ({ _id: id(), patient, exerciseName: name, date: new Date(2026, 9, day), exerciseKey: key });

  it('unifica solo dentro del mismo paciente y deja una sola escritura visible', () => {
    const rows = [row(p1, 'Press Banca', 1), row(p1, 'press banca', 2), row(p1, 'PRESS BANCA', 3), row(p1, 'Press banca', 4), row(p2, 'press banca', 5)];
    const plan = planNormalization(rows);
    const renamed = plan.updates.filter((u) => u.rename);
    expect(new Set(renamed.map((u) => u.to))).toEqual(new Set(['Press banca']));
    expect(plan.spellingGroups).toBe(1);
    // la otra paciente no se mezcla ni se renombra (solo recibe su clave)
    expect(plan.updates.filter((u) => String(u.patient) === String(p2)).every((u) => !u.rename)).toBe(true);
  });
  it('nunca une ejercicios distintos', () => {
    const plan = planNormalization([row(p1, 'Press banca plano', 1), row(p1, 'Press banca inclinado', 2), row(p1, 'Press banca con mancuernas', 3)]);
    expect(plan.updates.filter((u) => u.rename)).toEqual([]);
    expect(plan.groups).toBe(3);
  });
  it('es idempotente: lo ya normalizado no genera cambios', () => {
    const rows = [row(p1, 'Press banca', 1, 'press banca'), row(p1, 'Press banca', 2, 'press banca')];
    expect(planNormalization(rows).updates).toEqual([]);
  });
  it('solo cambia nombre y clave: el plan no contiene series, pesos ni fechas', () => {
    const plan = planNormalization([row(p1, 'PRESS BANCA', 1), row(p1, 'Press banca', 2)]);
    for (const u of plan.updates) expect(Object.keys(u).sort()).toEqual(['from', 'id', 'key', 'patient', 'rename', 'to']);
  });
});
