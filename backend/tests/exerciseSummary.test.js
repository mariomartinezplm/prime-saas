/**
 * PRUEBAS — lista de ejercicios que una persona ya tiene registrados (para no escribirlos de nuevo al registrar un nuevo peso).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import ExerciseProgress from '../models/Exercise.js';
import { exerciseSummary } from '../services/exerciseNames.js';
import { getExerciseSummary } from '../controllers/exerciseController.js';

const id = () => new mongoose.Types.ObjectId();
const chain = (rows) => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => rows }) }) }) });
const row = (over) => ({ exerciseName: 'Sentadilla', category: 'fuerza', date: new Date('2026-10-01T12:00:00Z'), sets: 3, reps: 8, weight: 60, weightUnit: 'kg', rpe: 7, ...over });

describe('ejercicios ya registrados', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('agrupa por ejercicio (aunque cambien mayúsculas, tildes o espacios) y usa lo MÁS reciente como «último»', async () => {
    // El historial llega del más reciente al más antiguo
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(chain([
      row({ exerciseName: 'Sentadilla Búlgara', date: new Date('2026-10-20T12:00:00Z'), weight: 24, reps: 10, sets: 4, rpe: 8 }),
      row({ exerciseName: 'press banca', category: 'fuerza', date: new Date('2026-10-18T12:00:00Z'), weight: 50 }),
      row({ exerciseName: 'sentadilla bulgara ', date: new Date('2026-10-05T12:00:00Z'), weight: 20 }),
      row({ exerciseName: 'Caminata', category: 'cardio', date: new Date('2026-09-01T12:00:00Z'), sets: undefined, reps: undefined, weight: undefined, rpe: undefined })
    ]));
    const list = await exerciseSummary(id());
    expect(list.map((e) => e.name)).toEqual(['Sentadilla Búlgara', 'press banca', 'Caminata']);
    const bulgara = list[0];
    expect(bulgara).toMatchObject({ key: 'sentadilla bulgara', count: 2, category: 'fuerza', last: { sets: 4, reps: 10, weight: 24, weightUnit: 'kg', rpe: 8 } });
    expect(list[2]).toMatchObject({ category: 'cardio', last: { weight: null, reps: null } });
  });

  it('nunca une ejercicios distintos aunque se parezcan', async () => {
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(chain([row({ exerciseName: 'Sentadilla trasera' }), row({ exerciseName: 'Sentadilla búlgara' })]));
    expect((await exerciseSummary(id())).map((e) => e.key)).toEqual(['sentadilla trasera', 'sentadilla bulgara']);
  });

  it('sin historial devuelve una lista vacía y consulta solo a ESA persona', async () => {
    const find = vi.spyOn(ExerciseProgress, 'find').mockReturnValue(chain([]));
    const pid = id();
    expect(await exerciseSummary(pid)).toEqual([]);
    expect(find).toHaveBeenCalledWith({ patient: pid });
  });

  it('el endpoint responde con la lista y, si falla, con un error claro', async () => {
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(chain([row()]));
    const res = { status: vi.fn(function (c) { this.code = c; return this; }), json: vi.fn(function (b) { this.body = b; return this; }) };
    await getExerciseSummary({ params: { patientId: String(id()) } }, res);
    expect(res.code).toBe(200);
    expect(res.body.data.exercises).toHaveLength(1);
    vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => { throw new Error('base caída'); });
    const bad = { status: vi.fn(function (c) { this.code = c; return this; }), json: vi.fn(function (b) { this.body = b; return this; }) };
    await getExerciseSummary({ params: { patientId: String(id()) } }, bad);
    expect(bad.code).toBe(500);
  });
});

describe('quién puede pedir la lista', () => {
  it('la ruta exige sesión y pertenencia al paciente (igual que el resto de los ejercicios)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../routes/exerciseRoutes.js', import.meta.url), 'utf8');
    expect(src).toMatch(/router\.use\(protect\)/);
    expect(src).toMatch(/router\.get\('\/summary\/:patientId', authorizePatientAccess\('patientId'\), getExerciseSummary\)/);
  });
});
