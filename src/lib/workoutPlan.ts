// Vista única del entrenamiento: la persona arma su sesión (cuántos ejercicios, superseries y triseries) y completa cada ejercicio
// con «series × repeticiones × carga». Si en alguna serie cambió el valor, agrega otro cuadro. Todo esto es lógica pura: no toca la
// red ni el reloj. Lo que se guarda en el servidor son las series ya expandidas (una fila por serie).
import type { BlockKind, Modality, SavedSet, WorkoutBlock } from '@/services/workoutService';

// Un cuadro de valores: «4 series de 10 repeticiones con 20 kg». Varios cuadros = valores distintos entre series.
export interface Group {
  id: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
}

export interface DraftSlot {
  name: string | null; // null = todavía sin elegir
  modality: Modality;
  groups: Group[];
}

export interface DraftBlock {
  blockId: string;
  kind: BlockKind;
  slots: DraftSlot[];
  // Firma de lo último guardado en el servidor (null = nunca se guardó). Si difiere de la firma actual, hay cambios sin guardar.
  savedSig: string | null;
}

export const KIND_COUNT: Record<BlockKind, number> = { single: 1, super: 2, tri: 3 };
export const KIND_TITLE: Record<BlockKind, string> = { single: 'Ejercicio', super: 'Superserie', tri: 'Triserie' };
export const MAX_BLOCKS = 30;
export const MAX_GROUPS = 8;
export const MAX_SETS_PER_SLOT = 20;
export const DEFAULTS = { sets: 3, reps: 10, durationSec: 30 } as const;

export const MODALITY_LABEL: Record<Modality, string> = { weight: 'Con peso', bodyweight: 'Peso corporal', time: 'Tiempo', weight_time: 'Peso y tiempo' };
export const usesReps = (m: Modality) => m === 'weight' || m === 'bodyweight';
export const usesWeight = (m: Modality) => m === 'weight' || m === 'weight_time';
export const usesTime = (m: Modality) => m === 'time' || m === 'weight_time';

let counter = 0;
export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${(counter += 1)}-${Math.random().toString(36).slice(2, 10)}`;

export interface Reference {
  reps: number | null;
  weight: number | null;
  durationSec: number | null;
  weightUnit?: 'kg' | 'lbs';
}

// Cuadro inicial según la modalidad, partiendo de lo último que la persona anotó en ese ejercicio (si existe)
export function newGroup(modality: Modality, ref?: Reference | null): Group {
  // Todo se registra en kg: una referencia antigua en libras NO se copia como si fueran kilos
  const refWeight = ref && ref.weightUnit === 'lbs' ? null : ref?.weight ?? null;
  return {
    id: newId(),
    sets: DEFAULTS.sets,
    reps: usesReps(modality) ? ref?.reps ?? DEFAULTS.reps : null,
    weight: usesWeight(modality) ? refWeight : null,
    durationSec: usesTime(modality) ? ref?.durationSec ?? DEFAULTS.durationSec : null,
  };
}

export const newSlot = (): DraftSlot => ({ name: null, modality: 'weight', groups: [newGroup('weight')] });

export function newBlock(kind: BlockKind): DraftBlock {
  return { blockId: newId(), kind, slots: Array.from({ length: KIND_COUNT[kind] }, newSlot), savedSig: null };
}

// «2 ejercicios, 1 superserie, 1 triserie» → bloques en ese orden (primero lo individual, luego superseries y triseries)
export function planFromCounts(counts: { single: number; super: number; tri: number }): DraftBlock[] {
  const out: DraftBlock[] = [];
  (['single', 'super', 'tri'] as const).forEach((kind) => {
    for (let i = 0; i < Math.max(0, Math.min(counts[kind], MAX_BLOCKS)); i += 1) out.push(newBlock(kind));
  });
  return out.slice(0, MAX_BLOCKS);
}

// Al cambiar la modalidad se conserva lo que sigue sirviendo y se completan los valores que ahora hacen falta
export function changeModality(slot: DraftSlot, modality: Modality): DraftSlot {
  if (slot.modality === modality) return slot;
  return {
    ...slot,
    modality,
    groups: slot.groups.map((g) => ({
      ...g,
      reps: usesReps(modality) ? g.reps ?? DEFAULTS.reps : null,
      weight: usesWeight(modality) ? g.weight : null,
      durationSec: usesTime(modality) ? g.durationSec ?? DEFAULTS.durationSec : null,
    })),
  };
}

// Problema de un cuadro (mismas reglas que el servidor, para avisar antes de enviar); null si está bien
export function groupProblem(modality: Modality, g: Group): string | null {
  if (!g.sets || g.sets < 1) return 'Indica cuántas series';
  if (g.sets > MAX_SETS_PER_SLOT) return `Máximo ${MAX_SETS_PER_SLOT} series`;
  if (usesReps(modality) && (!g.reps || g.reps < 1)) return 'Indica las repeticiones';
  if (usesTime(modality) && (!g.durationSec || g.durationSec < 1)) return 'Indica los segundos';
  if (usesWeight(modality) && (!g.weight || g.weight <= 0)) return 'Indica la carga';
  return null;
}

export function slotProblem(slot: DraftSlot): string | null {
  if (!slot.name) return 'Elige el ejercicio';
  for (const g of slot.groups) {
    const problem = groupProblem(slot.modality, g);
    if (problem) return problem;
  }
  return null;
}

// Primer problema del bloque (para avisar al guardar) o null si se puede guardar
export const blockProblem = (block: DraftBlock): string | null => {
  for (const slot of block.slots) {
    const problem = slotProblem(slot);
    if (problem) return `${slot.name ?? 'Un ejercicio'}: ${problem.toLowerCase()}`;
  }
  return null;
};

// Entrada «lista para completar»: ¿ya tiene todo para guardarse?
export const blockReady = (block: DraftBlock): boolean => blockProblem(block) === null;

export interface SetPayload {
  clientId: string;
  slotIndex: number;
  setNumber: number;
  reps?: number;
  weight?: number;
  weightUnit?: 'kg';
  durationSec?: number;
}

// Series que se envían: cada cuadro se expande a sus series, numeradas seguidas por ejercicio. La clave de cada serie es fija
// (bloque + ejercicio + número): guardar de nuevo el mismo bloque nunca duplica.
export function expandBlock(block: DraftBlock): SetPayload[] {
  const out: SetPayload[] = [];
  block.slots.forEach((slot, slotIndex) => {
    let n = 0;
    for (const g of slot.groups) {
      for (let i = 0; i < (g.sets ?? 0); i += 1) {
        n += 1;
        const item: SetPayload = { clientId: `${block.blockId}-s${slotIndex}-n${n}`, slotIndex, setNumber: n };
        if (usesReps(slot.modality) && g.reps) item.reps = g.reps;
        if (usesWeight(slot.modality) && g.weight) { item.weight = g.weight; item.weightUnit = 'kg'; }
        if (usesTime(slot.modality) && g.durationSec) item.durationSec = g.durationSec;
        out.push(item);
      }
    }
  });
  return out;
}

// Lo que identifica el contenido guardable de un bloque (si cambia, hay cambios sin guardar)
export const blockSignature = (block: DraftBlock): string =>
  JSON.stringify(block.slots.map((s) => [s.name, s.modality, s.groups.map((g) => [g.sets, g.reps, g.weight, g.durationSec])]));

export const isSaved = (block: DraftBlock): boolean => block.savedSig !== null && block.savedSig === blockSignature(block);
export const hasUnsaved = (block: DraftBlock): boolean => block.savedSig !== blockSignature(block) && blockHasContent(block);
// Un bloque «vacío» (sin ejercicio elegido) no cuenta como cambios sin guardar
const blockHasContent = (block: DraftBlock): boolean => block.slots.some((s) => s.name);

// Une series seguidas e iguales en un solo cuadro: [10×20, 10×20, 8×20] → «2 series de 10» + «1 serie de 8»
export function groupsFromSets(sets: Pick<SavedSet, 'reps' | 'weight' | 'durationSec' | 'setNumber'>[]): Group[] {
  const ordered = [...sets].sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
  const groups: Group[] = [];
  for (const s of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.reps === (s.reps ?? null) && last.weight === (s.weight ?? null) && last.durationSec === (s.durationSec ?? null)) {
      last.sets = (last.sets ?? 0) + 1;
    } else {
      groups.push({ id: newId(), sets: 1, reps: s.reps ?? null, weight: s.weight ?? null, durationSec: s.durationSec ?? null });
    }
  }
  return groups;
}

// Bloque del servidor (por ejemplo, de una sesión empezada con la versión anterior, o desde otro dispositivo) → borrador ya guardado
export function draftFromServer(block: WorkoutBlock, sets: SavedSet[]): DraftBlock {
  const draft: DraftBlock = {
    blockId: block.blockId,
    kind: block.kind,
    slots: block.slots.map((sl) => {
      const mine = sets.filter((s) => s.slot === sl.slot);
      const groups = mine.length > 0 ? groupsFromSets(mine) : [newGroup(sl.modality)];
      return { name: sl.exerciseName, modality: sl.modality, groups };
    }),
    savedSig: null,
  };
  if (sets.some((s) => s.blockId === block.blockId)) draft.savedSig = blockSignature(draft);
  return draft;
}

// Une lo guardado en este dispositivo (borradores, en el orden que armó la persona) con lo que ya hay en el servidor
export function mergePlan(local: DraftBlock[], serverBlocks: WorkoutBlock[], serverSets: SavedSet[]): DraftBlock[] {
  const known = new Set(local.map((b) => b.blockId));
  const extra = serverBlocks.filter((b) => !known.has(b.blockId)).map((b) => draftFromServer(b, serverSets.filter((s) => s.blockId === b.blockId)));
  return [...local, ...extra];
}

// «2 ejercicios · 1 superserie · 1 triserie»
export function planSummary(counts: { single: number; super: number; tri: number }): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [counts.single > 0 && plural(counts.single, 'ejercicio', 'ejercicios'), counts.super > 0 && plural(counts.super, 'superserie', 'superseries'), counts.tri > 0 && plural(counts.tri, 'triserie', 'triseries')].filter(Boolean).join(' · ');
}

// Texto corto de un cuadro: «4 × 10 · 20 kg», «3 × 30 s · 10 kg»
export function groupText(modality: Modality, g: Group): string {
  const n = (v: number) => String(v).replace('.', ',');
  const parts = [`${g.sets ?? 0} ${g.sets === 1 ? 'serie' : 'series'}`];
  if (usesReps(modality) && g.reps) parts.push(`${g.reps} rep`);
  if (usesTime(modality) && g.durationSec) parts.push(`${g.durationSec} s`);
  if (usesWeight(modality) && g.weight) parts.push(`${n(g.weight)} kg`);
  return parts.join(' · ');
}

// ─── Copia local del plan (solo en este dispositivo, solo mientras dura el entrenamiento) ─────────────────────────────────

const PLAN_KEY = (userId: string, sessionId: string) => `prime.workout-plan.${userId}.${sessionId}`;
const PLAN_TTL_MS = 24 * 60 * 60 * 1000;
const memory = new Map<string, string>();

export function loadPlan(userId: string, sessionId: string, now: number = Date.now()): DraftBlock[] {
  const key = PLAN_KEY(userId, sessionId);
  try {
    const raw = (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null) ?? memory.get(key) ?? null;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { savedAt: number; blocks: DraftBlock[] };
    if (!parsed || now - parsed.savedAt > PLAN_TTL_MS || !Array.isArray(parsed.blocks)) return [];
    return parsed.blocks;
  } catch {
    return [];
  }
}

export function savePlan(userId: string, sessionId: string, blocks: DraftBlock[], now: number = Date.now()): void {
  const key = PLAN_KEY(userId, sessionId);
  const raw = JSON.stringify({ savedAt: now, blocks });
  memory.set(key, raw);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, raw);
  } catch {
    /* sin almacenamiento: el plan vive solo mientras la pestaña esté abierta */
  }
}

// Borra la copia local de un entrenamiento (al finalizarlo) o de TODOS los de una cuenta (al cerrar sesión)
export function clearPlans(userId: string, sessionId?: string): void {
  const prefix = sessionId ? PLAN_KEY(userId, sessionId) : `prime.workout-plan.${userId}.`;
  for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  try {
    if (typeof localStorage === 'undefined') return;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* ignorar */
  }
}
