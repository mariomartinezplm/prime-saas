import { exerciseKey } from './exerciseNames.js';
import { dayOf, dayNumber, isoWeekOf } from './achievements/dates.js';
import { defaultWeeklyTarget } from './achievements/weekly.js';

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

// Resumen de lo REALMENTE guardado en la sesión (nunca se inventa nada). Sin tonelaje: se muestran cargas, repeticiones y tiempo.
export function buildSummary(session, sets) {
  const startedAt = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const byKey = new Map();
  for (const s of sets) {
    const key = exerciseKey(s.exerciseName);
    if (!byKey.has(key)) byKey.set(key, { name: s.exerciseName, slots: new Set(), sets: 0, reps: 0, bestWeight: null, unit: null, timeSec: 0, modality: s.modality ?? null, setList: [] });
    const e = byKey.get(key);
    e.sets += 1;
    e.setList.push({ reps: s.reps ?? null, weight: s.weight > 0 ? s.weight : null, unit: s.weight > 0 ? (s.weightUnit || 'kg') : null, durationSec: s.durationSec ?? null });
    if (s.slot) e.slots.add(s.slot);
    if (s.reps) e.reps += s.reps;
    if (s.durationSec) e.timeSec += s.durationSec;
    if (s.weight > 0 && (e.bestWeight === null || s.weight > e.bestWeight)) {
      e.bestWeight = s.weight;
      e.unit = s.weightUnit || 'kg';
    }
  }
  const exercises = [...byKey.values()].map((e) => ({ name: e.name, slots: [...e.slots], sets: e.sets, reps: e.reps, bestWeight: e.bestWeight, unit: e.unit, timeSec: e.timeSec, modality: e.modality, setList: e.setList, improvement: null }));

  return {
    durationSec: Math.max(0, Math.round((end - startedAt) / 1000)),
    exercises,
    totals: {
      exercises: exercises.length,
      sets: sets.length,
      reps: sets.reduce((n, s) => n + (s.reps || 0), 0),
      timeSec: sets.reduce((n, s) => n + (s.durationSec || 0), 0)
    }
  };
}

// Marcas personales logradas EN ESTA SESIÓN, derivadas (sin depender de ningún aviso): la mejor carga en kg de un ejercicio hoy
// supera la mejor carga de DÍAS anteriores del mismo ejercicio. Sin días anteriores no hay récord (la primera marca no lo es).
// Es idempotente: recalcular da lo mismo. Las libras no se comparan.
export function sessionRecords(sets, previousRows, sessionDay, dayOf) {
  const best = new Map();
  for (const s of sets) {
    if (!(s.weight > 0) || (s.weightUnit || 'kg') !== 'kg') continue;
    const key = exerciseKey(s.exerciseName);
    const cur = best.get(key);
    if (!cur || s.weight > cur.weight) best.set(key, { name: s.exerciseName, weight: s.weight, reps: s.reps ?? null });
  }
  const records = [];
  for (const [key, today] of best) {
    let previous = 0;
    for (const r of previousRows) {
      if (!(r.weight > 0) || (r.weightUnit || 'kg') !== 'kg' || !r.date || exerciseKey(r.exerciseName) !== key) continue;
      if (dayOf(r.date) >= sessionDay) continue;
      previous = Math.max(previous, r.weight);
    }
    if (previous > 0 && today.weight > previous) {
      records.push({ name: today.name, previous, current: today.weight, improvement: Math.round((today.weight - previous) * 100) / 100, reps: today.reps });
    }
  }
  return records.sort((a, b) => b.improvement - a.improvement);
}

// Cuánto mejoró cada ejercicio frente a la ÚLTIMA vez que se hizo (el día anterior más reciente con ese ejercicio). Una sola medida por
// ejercicio, la más clara disponible: la mejor carga (si las dos veces tuvo peso y en la misma unidad); si no, la mejor serie en
// repeticiones (así se compara igual una serie suelta que un registro clásico de «3 × 10»); si no, la mejor serie en tiempo. Solo se informa una mejora real (> 0 %): nunca se inventa ni se muestra una baja.
// Devuelve un Map clave-del-ejercicio → { kind, previous, current, pct, unit }.
export function sessionImprovements(sets, previousRows, sessionDay, dayOf) {
  const today = new Map();
  for (const s of sets) {
    const key = exerciseKey(s.exerciseName);
    if (!key) continue;
    const t = today.get(key) ?? { weight: 0, unit: null, reps: 0, time: 0 };
    if (s.weight > 0 && s.weight > t.weight) { t.weight = s.weight; t.unit = s.weightUnit || 'kg'; }
    t.reps = Math.max(t.reps, s.reps || 0);
    t.time = Math.max(t.time, s.durationSec || 0);
    today.set(key, t);
  }

  // Última vez anterior de cada ejercicio: el día más reciente anterior a hoy
  const lastDay = new Map();
  for (const r of previousRows) {
    const key = exerciseKey(r.exerciseName);
    if (!today.has(key) || !r.date) continue;
    const day = dayOf(r.date);
    if (day >= sessionDay) continue;
    if (!lastDay.has(key) || day > lastDay.get(key)) lastDay.set(key, day);
  }
  const before = new Map();
  for (const r of previousRows) {
    const key = exerciseKey(r.exerciseName);
    if (!r.date || lastDay.get(key) !== dayOf(r.date)) continue;
    const t = before.get(key) ?? { weight: 0, unit: null, reps: 0, time: 0 };
    if (r.weight > 0 && r.weight > t.weight) { t.weight = r.weight; t.unit = r.weightUnit || 'kg'; }
    t.reps = Math.max(t.reps, r.reps || 0);
    t.time = Math.max(t.time, r.durationSec || 0);
    before.set(key, t);
  }

  const pctOf = (cur, prev) => Math.round(((cur - prev) / prev) * 100);
  const out = new Map();
  for (const [key, cur] of today) {
    const prev = before.get(key);
    if (!prev) continue;
    let found = null;
    if (cur.weight > 0 && prev.weight > 0 && cur.unit === prev.unit) found = { kind: 'weight', previous: prev.weight, current: cur.weight, unit: cur.unit };
    else if (!(cur.weight > 0) && !(prev.weight > 0) && cur.reps > 0 && prev.reps > 0) found = { kind: 'reps', previous: prev.reps, current: cur.reps, unit: null };
    else if (!(cur.weight > 0) && !(prev.weight > 0) && cur.reps === 0 && prev.reps === 0 && cur.time > 0 && prev.time > 0) found = { kind: 'time', previous: prev.time, current: cur.time, unit: null };
    if (!found) continue;
    const pct = pctOf(found.current, found.previous);
    if (pct > 0) out.set(key, { ...found, pct });
  }
  return out;
}

// Constancia a partir de los entrenamientos que la propia persona REGISTRÓ y finalizó (no es asistencia validada por el centro).
// Semana = lunes a domingo, mes = mes calendario, ambos en hora de Chile. Racha = semanas seguidas con al menos 1 entrenamiento
// registrado (la semana en curso cuenta si ya tiene uno; si aún no, se cuenta desde la anterior: no se «rompe» la racha a mitad de semana).
export function engagementOf({ finishedAt, now = new Date(), weeklyTarget = null, monthlyTarget = null }) {
  const today = dayOf(now);
  const week = isoWeekOf(today);
  const month = today.slice(0, 7);
  const days = finishedAt.map((d) => dayOf(d));
  const weekCount = days.filter((d) => isoWeekOf(d) === week).length;
  const monthCount = days.filter((d) => d.slice(0, 7) === month).length;

  const weeks = new Set(days.map((d) => isoWeekOf(d)));
  const weekAgo = (n) => isoWeekOf(new Date(dayNumber(today) * 86400000 - n * 7 * 86400000).toISOString().slice(0, 10));
  let streak = 0;
  for (let i = weeks.has(week) ? 0 : 1; i < 60 && weeks.has(weekAgo(i)); i += 1) streak += 1;

  const wt = Number.isInteger(weeklyTarget) && weeklyTarget > 0 ? weeklyTarget : null;
  const mt = Number.isInteger(monthlyTarget) && monthlyTarget > 0 ? monthlyTarget : null;
  return {
    weekCount,
    monthCount,
    weeklyTarget: wt,
    monthlyTarget: mt,
    weekMet: wt !== null && weekCount >= wt,
    monthMet: mt !== null && monthCount >= mt,
    remainingWeek: wt !== null ? Math.max(0, wt - weekCount) : null,
    remainingMonth: mt !== null ? Math.max(0, mt - monthCount) : null,
    streakWeeks: streak
  };
}

// Meta semanal: la que fijó el profesional o, si no, sesiones del plan ÷ 4. Meta mensual: las sesiones del plan de entrenamiento vigente.
export function targetsOf({ weeklyOverride, plan }) {
  const planned = plan && !plan.unlimited && plan.sessionsTotal > 0 ? plan.sessionsTotal : null;
  const weekly = Number.isInteger(weeklyOverride) && weeklyOverride > 0 ? Math.min(weeklyOverride, planned ?? 7) : planned ? defaultWeeklyTarget(planned) : null;
  return { weeklyTarget: weekly, monthlyTarget: planned };
}
