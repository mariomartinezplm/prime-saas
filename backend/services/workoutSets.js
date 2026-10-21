import { exerciseKey } from './exerciseNames.js';

/**
 * Entrenamiento en curso — bloques y series: reglas puras (sin base de datos).
 */

export const BLOCK_KINDS = { single: 1, super: 2, tri: 3 };
export const MODALITIES = ['weight', 'bodyweight', 'time'];
export const MAX_BLOCKS = 30;
export const MAX_SETS_PER_BATCH = 6;
export const UNITS = ['kg', 'lbs'];
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const nextLabel = (blocks) => LABELS[blocks.length] ?? null;

export const slotId = (label, index) => `${label}${index + 1}`;

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const isId = (s) => typeof s === 'string' && s.length >= 8 && s.length <= 80;

// Valida la definición de un bloque. Devuelve { error } o { blockId, kind, slots:[{exerciseName(texto sin resolver), modality}] }
export function validateBlockInput(body, blocks = []) {
  const { blockId, kind, slots } = body ?? {};
  if (typeof blockId !== 'string' || blockId.length < 8 || blockId.length > 60) return { error: 'Falta el identificador del bloque' };
  if (!Object.hasOwn(BLOCK_KINDS, kind)) return { error: 'El formato debe ser ejercicio individual, superserie o triserie' };
  if (!Array.isArray(slots) || slots.length !== BLOCK_KINDS[kind]) return { error: `Este formato lleva ${BLOCK_KINDS[kind]} ${BLOCK_KINDS[kind] === 1 ? 'ejercicio' : 'ejercicios'}` };
  const out = [];
  for (const s of slots) {
    const modality = s?.modality ?? 'weight';
    if (!MODALITIES.includes(modality)) return { error: 'Modalidad no válida' };
    if (typeof s?.exerciseName !== 'string') return { error: 'Falta el nombre del ejercicio' };
    out.push({ exerciseName: s.exerciseName, modality });
  }
  const keys = out.map((s) => exerciseKey(s.exerciseName));
  if (new Set(keys).size !== keys.length) return { error: 'Un bloque no puede repetir el mismo ejercicio' };
  if (blocks.length >= MAX_BLOCKS) return { error: 'Alcanzaste el máximo de bloques de esta sesión' };
  return { blockId, kind, slots: out };
}

// Valida y normaliza UNA serie según la modalidad del ejercicio en el bloque (la modalidad la manda el servidor, no el cliente)
export function validateSetInput(input, slotDef) {
  if (!isId(input?.clientId)) return { error: 'Falta el identificador de la serie' };
  const modality = slotDef.modality;
  const reps = input.reps;
  const weight = input.weight;
  const durationSec = input.durationSec;
  const unit = input.weightUnit ?? 'kg';
  if (!UNITS.includes(unit)) return { error: 'La unidad debe ser kg o lbs' };
  if (input.setNumber !== undefined && !isInt(input.setNumber, 1, 99)) return { error: 'Número de serie no válido' };

  if (modality === 'time') {
    if (!isInt(durationSec, 1, 7200)) return { error: 'La duración debe ser un número entero de segundos entre 1 y 7200' };
    if (reps !== undefined && reps !== null) return { error: 'Un ejercicio por tiempo no lleva repeticiones' };
    return { value: { durationSec, unit: undefined } };
  }
  if (!isInt(reps, 1, 999)) return { error: 'Las repeticiones deben ser un número entero entre 1 y 999' };
  if (durationSec !== undefined && durationSec !== null) return { error: 'Este ejercicio no se mide por tiempo' };
  if (modality === 'bodyweight') {
    if (weight !== undefined && weight !== null && weight !== 0) return { error: 'Un ejercicio con peso corporal no lleva carga externa' };
    return { value: { reps } };
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1000) return { error: 'La carga debe ser un número mayor que 0 y hasta 1000' };
  return { value: { reps, weight: Math.round(weight * 100) / 100, unit } };
}

// Resumen de lo REALMENTE guardado en la sesión (nunca se inventa nada)
export function buildSummary(session, sets) {
  const startedAt = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const byKey = new Map();
  for (const s of sets) {
    const key = exerciseKey(s.exerciseName);
    if (!byKey.has(key)) byKey.set(key, { name: s.exerciseName, slots: new Set(), sets: 0, reps: 0, bestWeight: null, unit: null, timeSec: 0, modality: s.modality ?? null });
    const e = byKey.get(key);
    e.sets += 1;
    if (s.slot) e.slots.add(s.slot);
    if (s.reps) e.reps += s.reps;
    if (s.durationSec) e.timeSec += s.durationSec;
    if (s.weight > 0 && (e.bestWeight === null || s.weight > e.bestWeight)) {
      e.bestWeight = s.weight;
      e.unit = s.weightUnit || 'kg';
    }
  }
  const exercises = [...byKey.values()].map((e) => ({ name: e.name, slots: [...e.slots], sets: e.sets, reps: e.reps, bestWeight: e.bestWeight, unit: e.unit, timeSec: e.timeSec, modality: e.modality }));

  // Volumen = repeticiones × carga, SOLO en kg y solo series con carga. Las lbs no se convierten: se avisa que quedaron fuera.
  let volumeKg = 0;
  let hasLoad = false;
  let lbsSets = 0;
  for (const s of sets) {
    if (!(s.weight > 0 && s.reps > 0)) continue;
    if ((s.weightUnit || 'kg') === 'kg') {
      volumeKg += s.weight * s.reps;
      hasLoad = true;
    } else lbsSets += 1;
  }

  return {
    durationSec: Math.max(0, Math.round((end - startedAt) / 1000)),
    exercises,
    totals: {
      exercises: exercises.length,
      sets: sets.length,
      reps: sets.reduce((n, s) => n + (s.reps || 0), 0),
      timeSec: sets.reduce((n, s) => n + (s.durationSec || 0), 0),
      volumeTons: hasLoad ? Math.round(volumeKg) / 1000 : null,
      volumeExcludesLbs: lbsSets > 0
    }
  };
}
