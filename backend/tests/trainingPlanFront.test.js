/**
 * PRUEBAS — preparar entrenamiento en pantalla (src/lib/trainingPlan.ts): borradores ↔ preparación, editar bloques, y que lo que
 * se envía lo acepte el servidor (mismo contrato).
 */
import { describe, it, expect } from 'vitest';

const T = await import('../../src/lib/trainingPlan.ts');
const W = await import('../../src/lib/workoutPlan.ts');
const { validatePlanInput } = await import('../services/trainingPlanRules.js');

const planBlocks = () => [
  { kind: 'single', slots: [{ exerciseName: 'Sentadilla Safety', modality: 'weight', implement: 'barbell', groups: [{ sets: 3, reps: 12, weight: 55 }] }] },
  { kind: 'super', slots: [
    { exerciseName: 'Hip thrust', modality: 'weight', implement: 'barbell', groups: [{ sets: 3, reps: 15, weight: 57 }] },
    { exerciseName: 'Remo mancuerna', modality: 'weight', implement: 'one_dumbbell', note: 'espalda recta', groups: [{ sets: 3, reps: 12, weight: 17.5 }] },
  ] },
  { kind: 'tri', slots: [
    { exerciseName: 'Zancada búlgara', modality: 'weight', implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3, groups: [{ sets: 3, reps: 8, weight: 12 }] },
    { exerciseName: 'Plancha', modality: 'time', execution: 'isometric', implement: 'none', groups: [{ sets: 3, durationSec: 40 }] },
    { exerciseName: 'Flexiones', modality: 'bodyweight', groups: [{ sets: 3, reps: 10 }] },
  ] },
];

describe('de la preparación al borrador y de vuelta', () => {
  it('conserva ejercicios, implemento, ejecución, indicaciones y cuadros; con identificadores nuevos y «sin guardar»', () => {
    const drafts = T.draftFromPlan(planBlocks());
    expect(drafts.map((d) => d.kind)).toEqual(['single', 'super', 'tri']);
    expect(drafts.every((d) => d.savedSig === null && d.blockId.length >= 8)).toBe(true);
    expect(drafts[1].slots[1]).toMatchObject({ name: 'Remo mancuerna', implement: 'one_dumbbell', note: 'espalda recta' });
    expect(drafts[2].slots[0]).toMatchObject({ implement: 'two_dumbbells', execution: 'eccentric', eccentricSec: 3 });
    const back = T.planBlocksFromDraft(drafts);
    expect(back[0].slots[0].groups).toEqual([{ sets: 3, reps: 12, weight: 55 }]);
    expect(back[2].slots[1]).toMatchObject({ modality: 'time', execution: 'isometric', groups: [{ sets: 3, durationSec: 40 }] });
    expect(back[2].slots[2].groups).toEqual([{ sets: 3, reps: 10 }]); // peso corporal: sin carga inventada
  });
  it('lo que sale del borrador lo acepta el servidor (individual + superserie + triserie)', () => {
    const body = { forDate: '2026-11-06', blocks: T.planBlocksFromDraft(T.draftFromPlan(planBlocks())) };
    expect(validatePlanInput(body).error).toBeUndefined();
  });
  it('los bloques reutilizados tienen identificadores distintos entre sí', () => {
    const ids = T.draftFromPlan(planBlocks()).map((d) => d.blockId);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('problemas antes de guardar (la carga puede quedar por definir)', () => {
  it('sin bloques o con un ejercicio sin elegir', () => {
    expect(T.prepProblem([])).toMatch(/al menos un ejercicio/);
    expect(T.prepProblem([W.newBlock('single')])).toMatch(/Elige el ejercicio/);
  });
  it('una carga vacía NO es problema al preparar (sí lo es al registrar lo realizado)', () => {
    const b = W.newBlock('single');
    b.slots[0] = { name: 'Sentadilla', modality: 'weight', groups: [{ id: 'g', sets: 3, reps: 10, weight: null, durationSec: null }] };
    expect(T.prepProblem([b])).toBeNull();
    expect(W.groupProblem('weight', b.slots[0].groups[0])).toBe('Indica la carga');
    expect(W.groupProblem('weight', b.slots[0].groups[0], { weightOptional: true })).toBeNull();
  });
  it('series y repeticiones siguen siendo obligatorias', () => {
    const b = W.newBlock('single');
    b.slots[0] = { name: 'Sentadilla', modality: 'weight', groups: [{ id: 'g', sets: 3, reps: null, weight: 50, durationSec: null }] };
    expect(T.prepProblem([b])).toMatch(/repeticiones/);
  });
});

describe('editar la lista de bloques', () => {
  const three = () => T.draftFromPlan(planBlocks());
  it('reordenar sube y baja un bloque sin pasarse de los extremos', () => {
    const d = three();
    const up = T.moveBlock(d, d[1].blockId, -1);
    expect(up.map((b) => b.kind)).toEqual(['super', 'single', 'tri']);
    expect(T.moveBlock(d, d[0].blockId, -1)).toBe(d);
    expect(T.moveBlock(d, d[2].blockId, 1)).toBe(d);
  });
  it('duplicar copia el bloque debajo con identificadores nuevos y sin tocar el original', () => {
    const d = three();
    const dup = T.duplicateBlock(d, d[0].blockId);
    expect(dup).toHaveLength(4);
    expect(dup[1].blockId).not.toBe(dup[0].blockId);
    expect(dup[1].slots[0].groups[0].id).not.toBe(dup[0].slots[0].groups[0].id);
    expect(dup[1].slots[0].name).toBe('Sentadilla Safety');
    dup[1].slots[0].groups[0].reps = 99;
    expect(dup[0].slots[0].groups[0].reps).toBe(12);
  });
  it('eliminar y agregar; la letra sigue la posición', () => {
    const d = three();
    expect(T.removeBlock(d, d[1].blockId).map((b) => b.kind)).toEqual(['single', 'tri']);
    expect(T.addBlock(d, 'super')).toHaveLength(4);
    expect([0, 1, 2].map(T.blockLetter)).toEqual(['A', 'B', 'C']);
  });
  it('máximo de bloques', () => {
    let d = [];
    for (let i = 0; i < 40; i += 1) d = T.addBlock(d, 'single');
    expect(d).toHaveLength(30);
    expect(T.duplicateBlock(d, d[0].blockId)).toBe(d);
  });
});
