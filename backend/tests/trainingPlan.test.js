/**
 * PRUEBAS — Preparar entrenamiento: reglas, reutilizar la última sesión y que lo PLANIFICADO nunca se mezcle con lo REALIZADO.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { validatePlanInput, validateGroup, lastSessionBlocks } from '../services/trainingPlanRules.js';
import TrainingPlan from '../models/TrainingPlan.js';
import ExerciseProgress from '../models/Exercise.js';
import User from '../models/User.js';
import WorkoutSession from '../models/WorkoutSession.js';
import { listPlans, createPlan, updatePlan, deletePlan, getLastSession } from '../controllers/trainingPlanController.js';

const id = () => new mongoose.Types.ObjectId();
const fakeRes = () => ({ status: vi.fn(function (c) { this.statusCode = c; return this; }), json: vi.fn(function (b) { this.body = b; return this; }) });
const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

const slot = (extra = {}) => ({ exerciseName: 'Sentadilla Safety', modality: 'weight', implement: 'barbell', groups: [{ sets: 3, reps: 10, weight: 55 }], ...extra });
const plan = (extra = {}) => ({ forDate: '2026-11-06', blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [slot()] }], ...extra });
const ok = (b) => { const r = validatePlanInput(b); expect(r.error).toBeUndefined(); return r.value; };
const bad = (b) => { const r = validatePlanInput(b); expect(r.error).toBeTruthy(); return r.error; };

describe('validar una preparación', () => {
  it('individual, superserie y triserie en la misma sesión', () => {
    const v = ok(plan({ blocks: [
      { blockId: 'bloque-0001', kind: 'single', slots: [slot()] },
      { blockId: 'bloque-0002', kind: 'super', slots: [slot({ exerciseName: 'Hip thrust' }), slot({ exerciseName: 'Remo mancuerna', implement: 'one_dumbbell', groups: [{ sets: 3, reps: 12, weight: 17.5 }] })] },
      { blockId: 'bloque-0003', kind: 'tri', slots: [slot({ exerciseName: 'Zancada' }), slot({ exerciseName: 'Gemelos' }), slot({ exerciseName: 'Vuelo lateral' })] }
    ] }));
    expect(v.blocks.map((b) => b.kind)).toEqual(['single', 'super', 'tri']);
  });
  it('el formato exige su cantidad de ejercicios y no repite uno dentro del bloque', () => {
    bad(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'super', slots: [slot()] }] }));
    bad(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'super', slots: [slot(), slot({ exerciseName: 'sentadilla  safety' })] }] }));
  });
  it('mismas combinaciones que el registro real: ejecución, implemento y modalidad', () => {
    ok(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [slot({ implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3, groups: [{ sets: 3, reps: 10, weight: 12 }] })] }] }));
    ok(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [{ exerciseName: 'Plancha', modality: 'time', execution: 'isometric', implement: 'none', groups: [{ sets: 3, durationSec: 30 }] }] }] }));
    bad(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [slot({ execution: 'isometric' })] }] }));
    bad(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [{ exerciseName: 'Flexiones', modality: 'bodyweight', implement: 'barbell', groups: [{ sets: 3, reps: 10 }] }] }] }));
  });
  it('la carga puede quedar por definir, pero si viene debe ser válida', () => {
    ok(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [slot({ groups: [{ sets: 3, reps: 10 }] })] }] }));
    expect(validateGroup({ sets: 3, reps: 10, weight: -5 }, 'weight').error).toBeTruthy();
    expect(validateGroup({ sets: 3, reps: 10, weight: 20 }, 'bodyweight').error).toBeTruthy();
    expect(validateGroup({ sets: 3 }, 'weight').error).toMatch(/repeticiones/);
    expect(validateGroup({ sets: 3, reps: 10, durationSec: 30 }, 'weight').error).toBeTruthy();
  });
  it('rechaza lo vacío, las fechas mal formadas y los textos largos', () => {
    bad({ ...plan(), blocks: [] });
    bad({ ...plan(), forDate: '06-11-2026' });
    bad({ ...plan(), internalNotes: 'x'.repeat(1001) });
    bad(plan({ blocks: [{ blockId: 'bloque-0001', kind: 'single', slots: [slot({ note: 'x'.repeat(201) })] }] }));
  });
});

describe('reutilizar la última sesión', () => {
  const row = (extra) => ({ exerciseName: 'Sentadilla Safety', date: '2026-10-29T15:00:00.000Z', sets: 1, reps: 12, weight: 55, weightUnit: 'kg', modality: 'weight', ...extra });
  it('sin registros no hay última sesión', () => expect(lastSessionBlocks([], dayOf)).toBeNull());
  it('toma solo el día más reciente y conserva la estructura del entrenamiento en curso', () => {
    const rows = [
      row({ date: '2026-10-22T15:00:00.000Z', exerciseName: 'Press banca' }),
      row({ blockId: 'a', slot: 'A1', setNumber: 1 }), row({ blockId: 'a', slot: 'A1', setNumber: 2 }), row({ blockId: 'a', slot: 'A1', setNumber: 3, reps: 10 }),
      row({ blockId: 'b', slot: 'B1', exerciseName: 'Hip thrust', reps: 15, weight: 57, setNumber: 1, implement: 'barbell' }),
      row({ blockId: 'b', slot: 'B2', exerciseName: 'Remo mancuerna', reps: 12, weight: 17.5, setNumber: 1, implement: 'one_dumbbell' })
    ];
    const r = lastSessionBlocks(rows, dayOf);
    expect(r.date).toBe('2026-10-29');
    expect(r.blocks.map((b) => b.kind)).toEqual(['single', 'super']);
    expect(r.blocks[0].slots[0].groups).toEqual([{ sets: 2, reps: 12, weight: 55 }, { sets: 1, reps: 10, weight: 55 }]);
    expect(r.blocks[1].slots.map((s) => s.exerciseName)).toEqual(['Hip thrust', 'Remo mancuerna']);
    expect(r.blocks[1].slots[1].implement).toBe('one_dumbbell');
    expect(JSON.stringify(r)).not.toMatch(/Press banca/); // otra fecha
  });
  it('registros manuales (sin bloques): cada ejercicio queda como bloque individual', () => {
    const r = lastSessionBlocks([row({ sets: 3 }), row({ exerciseName: 'Remo', sets: 3, reps: 12, weight: 17.5 })], dayOf);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0].slots[0].groups).toEqual([{ sets: 3, reps: 12, weight: 55 }]);
  });
  it('el mismo ejercicio con otro implemento queda en otro bloque (no se mezclan cargas de barra y mancuernas)', () => {
    const r = lastSessionBlocks([row({ implement: 'barbell', weight: 30, exerciseName: 'Press de hombros' }), row({ implement: 'two_dumbbells', weight: 12, exerciseName: 'Press de hombros' })], dayOf);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks.map((b) => b.slots[0].implement).sort()).toEqual(['barbell', 'two_dumbbells']);
    expect(r.blocks.every((b) => b.slots[0].groups.length === 1)).toBe(true);
  });
  it('conserva ejecución, implemento y duración', () => {
    const r = lastSessionBlocks([{ ...row({ modality: 'time', reps: undefined, weight: undefined, durationSec: 30, execution: 'isometric', exerciseName: 'Plancha' }) }], dayOf);
    expect(r.blocks[0].slots[0]).toMatchObject({ modality: 'time', execution: 'isometric', groups: [{ sets: 1, durationSec: 30 }] });
  });
  it('lo reutilizado pasa la misma validación que lo escrito a mano (tras ponerle identificador)', () => {
    const r = lastSessionBlocks([row({ sets: 3 })], dayOf);
    const body = { forDate: '2026-11-06', blocks: r.blocks.map((b, i) => ({ ...b, blockId: `bloque-000${i}` })) };
    expect(validatePlanInput(body).error).toBeUndefined();
  });
});

describe('controlador: permisos y separación planificado / realizado', () => {
  const PATIENT = id();
  const staff = { _id: id(), role: 'admin' };
  const leanChain = (value) => { const c = { sort: () => c, limit: () => c, select: () => c, lean: async () => value }; return c; };

  beforeEach(() => vi.restoreAllMocks());

  it('el paciente ve solo lo visible y nunca las notas internas ni quién la creó', async () => {
    const find = vi.spyOn(TrainingPlan, 'find').mockReturnValue(leanChain([{ _id: id(), forDate: '2026-11-06', blocks: [], createdAt: new Date(), internalNotes: 'secreto', createdBy: id(), visibleToPatient: true }]));
    const res = fakeRes();
    await listPlans({ user: { _id: PATIENT, role: 'patient' }, params: { patientId: String(PATIENT) } }, res);
    expect(find.mock.calls[0][0]).toMatchObject({ patient: String(PATIENT), visibleToPatient: { $ne: false } });
    expect(JSON.stringify(res.body)).not.toMatch(/secreto|internalNotes|createdBy/);
  });
  it('el equipo sí ve las notas internas', async () => {
    vi.spyOn(TrainingPlan, 'find').mockReturnValue(leanChain([{ _id: id(), forDate: '2026-11-06', blocks: [], internalNotes: 'cuidar rodilla', visibleToPatient: false }]));
    const res = fakeRes();
    await listPlans({ user: staff, params: { patientId: String(PATIENT) } }, res);
    expect(res.body.data.plans[0]).toMatchObject({ internalNotes: 'cuidar rodilla', visibleToPatient: false });
  });
  it('guardar una preparación NO crea registros de ejercicio, ni toca sesiones de entrenamiento', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ role: 'patient' }) }) });
    vi.spyOn(TrainingPlan, 'findOne').mockReturnValue({ lean: async () => null });
    const created = vi.spyOn(TrainingPlan, 'create').mockImplementation(async (d) => ({ ...d, _id: id(), toObject() { return { ...d, _id: this._id }; } }));
    const exCreate = vi.spyOn(ExerciseProgress, 'create');
    const exInsert = vi.spyOn(ExerciseProgress, 'insertMany');
    const wsCreate = vi.spyOn(WorkoutSession, 'create');
    const res = fakeRes();
    await createPlan({ user: staff, params: { patientId: String(PATIENT) }, body: { ...plan(), clientId: 'prep-cliente-0001' } }, res);
    expect(res.statusCode).toBe(201);
    expect(created).toHaveBeenCalledTimes(1);
    expect(exCreate).not.toHaveBeenCalled();
    expect(exInsert).not.toHaveBeenCalled();
    expect(wsCreate).not.toHaveBeenCalled();
  });
  it('reintentar el mismo guardado (misma clave) no duplica', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ role: 'patient' }) }) });
    vi.spyOn(TrainingPlan, 'findOne').mockReturnValue({ lean: async () => ({ _id: id(), forDate: '2026-11-06', blocks: [] }) });
    const created = vi.spyOn(TrainingPlan, 'create');
    const res = fakeRes();
    await createPlan({ user: staff, params: { patientId: String(PATIENT) }, body: { ...plan(), clientId: 'prep-cliente-0001' } }, res);
    expect(res.body.data.resumed).toBe(true);
    expect(created).not.toHaveBeenCalled();
  });
  it('no se prepara para una cuenta que no es paciente', async () => {
    vi.spyOn(User, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ role: 'professional' }) }) });
    const create = vi.spyOn(TrainingPlan, 'create');
    const res = fakeRes();
    await createPlan({ user: staff, params: { patientId: String(PATIENT) }, body: plan() }, res);
    expect(res.statusCode).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });
  it('un profesional que no atiende al paciente no puede corregir ni borrar su preparación (404)', async () => {
    const other = { _id: id(), role: 'professional' };
    const doc = { patient: PATIENT, save: vi.fn(), deleteOne: vi.fn() };
    vi.spyOn(TrainingPlan, 'findById').mockResolvedValue(doc);
    vi.spyOn(User, 'findById').mockReturnValue({ select: async () => ({ assignedProfessionalId: id(), role: 'patient' }) });
    let res = fakeRes();
    await updatePlan({ user: other, params: { id: String(id()) }, body: plan() }, res);
    expect(res.statusCode).toBe(404);
    res = fakeRes();
    await deletePlan({ user: other, params: { id: String(id()) } }, res);
    expect(res.statusCode).toBe(404);
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.deleteOne).not.toHaveBeenCalled();
  });
  it('la última sesión solo lee: no escribe nada', async () => {
    vi.spyOn(ExerciseProgress, 'find').mockReturnValue(leanChain([{ exerciseName: 'Sentadilla', date: '2026-10-29T15:00:00.000Z', sets: 3, reps: 10, weight: 50, modality: 'weight' }]));
    const create = vi.spyOn(TrainingPlan, 'create');
    const res = fakeRes();
    await getLastSession({ user: staff, params: { patientId: String(PATIENT) } }, res);
    expect(res.body.data.lastSession.blocks).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
  });
});
