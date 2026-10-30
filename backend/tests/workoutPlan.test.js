/**
 * PRUEBAS — vista única del entrenamiento (src/lib/workoutPlan.ts): armar la sesión, cuadros de series × repeticiones,
 * expandir a series, detectar cambios sin guardar y unir con lo del servidor.
 */
import { describe, it, expect } from 'vitest';

const P = await import('../../src/lib/workoutPlan.ts');

const named = (block, names, modality = 'weight') => ({
  ...block,
  slots: block.slots.map((s, i) => ({ ...s, name: names[i], modality, groups: [{ id: `g${i}`, sets: 3, reps: 10, weight: 20, durationSec: null }] })),
});

describe('armar la sesión', () => {
  it('los contadores generan los bloques en orden: ejercicios, superseries y triseries', () => {
    const plan = P.planFromCounts({ single: 2, super: 1, tri: 1 });
    expect(plan.map((b) => b.kind)).toEqual(['single', 'single', 'super', 'tri']);
    expect(plan.map((b) => b.slots.length)).toEqual([1, 1, 2, 3]);
    expect(new Set(plan.map((b) => b.blockId)).size).toBe(4);
    expect(P.planSummary({ single: 2, super: 1, tri: 1 })).toBe('2 ejercicios · 1 superserie · 1 triserie');
  });

  it('nunca pasa del máximo de bloques', () => {
    expect(P.planFromCounts({ single: 99, super: 99, tri: 99 })).toHaveLength(P.MAX_BLOCKS);
  });
});

describe('cuadros de series y repeticiones', () => {
  it('cuatro series de 10 son 4 series; otro cuadro con valores distintos suma las suyas, numeradas seguidas', () => {
    const block = named(P.newBlock('single'), ['Sentadilla']);
    block.slots[0].groups = [{ id: 'a', sets: 3, reps: 10, weight: 20, durationSec: null }, { id: 'b', sets: 1, reps: 8, weight: 20, durationSec: null }];
    const sets = P.expandBlock(block);
    expect(sets.map((s) => [s.setNumber, s.reps, s.weight])).toEqual([[1, 10, 20], [2, 10, 20], [3, 10, 20], [4, 8, 20]]);
    expect(new Set(sets.map((s) => s.clientId)).size).toBe(4);
  });

  it('en una triserie cada ejercicio lleva su posición y sus propias series', () => {
    const block = named(P.newBlock('tri'), ['A', 'B', 'C']);
    block.slots[1].groups[0].sets = 2;
    const sets = P.expandBlock(block);
    expect(sets.filter((s) => s.slotIndex === 0)).toHaveLength(3);
    expect(sets.filter((s) => s.slotIndex === 1)).toHaveLength(2);
    expect(sets.filter((s) => s.slotIndex === 2).map((s) => s.setNumber)).toEqual([1, 2, 3]);
  });

  it('la clave de cada serie es fija: guardar dos veces el mismo bloque envía las mismas claves', () => {
    const block = named(P.newBlock('single'), ['Remo']);
    expect(P.expandBlock(block).map((s) => s.clientId)).toEqual(P.expandBlock(block).map((s) => s.clientId));
  });
});

describe('modalidades (incluido peso y tiempo)', () => {
  it('con peso: repeticiones y carga; corporal: solo repeticiones; tiempo: solo segundos; peso y tiempo: carga y segundos', () => {
    const base = { id: 'g', sets: 2, reps: 10, weight: 20, durationSec: 30 };
    const exp = (modality) => P.expandBlock({ blockId: 'bloque-0001', kind: 'single', savedSig: null, slots: [{ name: 'X', modality, groups: [base] }] })[0];
    expect(exp('weight')).toMatchObject({ reps: 10, weight: 20 });
    expect(exp('weight').durationSec).toBeUndefined();
    expect(exp('bodyweight').weight).toBeUndefined();
    expect(exp('time')).toMatchObject({ durationSec: 30 });
    expect(exp('time').reps).toBeUndefined();
    expect(exp('weight_time')).toMatchObject({ weight: 20, durationSec: 30 });
    expect(exp('weight_time').reps).toBeUndefined();
  });

  it('un isométrico con peso exige carga Y segundos', () => {
    expect(P.groupProblem('weight_time', { id: 'g', sets: 3, reps: null, weight: null, durationSec: 30 })).toBe('Indica la carga');
    expect(P.groupProblem('weight_time', { id: 'g', sets: 3, reps: null, weight: 10, durationSec: null })).toBe('Indica los segundos');
    expect(P.groupProblem('weight_time', { id: 'g', sets: 3, reps: null, weight: 10, durationSec: 30 })).toBeNull();
  });

  it('cambiar de modalidad completa lo que falta y quita lo que sobra', () => {
    const slot = { name: 'Plancha', modality: 'time', groups: [{ id: 'g', sets: 3, reps: null, weight: null, durationSec: 40 }] };
    const lastrada = P.changeModality(slot, 'weight_time');
    expect(lastrada.groups[0]).toMatchObject({ durationSec: 40, weight: null, reps: null });
    const conPeso = P.changeModality(lastrada, 'weight');
    expect(conPeso.groups[0]).toMatchObject({ reps: P.DEFAULTS.reps, durationSec: null });
  });
});

describe('validación antes de guardar', () => {
  it('pide elegir el ejercicio y completar los valores', () => {
    const block = P.newBlock('super');
    expect(P.blockProblem(block)).toContain('elige el ejercicio');
    const listo = named(block, ['A', 'B']);
    expect(P.blockReady(listo)).toBe(true);
    listo.slots[1].groups[0].reps = null;
    expect(P.blockProblem(listo)).toBe('B: indica las repeticiones');
  });
});

describe('cambios sin guardar', () => {
  it('un bloque guardado deja de estarlo al cambiar un valor, y vuelve a estarlo al guardarse de nuevo', () => {
    const block = named(P.newBlock('single'), ['Sentadilla']);
    expect(P.hasUnsaved(block)).toBe(true);
    const guardado = { ...block, savedSig: P.blockSignature(block) };
    expect(P.isSaved(guardado)).toBe(true);
    expect(P.hasUnsaved(guardado)).toBe(false);
    guardado.slots[0].groups[0].reps = 12;
    expect(P.isSaved(guardado)).toBe(false);
    expect(P.hasUnsaved(guardado)).toBe(true);
  });

  it('un bloque sin ejercicios elegidos no cuenta como cambios sin guardar', () => {
    expect(P.hasUnsaved(P.newBlock('tri'))).toBe(false);
  });
});

describe('unir con lo del servidor', () => {
  const serverBlock = { blockId: 'bloque-srv-1', kind: 'single', label: 'A', slots: [{ slot: 'A1', exerciseName: 'Remo', modality: 'weight' }] };
  const serverSets = [
    { blockId: 'bloque-srv-1', slot: 'A1', setNumber: 1, reps: 10, weight: 30, durationSec: null },
    { blockId: 'bloque-srv-1', slot: 'A1', setNumber: 2, reps: 10, weight: 30, durationSec: null },
    { blockId: 'bloque-srv-1', slot: 'A1', setNumber: 3, reps: 8, weight: 30, durationSec: null },
  ];

  it('las series seguidas e iguales se juntan en un cuadro', () => {
    const groups = P.groupsFromSets(serverSets);
    expect(groups.map((g) => [g.sets, g.reps, g.weight])).toEqual([[2, 10, 30], [1, 8, 30]]);
  });

  it('un bloque que solo existe en el servidor aparece como guardado; el orden local manda', () => {
    const local = [P.newBlock('super')];
    const merged = P.mergePlan(local, [serverBlock], serverSets);
    expect(merged.map((b) => b.blockId)).toEqual([local[0].blockId, 'bloque-srv-1']);
    expect(P.isSaved(merged[1])).toBe(true);
  });

  it('un bloque ya conocido en este dispositivo no se duplica', () => {
    const local = [{ ...P.newBlock('single'), blockId: 'bloque-srv-1' }];
    expect(P.mergePlan(local, [serverBlock], serverSets)).toHaveLength(1);
  });
});

describe('copia local del plan', () => {
  it('se guarda y se lee por cuenta y sesión, caduca y se puede borrar', () => {
    const blocks = [named(P.newBlock('single'), ['Remo'])];
    P.savePlan('u1', 's1', blocks, 1000);
    expect(P.loadPlan('u1', 's1', 2000)).toHaveLength(1);
    expect(P.loadPlan('u2', 's1', 2000)).toEqual([]);
    expect(P.loadPlan('u1', 's1', 1000 + 25 * 3600 * 1000)).toEqual([]);
    P.clearPlans('u1');
    expect(P.loadPlan('u1', 's1', 2000)).toEqual([]);
  });
});

describe('historial de un isométrico con peso', () => {
  it('se sigue por el tiempo que se sostiene (no se mezcla con cargas de repeticiones)', async () => {
    const { modalityOf, primaryMetric } = await import('../../src/lib/exerciseProgress.ts');
    const r = { _id: '1', exerciseName: 'Plancha lastrada', date: '2026-10-30', modality: 'weight_time', weight: 10, durationSec: 30 };
    expect(modalityOf(r)).toBe('time');
    expect(primaryMetric([r])).toBe('time');
  });
});
