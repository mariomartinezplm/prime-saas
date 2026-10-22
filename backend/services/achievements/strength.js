import { exerciseKey } from '../../utils/exerciseKey.js';
import { dayOf, dayNumber, isoWeekOf } from './dates.js';

/**
 * Récords personales de CARGA (fuerza).
 *
 * Regla aprobada: récord = mayor peso en el MISMO ejercicio (nombre normalizado) y la MISMA unidad, con al menos
 * 3 registros previos y superando el mejor anterior en 2,5 % o más. Un solo aviso por ejercicio y por semana.
 *
 * No se declaran récords con datos incompletos (sin peso o sin repeticiones) ni se comparan kg con libras. No hay
 * "variantes" de ejercicio en los datos: si el nombre cambia, es otro ejercicio. Un registro corregido se
 * revalida (ver strengthRecordStillValid) sin duplicar nada.
 *
 * Para no inundar con avisos del pasado, solo se conceden récords de los últimos 7 días; el historial anterior
 * sirve como base de comparación, nunca como motivo de aviso.
 */

// Días distintos con carga registrada que hacen falta ANTES de poder ganar un récord: con 1 día anterior ya hay una marca que superar
export const PR_MIN_PRIOR = 1;
export const PR_MIN_INCREASE = 0;
export const PR_RECENT_DAYS = 7;
export const PR_NOTIFY_CAP_PER_WEEK = 3;

// "Sentadilla  Búlgara " → "sentadilla-bulgara" (sin tildes, mayúsculas ni espacios de más)
export function normalizeExerciseName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

// Solo registros con carga EN KG, repeticiones y fecha. Las libras (datos antiguos) conservan su valor pero no se comparan: no hay conversión silenciosa.
const isComparable = (e) => Number.isFinite(e.weight) && e.weight > 0 && Number.isFinite(e.reps) && e.reps >= 1 && !!e.date && (e.weightUnit || 'kg') === 'kg' && exerciseKey(e.exerciseName) !== '';

const sortKey = (a, b) => dayNumber(dayOf(a.date)) - dayNumber(dayOf(b.date)) || String(a._id).localeCompare(String(b._id));

// Todos los récords que cumplen la regla (sin límite de recencia); uno por ejercicio-semana.
//
// RÉCORD PERSONAL: la carga más alta (kg) que la persona levantó en un ejercicio en UN DÍA (hora de Chile, con al menos 1
// repetición) SUPERA la mejor carga de los días anteriores en ese mismo ejercicio. Reglas:
//  - Se comparan DÍAS, no filas: varias series el mismo día no generan varios récords ni se comparan entre sí.
//  - Hace falta al menos 1 día anterior con carga: la PRIMERA marca no es un récord («superaste» exige algo que superar).
//  - Se compara solo en kg. Los registros en libras conservan su valor pero no entran: no se mezclan unidades en silencio.
//  - Sin carga (peso corporal o por tiempo) no hay récord de carga.
//  - La identidad del ejercicio es su clave canónica completa (sin tildes, mayúsculas ni espacios de más).
export function allStrengthRecords(exercises) {
  const groups = new Map();
  for (const e of exercises.filter(isComparable)) {
    const key = exerciseKey(e.exerciseName);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...e, unit: 'kg' });
  }

  const records = [];
  const seenPeriods = new Set();
  for (const [, list] of groups) {
    // El mejor registro de cada día (la carga más alta; a igual carga, el más antiguo)
    const bestOfDay = new Map();
    for (const record of list.sort(sortKey)) {
      const day = dayOf(record.date);
      const current = bestOfDay.get(day);
      if (!current || record.weight > current.weight) bestOfDay.set(day, record);
    }
    const days = [...bestOfDay.entries()].sort(([a], [b]) => dayNumber(a) - dayNumber(b));
    let best = 0;
    days.forEach(([, record], index) => {
      if (index >= PR_MIN_PRIOR && record.weight > best * (1 + PR_MIN_INCREASE)) {
        const slug = normalizeExerciseName(record.exerciseName);
        const periodKey = `${slug}@${isoWeekOf(dayOf(record.date))}`;
        // Un aviso por ejercicio y semana
        if (!seenPeriods.has(periodKey)) {
          seenPeriods.add(periodKey);
          records.push({ record, previousBest: best, periodKey });
        }
      }
      best = Math.max(best, record.weight);
    });
  }
  return records;
}

export function computeStrengthCandidates(exercises, now = new Date()) {
  const since = dayNumber(dayOf(now)) - PR_RECENT_DAYS;
  return allStrengthRecords(exercises)
    .filter(({ record }) => dayNumber(dayOf(record.date)) >= since)
    .map(({ record, previousBest, periodKey }) => ({
      key: 'strength_pr',
      periodKey,
      evidence: {
        refs: [record._id],
        refModel: 'Exercise',
        values: {
          exercise: record.exerciseName,
          previousBest,
          weight: record.weight,
          unit: record.unit,
          reps: record.reps,
          sets: record.sets ?? null,
          date: dayOf(record.date)
        },
        summary: 'Nuevo récord de carga'
      }
    }));
}

// ¿Sigue habiendo un récord válido ese ejercicio-semana con los datos de hoy? (tras corregir o borrar un registro)
export function strengthRecordStillValid(exercises, periodKey) {
  return allStrengthRecords(exercises).some((r) => r.periodKey === periodKey);
}

// Récord actual por ejercicio (para "Mis logros"): mejor carga y cuántos registros
export function strengthSummary(exercises) {
  const bests = new Map();
  for (const e of exercises.filter(isComparable)) {
    const unit = e.weightUnit || 'kg';
    const key = `${normalizeExerciseName(e.exerciseName)}|${unit}`;
    const current = bests.get(key) ?? { exercise: e.exerciseName, unit, best: 0, records: 0 };
    current.best = Math.max(current.best, e.weight);
    current.records += 1;
    bests.set(key, current);
  }
  return [...bests.values()].sort((a, b) => b.records - a.records);
}
