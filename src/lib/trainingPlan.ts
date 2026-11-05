// Preparar entrenamiento: pasa entre el borrador que se edita en pantalla (DraftBlock, el mismo del entrenamiento en curso) y lo que
// se guarda como preparación. Lógica pura. Una preparación es lo PLANIFICADO: nunca se convierte sola en un registro realizado.
import type { PlanBlock, PlanSlot, PlanGroup } from '@/services/trainingPlanService';
import { KIND_COUNT, MAX_BLOCKS, attributesOfSlot, groupProblem, newBlock, newId, usesReps, usesTime, usesWeight, type DraftBlock, type DraftSlot, type Group } from './workoutPlan';

export const draftGroup = (g: PlanGroup): Group => ({ id: newId(), sets: g.sets, reps: g.reps ?? null, weight: g.weight ?? null, durationSec: g.durationSec ?? null });

// Bloques guardados (o de la última sesión) → borradores editables, con identificadores nuevos y «sin guardar»
export function draftFromPlan(blocks: PlanBlock[]): DraftBlock[] {
  return blocks.slice(0, MAX_BLOCKS).map((b) => ({
    blockId: newId(),
    kind: b.kind,
    savedSig: null,
    slots: b.slots.map((s): DraftSlot => ({
      name: s.exerciseName,
      modality: s.modality,
      ...(s.execution ? { execution: s.execution } : {}),
      ...(s.eccentricSec ? { eccentricSec: s.eccentricSec } : {}),
      ...(s.implement ? { implement: s.implement } : {}),
      ...(s.note ? { note: s.note } : {}),
      groups: s.groups.length > 0 ? s.groups.map(draftGroup) : [draftGroup({ sets: 3 })],
    })),
  }));
}

const groupPayload = (modality: DraftSlot['modality'], g: Group): PlanGroup => ({
  sets: g.sets ?? 1,
  ...(usesReps(modality) && g.reps ? { reps: g.reps } : {}),
  ...(usesTime(modality) && g.durationSec ? { durationSec: g.durationSec } : {}),
  ...(usesWeight(modality) && g.weight ? { weight: g.weight } : {}),
});

// Borradores → lo que se envía al servidor
export function planBlocksFromDraft(blocks: DraftBlock[]): PlanBlock[] {
  return blocks.map((b) => ({
    blockId: b.blockId,
    kind: b.kind,
    slots: b.slots.map((s): PlanSlot => ({
      exerciseName: s.name ?? '',
      modality: s.modality,
      ...attributesOfSlot(s),
      ...(s.note?.trim() ? { note: s.note.trim() } : {}),
      groups: s.groups.map((g) => groupPayload(s.modality, g)),
    })),
  }));
}

// Primer problema de la preparación (mismas reglas que el servidor; la carga puede quedar por definir) o null
export function prepProblem(blocks: DraftBlock[]): string | null {
  if (blocks.length === 0) return 'Agrega al menos un ejercicio';
  for (const b of blocks) {
    for (const s of b.slots) {
      if (!s.name) return 'Elige el ejercicio de cada bloque';
      for (const g of s.groups) {
        const p = groupProblem(s.modality, g, { weightOptional: true });
        if (p) return `${s.name}: ${p.toLowerCase()}`;
      }
    }
  }
  return null;
}

// ─── Editar la lista de bloques ───────────────────────────────────────────────────────────────────────────────────────────

export const addBlock = (blocks: DraftBlock[], kind: DraftBlock['kind']): DraftBlock[] => (blocks.length >= MAX_BLOCKS ? blocks : [...blocks, newBlock(kind)]);

export function moveBlock(blocks: DraftBlock[], blockId: string, direction: -1 | 1): DraftBlock[] {
  const i = blocks.findIndex((b) => b.blockId === blockId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = [...blocks];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// Copia el bloque justo debajo, con identificadores nuevos (el original no cambia)
export function duplicateBlock(blocks: DraftBlock[], blockId: string): DraftBlock[] {
  const i = blocks.findIndex((b) => b.blockId === blockId);
  if (i < 0 || blocks.length >= MAX_BLOCKS) return blocks;
  const original = blocks[i];
  const copy: DraftBlock = { ...original, blockId: newId(), savedSig: null, slots: original.slots.map((s) => ({ ...s, groups: s.groups.map((g) => ({ ...g, id: newId() })) })) };
  return [...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)];
}

export const removeBlock = (blocks: DraftBlock[], blockId: string): DraftBlock[] => blocks.filter((b) => b.blockId !== blockId);

// Letra del bloque según su posición (A, B, C…)
export const blockLetter = (index: number): string => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index] ?? String(index + 1);

export { KIND_COUNT };
