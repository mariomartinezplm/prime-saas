import type { BlockSlot, SavedSet, SetInput } from '@/services/workoutService';

// Borrador de una serie de UN ejercicio dentro de un bloque. Nada de esto se guarda hasta pulsar «Guardar».
export interface SlotDraft {
  include: boolean; // «Lo hice»: en una superserie o triserie se puede omitir un ejercicio sin inventar su serie
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
}

export interface Reference {
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
}

export const DEFAULT_REPS = 10;
export const DEFAULT_SECONDS = 30;

// Valores iniciales: lo último guardado HOY en ese ejercicio; si no hay, la referencia de la última sesión; si no, valores neutros
export function initialDraft(slot: BlockSlot, lastToday: SavedSet | undefined, reference: Reference | undefined): SlotDraft {
  const from = lastToday ?? reference;
  if (slot.modality === 'time') return { include: true, reps: null, weight: null, durationSec: from?.durationSec ?? DEFAULT_SECONDS };
  if (slot.modality === 'bodyweight') return { include: true, reps: from?.reps ?? DEFAULT_REPS, weight: null, durationSec: null };
  return { include: true, reps: from?.reps ?? DEFAULT_REPS, weight: from?.weight ?? null, durationSec: null };
}

// ¿Se puede guardar este borrador? (misma regla que el servidor, para avisar antes de enviar)
export function draftProblem(slot: BlockSlot, d: SlotDraft): string | null {
  if (slot.modality === 'time') return d.durationSec && d.durationSec >= 1 ? null : 'Indica los segundos';
  if (!d.reps || d.reps < 1) return 'Indica las repeticiones';
  if (slot.modality === 'weight' && (!d.weight || d.weight <= 0)) return 'Indica la carga';
  return null;
}

export function toSetInput(slot: BlockSlot, d: SlotDraft, clientId: string, weightUnit: 'kg' | 'lbs' = 'kg'): SetInput {
  if (slot.modality === 'time') return { clientId, slot: slot.slot, durationSec: d.durationSec ?? undefined };
  if (slot.modality === 'bodyweight') return { clientId, slot: slot.slot, reps: d.reps ?? undefined };
  return { clientId, slot: slot.slot, reps: d.reps ?? undefined, weight: d.weight ?? undefined, weightUnit };
}

// Texto corto de una serie: «10 × 20 kg», «12 rep», «30 s»
export function setText(s: { reps: number | null; weight: number | null; weightUnit: string; durationSec: number | null }): string {
  if (s.durationSec) return `${s.durationSec} s`;
  if (s.reps && s.weight) return `${s.reps} × ${String(s.weight).replace('.', ',')} ${s.weightUnit}`;
  if (s.reps) return `${s.reps} rep`;
  return '—';
}
