import { exerciseKey } from '../utils/exerciseKey.js';
import { validateAttributes } from './exerciseAttributes.js';
import { BLOCK_KINDS, MODALITIES, MAX_BLOCKS } from './workoutSets.js';

/**
 * Preparar entrenamiento — reglas puras (sin base de datos). Mismas dimensiones que el registro real (modalidad, ejecución,
 * implemento) y la misma identidad de ejercicio, pero con valores PREVISTOS: la carga puede quedar por definir.
 */

export const MAX_GROUPS_PER_SLOT = 8;
const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const usesReps = (m) => m === 'weight' || m === 'bodyweight';
const usesWeight = (m) => m === 'weight' || m === 'weight_time';
const usesTime = (m) => m === 'time' || m === 'weight_time';
const absent = (v) => v === undefined || v === null || v === '';

// Un cuadro «3 series de 10 con 20 kg». Devuelve { error } o { value }.
export function validateGroup(input, modality) {
  if (!isInt(input?.sets, 1, 20)) return { error: 'Las series deben ser un número entero entre 1 y 20' };
  const value = { sets: input.sets };
  if (usesReps(modality)) {
    if (!isInt(input.reps, 1, 999)) return { error: 'Las repeticiones deben ser un número entero entre 1 y 999' };
    value.reps = input.reps;
  } else if (!absent(input.reps)) return { error: 'Este ejercicio no se mide por repeticiones' };
  if (usesTime(modality)) {
    if (!isInt(input.durationSec, 1, 7200)) return { error: 'La duración debe ser un número entero de segundos entre 1 y 7200' };
    value.durationSec = input.durationSec;
  } else if (!absent(input.durationSec)) return { error: 'Este ejercicio no se mide por tiempo' };
  if (usesWeight(modality)) {
    if (!absent(input.weight)) {
      if (typeof input.weight !== 'number' || !Number.isFinite(input.weight) || input.weight <= 0 || input.weight > 1000) return { error: 'La carga debe ser un número mayor que 0 y hasta 1000' };
      value.weight = Math.round(input.weight * 100) / 100;
    }
  } else if (!absent(input.weight) && input.weight !== 0) return { error: 'Este ejercicio no lleva carga externa' };
  return { value };
}

export function validatePlanInput(body) {
  const { blocks, forDate, title, internalNotes, visibleToPatient } = body ?? {};
  if (typeof forDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(forDate)) return { error: 'Indica el día de la sesión' };
  if (!Array.isArray(blocks) || blocks.length < 1) return { error: 'Agrega al menos un ejercicio' };
  if (blocks.length > MAX_BLOCKS) return { error: 'Alcanzaste el máximo de bloques' };
  if (!absent(title) && (typeof title !== 'string' || title.trim().length > 80)) return { error: 'El título admite hasta 80 caracteres' };
  if (!absent(internalNotes) && (typeof internalNotes !== 'string' || internalNotes.length > 1000)) return { error: 'Las notas internas admiten hasta 1000 caracteres' };
  if (visibleToPatient !== undefined && typeof visibleToPatient !== 'boolean') return { error: 'visibleToPatient debe ser verdadero o falso' };

  const seenBlocks = new Set();
  const out = [];
  for (const b of blocks) {
    if (typeof b?.blockId !== 'string' || b.blockId.length < 8 || b.blockId.length > 60) return { error: 'Falta el identificador de un bloque' };
    if (seenBlocks.has(b.blockId)) return { error: 'Hay bloques repetidos' };
    seenBlocks.add(b.blockId);
    if (!Object.hasOwn(BLOCK_KINDS, b.kind)) return { error: 'El formato debe ser ejercicio individual, superserie o triserie' };
    if (!Array.isArray(b.slots) || b.slots.length !== BLOCK_KINDS[b.kind]) return { error: `Este formato lleva ${BLOCK_KINDS[b.kind]} ${BLOCK_KINDS[b.kind] === 1 ? 'ejercicio' : 'ejercicios'}` };
    const slots = [];
    for (const s of b.slots) {
      const modality = s?.modality ?? 'weight';
      if (!MODALITIES.includes(modality)) return { error: 'Modalidad no válida' };
      const name = typeof s?.exerciseName === 'string' ? s.exerciseName.replace(/\s+/g, ' ').trim() : '';
      if (name.length < 2 || name.length > 60 || exerciseKey(name) === '') return { error: 'Escribe un nombre de ejercicio válido (entre 2 y 60 caracteres)' };
      const attrs = validateAttributes(s, modality);
      if (attrs.error) return { error: attrs.error };
      if (!absent(s.note) && (typeof s.note !== 'string' || s.note.trim().length > 200)) return { error: 'La indicación admite hasta 200 caracteres' };
      if (!Array.isArray(s.groups) || s.groups.length < 1 || s.groups.length > MAX_GROUPS_PER_SLOT) return { error: `Cada ejercicio lleva entre 1 y ${MAX_GROUPS_PER_SLOT} cuadros de series` };
      const groups = [];
      for (const g of s.groups) {
        const parsed = validateGroup(g, modality);
        if (parsed.error) return { error: `${name}: ${parsed.error}` };
        groups.push(parsed.value);
      }
      slots.push({ exerciseName: name, modality, ...attrs.value, ...(absent(s.note) ? {} : { note: s.note.trim() }), groups });
    }
    const keys = slots.map((s) => exerciseKey(s.exerciseName));
    if (new Set(keys).size !== keys.length) return { error: 'Un bloque no puede repetir el mismo ejercicio' };
    out.push({ blockId: b.blockId, kind: b.kind, slots });
  }
  return {
    value: {
      forDate,
      blocks: out,
      ...(absent(title) ? {} : { title: title.trim() }),
      ...(absent(internalNotes) ? {} : { internalNotes: internalNotes.trim() }),
      ...(visibleToPatient === undefined ? {} : { visibleToPatient })
    }
  };
}

// ─── Reutilizar la última sesión ──────────────────────────────────────────────────────────────────────────────────────────

const labelOrder = (slot) => {
  const m = /^([A-Z])(\d+)$/.exec(slot ?? '');
  return m ? [m[1].charCodeAt(0), Number(m[2])] : [999, 0];
};

// Une series seguidas e iguales: [10×20, 10×20, 8×20] → «2 series de 10» + «1 serie de 8»
function groupsFromRows(rows) {
  const ordered = [...rows].sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
  const groups = [];
  for (const r of ordered) {
    const reps = r.reps ?? null;
    const weight = r.weight > 0 ? r.weight : null;
    const durationSec = r.durationSec ?? null;
    const count = Math.max(1, r.sets ?? 1);
    const last = groups[groups.length - 1];
    if (last && last.reps === reps && last.weight === weight && last.durationSec === durationSec) last.sets += count;
    else groups.push({ sets: count, reps, weight, durationSec });
  }
  return groups.map((g) => ({ sets: Math.min(20, g.sets), ...(g.reps ? { reps: g.reps } : {}), ...(g.weight ? { weight: g.weight } : {}), ...(g.durationSec ? { durationSec: g.durationSec } : {}) })).slice(0, MAX_GROUPS_PER_SLOT);
}

const modalityOfRow = (r) => {
  if (r.modality) return r.modality;
  if (r.durationSec) return r.weight > 0 ? 'weight_time' : 'time';
  if (r.weight > 0) return 'weight';
  return r.reps > 0 ? 'bodyweight' : 'weight';
};

const slotFromRows = (rows) => {
  const first = rows[0];
  const modality = modalityOfRow(first);
  return {
    exerciseName: first.exerciseName,
    modality,
    ...(first.execution ? { execution: first.execution } : {}),
    ...(first.eccentricSec ? { eccentricSec: first.eccentricSec } : {}),
    ...(first.implement ? { implement: first.implement } : {}),
    groups: groupsFromRows(rows)
  };
};

/**
 * Bloques de la ÚLTIMA sesión realizada (el día más reciente con registros), como borrador de preparación. No guarda nada y no
 * copia fechas ni identificadores: el profesional lo edita y recién ahí queda guardado. `dayOf` convierte una fecha en 'AAAA-MM-DD'.
 * Si la sesión vino del entrenamiento en curso se conserva su estructura (individual / superserie / triserie); si se anotó a mano,
 * cada ejercicio queda como un bloque individual.
 */
export function lastSessionBlocks(rows, dayOf) {
  const valid = (rows ?? []).filter((r) => r?.exerciseName && r.date);
  if (valid.length === 0) return null;
  const latest = valid.reduce((best, r) => (dayOf(r.date) > best ? dayOf(r.date) : best), '');
  const dayRows = valid.filter((r) => dayOf(r.date) === latest);

  const byBlock = new Map();
  const manual = [];
  for (const r of dayRows) {
    if (r.blockId) {
      const list = byBlock.get(r.blockId) ?? [];
      list.push(r);
      byBlock.set(r.blockId, list);
    } else manual.push(r);
  }

  const blocks = [];
  const orderedBlocks = [...byBlock.values()].sort((a, b) => labelOrder(a[0].slot)[0] - labelOrder(b[0].slot)[0]);
  for (const rowsOfBlock of orderedBlocks) {
    const bySlot = new Map();
    for (const r of rowsOfBlock) bySlot.set(r.slot ?? r.exerciseName, [...(bySlot.get(r.slot ?? r.exerciseName) ?? []), r]);
    const slots = [...bySlot.entries()].sort((a, b) => labelOrder(a[0])[1] - labelOrder(b[0])[1]).map(([, list]) => slotFromRows(list));
    if (slots.length === 1 || slots.length === 2 || slots.length === 3) blocks.push({ kind: slots.length === 1 ? 'single' : slots.length === 2 ? 'super' : 'tri', slots });
    else slots.forEach((s) => blocks.push({ kind: 'single', slots: [s] }));
  }
  // Mismo ejercicio con otro implemento u otra ejecución NO es lo mismo (barra y mancuernas no se mezclan en un solo cuadro)
  const byName = new Map();
  const variant = (r) => `${exerciseKey(r.exerciseName)}|${r.implement ?? ''}|${r.execution ?? ''}`;
  for (const r of manual) byName.set(variant(r), [...(byName.get(variant(r)) ?? []), r]);
  for (const list of byName.values()) blocks.push({ kind: 'single', slots: [slotFromRows(list)] });
  return { date: latest, blocks: blocks.slice(0, MAX_BLOCKS) };
}
