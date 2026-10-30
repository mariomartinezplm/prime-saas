/**
 * PRUEBAS — guardar un bloque completo de una vez (vista única del entrenamiento) y ejercicios por peso Y tiempo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../services/clientPlanService.js', () => ({ hasActivePlan: vi.fn() }));
vi.mock('../services/achievements/index.js', async (orig) => ({ ...(await orig()), triggerAchievementEvaluation: vi.fn(async () => undefined) }));
vi.mock('../services/notificationService.js', () => ({ notify: vi.fn(async () => undefined), notifyOnce: vi.fn(async () => undefined) }));

import { hasActivePlan } from '../services/clientPlanService.js';
import WorkoutSession from '../models/WorkoutSession.js';
import ExerciseProgress from '../models/Exercise.js';
import { replaceBlockSets, removeBlock } from '../controllers/workoutController.js';
import { validateSetInput, validateBlockInput, buildSummary } from '../services/workoutSets.js';

const id = () => new mongoose.Types.ObjectId();
const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const PACIENTE = { _id: id(), role: 'patient', firstName: 'Ana', lastName: 'Prueba' };
const lean = (v) => ({ select: () => lean(v), lean: () => Promise.resolve(v), sort: () => lean(v), limit: () => lean(v), then: (f) => Promise.resolve(v).then(f) });
const bloque = { blockId: 'bloque-0001', kind: 'super', label: 'A', slots: [{ slot: 'A1', exerciseName: 'Sentadilla', modality: 'weight' }, { slot: 'A2', exerciseName: 'Plancha lastrada', modality: 'weight_time' }] };
const sesion = (over = {}) => ({ _id: id(), patient: PACIENTE._id, startedAt: new Date(), lastActivityAt: new Date(), status: 'active', rest: { state: 'idle', durationSec: 120, nextDurationSec: 120, version: 0 }, blocks: [bloque], ...over });

function llamar(sets, { ses = sesion(), blockId = 'bloque-0001' } = {}) {
  vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(ses);
  vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(ses);
  vi.spyOn(WorkoutSession, 'updateOne').mockResolvedValue({});
  const rows = [{ _id: id(), patient: PACIENTE._id, workoutSession: ses._id, blockId, slot: 'A1', reps: 5, weight: 5, clientId: 'vieja-0000001', source: 'workout' }];
  const deleted = [];
  vi.spyOn(ExerciseProgress, 'deleteMany').mockImplementation(async (f) => { deleted.push(f); rows.length = 0; return {}; });
  vi.spyOn(ExerciseProgress, 'insertMany').mockImplementation(async (docs) => { rows.push(...docs); return docs; });
  vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => lean(rows));
  const r = res();
  return replaceBlockSets({ user: PACIENTE, params: { id: String(ses._id), blockId }, body: { sets } }, r).then(() => ({ r, rows, deleted, ses }));
}

const w = (slot, n, extra = {}) => ({ clientId: `b1-${slot}-${n}-aaaa`, slot, setNumber: n, ...extra });

beforeEach(() => {
  vi.restoreAllMocks();
  hasActivePlan.mockReset();
  hasActivePlan.mockResolvedValue(true);
});

describe('PUT /:id/blocks/:blockId/sets — bloque completo', () => {
  it('guarda todas las series de todos los ejercicios y reemplaza lo anterior del bloque', async () => {
    const { r, rows, deleted } = await llamar([
      w('A1', 1, { reps: 10, weight: 20 }), w('A1', 2, { reps: 10, weight: 20 }), w('A1', 3, { reps: 8, weight: 20 }),
      w('A2', 1, { weight: 10, durationSec: 30 }), w('A2', 2, { weight: 10, durationSec: 30 })
    ]);
    expect(r.statusCode).toBe(200);
    expect(r.body.data.saved).toBe(5);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({ blockId: 'bloque-0001', source: 'workout' });
    expect(rows.map((x) => [x.slot, x.setNumber, x.reps ?? null, x.weight, x.durationSec ?? null])).toEqual([
      ['A1', 1, 10, 20, null], ['A1', 2, 10, 20, null], ['A1', 3, 8, 20, null], ['A2', 1, null, 10, 30], ['A2', 2, null, 10, 30]
    ]);
    expect(rows.every((x) => x.source === 'workout' && x.blockKind === 'super')).toBe(true);
    expect(rows.find((x) => x.slot === 'A2').modality).toBe('weight_time');
  });

  it('el ejercicio se puede indicar por su posición en el bloque (slotIndex)', async () => {
    const { r, rows } = await llamar([
      { clientId: 'b1-pos-0-1-aaaa', slotIndex: 0, setNumber: 1, reps: 10, weight: 20 },
      { clientId: 'b1-pos-1-1-aaaa', slotIndex: 1, setNumber: 1, weight: 10, durationSec: 30 }
    ]);
    expect(r.statusCode).toBe(200);
    expect(rows.map((x) => x.slot)).toEqual(['A1', 'A2']);
    expect((await llamar([{ clientId: 'b1-pos-9-1-aaaa', slotIndex: 5, setNumber: 1, reps: 10, weight: 20 }])).r.statusCode).toBe(400);
  });

  it('si UNA serie es inválida no se guarda ni se borra nada', async () => {
    const { r, deleted, rows } = await llamar([w('A1', 1, { reps: 10, weight: 20 }), w('A1', 2, { reps: 0, weight: 20 })]);
    expect(r.statusCode).toBe(400);
    expect(deleted).toHaveLength(0);
    expect(rows).toHaveLength(1); // lo que ya había sigue ahí
  });

  it('rechaza ejercicios que no son del bloque, series repetidas y bloques ajenos', async () => {
    expect((await llamar([w('B1', 1, { reps: 10, weight: 20 })])).r.statusCode).toBe(400);
    expect((await llamar([w('A1', 1, { reps: 10, weight: 20 }), { ...w('A1', 1, { reps: 9, weight: 20 }), clientId: 'otra-clave-0001' }])).r.statusCode).toBe(400);
    expect((await llamar([w('A1', 1, { reps: 10, weight: 20 })], { blockId: 'no-existe-001' })).r.statusCode).toBe(404);
  });

  it('una sesión terminada o un plan vencido no guardan', async () => {
    expect((await llamar([w('A1', 1, { reps: 10, weight: 20 })], { ses: sesion({ status: 'finished' }) })).r.statusCode).toBe(409);
    hasActivePlan.mockResolvedValue(false);
    expect((await llamar([w('A1', 1, { reps: 10, weight: 20 })])).r.statusCode).toBe(403);
  });

  it('pide al menos una serie y no más de 120', async () => {
    expect((await llamar([])).r.statusCode).toBe(400);
    const muchas = Array.from({ length: 121 }, (_, i) => w('A1', (i % 99) + 1, { reps: 10, weight: 20 }));
    expect((await llamar(muchas)).r.statusCode).toBe(400);
  });
});

describe('ejercicios por peso Y tiempo (isométrico con carga)', () => {
  const slot = { modality: 'weight_time' };
  it('exige carga y segundos, y no admite repeticiones', () => {
    expect(validateSetInput({ clientId: 'clave-0000001', weight: 10, durationSec: 30 }, slot).value).toMatchObject({ weight: 10, durationSec: 30 });
    expect(validateSetInput({ clientId: 'clave-0000001', durationSec: 30 }, slot).error).toBeTruthy();
    expect(validateSetInput({ clientId: 'clave-0000001', weight: 10 }, slot).error).toBeTruthy();
    expect(validateSetInput({ clientId: 'clave-0000001', weight: 10, durationSec: 30, reps: 5 }, slot).error).toBeTruthy();
  });
  it('la modalidad es válida al crear un bloque y el resumen cuenta peso y tiempo', () => {
    const b = validateBlockInput({ blockId: 'bloque-0009', kind: 'single', slots: [{ exerciseName: 'Plancha lastrada', modality: 'weight_time' }] });
    expect(b.error).toBeUndefined();
    const s = buildSummary({ startedAt: new Date(), endedAt: new Date() }, [{ exerciseName: 'Plancha lastrada', weight: 10, weightUnit: 'kg', durationSec: 30 }]);
    expect(s.exercises[0]).toMatchObject({ bestWeight: 10, timeSec: 30 });
  });
});

describe('DELETE /:id/blocks/:blockId — quitar un bloque', () => {
  const quitar = async (blockId, ses = sesion()) => {
    vi.spyOn(WorkoutSession, 'findOne').mockResolvedValue(ses);
    vi.spyOn(WorkoutSession, 'findById').mockResolvedValue(ses);
    const upd = vi.spyOn(WorkoutSession, 'updateOne').mockResolvedValue({});
    const del = vi.spyOn(ExerciseProgress, 'deleteMany').mockResolvedValue({});
    vi.spyOn(ExerciseProgress, 'find').mockImplementation(() => lean([]));
    const r = res();
    await removeBlock({ user: PACIENTE, params: { id: String(ses._id), blockId } }, r);
    return { r, upd, del };
  };

  it('borra el bloque y SUS series, solo de esta persona y esta sesión', async () => {
    const { r, upd, del } = await quitar('bloque-0001');
    expect(r.statusCode).toBe(200);
    expect(del.mock.calls[0][0]).toMatchObject({ patient: PACIENTE._id, blockId: 'bloque-0001', source: 'workout' });
    expect(upd.mock.calls[0][1].$pull.blocks).toEqual({ blockId: 'bloque-0001' });
  });

  it('quitar un bloque que ya no existe no es un error y no borra nada', async () => {
    const { r, del } = await quitar('no-existe-001');
    expect(r.statusCode).toBe(200);
    expect(del).not.toHaveBeenCalled();
  });

  it('una sesión terminada no permite quitar bloques', async () => {
    const { r, del } = await quitar('bloque-0001', sesion({ status: 'finished' }));
    expect(r.statusCode).toBe(409);
    expect(del).not.toHaveBeenCalled();
  });
});
