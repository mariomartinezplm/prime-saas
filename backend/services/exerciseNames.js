import ExerciseProgress from '../models/Exercise.js';
import { exerciseKey } from '../utils/exerciseKey.js';

/**
 * Identidad de los ejercicios SIN un catálogo nuevo: el nombre que ya existe en el historial de la persona manda.
 *
 * Dos escrituras son el mismo ejercicio solo si son iguales una vez quitados tildes, mayúsculas, signos y espacios de más
 * («Sentadilla Búlgara » = «sentadilla bulgara»). NUNCA se unen nombres distintos aunque se parezcan: «sentadilla trasera» y
 * «sentadilla búlgara» son ejercicios diferentes. Todo se consulta solo con el historial del propio paciente.
 */

export const MAX_EXERCISE_NAME = 60;

export { exerciseKey };

// Texto que se guarda para un ejercicio NUEVO. Devuelve null si no es un nombre válido.
export function cleanExerciseName(name) {
  if (typeof name !== 'string') return null;
  const text = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > MAX_EXERCISE_NAME || exerciseKey(text) === '') return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const HISTORY_LIMIT = 3000;

// Historial del paciente agrupado por ejercicio (identidad = clave normalizada). El nombre mostrado es la escritura más reciente.
// Los ejercicios guardados HOY también aparecen (para poder reutilizarlos en otro bloque), pero la referencia «última vez»
// (`last`, `refDate`) sale solo de OTRAS sesiones: lo de hoy nunca se presenta como si fuera del pasado.
export async function exerciseHistory(patientId, { excludeSession } = {}) {
  const rows = await ExerciseProgress.find({ patient: patientId }).sort({ date: -1, createdAt: -1 }).limit(HISTORY_LIMIT).select('exerciseName date reps weight weightUnit durationSec modality workoutSession').lean();
  const groups = new Map();
  for (const r of rows) {
    const key = exerciseKey(r.exerciseName);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { key, name: r.exerciseName, count: 0, days: new Set(), lastDate: r.date, ref: null };
      groups.set(key, g);
    }
    g.count += 1;
    g.days.add(new Date(r.date).toISOString().slice(0, 10));
    const fromCurrent = excludeSession && r.workoutSession && String(r.workoutSession) === String(excludeSession);
    if (!g.ref && !fromCurrent) g.ref = { reps: r.reps ?? null, weight: r.weight ?? null, weightUnit: r.weightUnit ?? 'kg', durationSec: r.durationSec ?? null, modality: r.modality ?? null, date: r.date };
  }
  return [...groups.values()].map((g) => ({ key: g.key, name: g.name, count: g.count, days: g.days.size, lastDate: g.lastDate, last: g.ref ? { reps: g.ref.reps, weight: g.ref.weight, weightUnit: g.ref.weightUnit, durationSec: g.ref.durationSec, modality: g.ref.modality } : { reps: null, weight: null, weightUnit: 'kg', durationSec: null, modality: null }, refDate: g.ref?.date ?? null }));
}

// Si el nombre ya existe en el historial, se reutiliza EXACTAMENTE esa escritura (misma identidad); si no, es un ejercicio nuevo
export async function resolveCanonicalName(patientId, typed, history) {
  const clean = cleanExerciseName(typed);
  if (!clean) return null;
  const rows = history ?? (await exerciseHistory(patientId));
  const found = rows.find((g) => g.key === exerciseKey(clean));
  return found ? { name: found.name, existing: true } : { name: clean, existing: false };
}

// Escritura con la que se guarda un registro del flujo clásico de Ejercicios: si ya existe el mismo ejercicio (misma clave) se
// reutiliza SU escritura; si no, la que se escribió, con los espacios limpios. Nunca rechaza (la validación es del controlador).
export async function canonicalSpelling(patientId, typed) {
  const text = String(typed ?? '').replace(/\s+/g, ' ').trim();
  const key = exerciseKey(text);
  if (!key) return text;
  const found = (await exerciseHistory(patientId)).find((g) => g.key === key);
  return found ? found.name : text;
}

const view = (g) => ({ name: g.name, count: g.count, days: g.days, lastDate: g.lastDate, refDate: g.refDate ?? null, last: g.last });

// Búsqueda: recientes, frecuentes y coincidencias del texto (todas las palabras escritas deben aparecer en el nombre)
export function searchExercises(history, q = '') {
  const text = exerciseKey(q);
  const byRecent = [...history].sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
  const recent = byRecent.slice(0, 6).map(view);
  const frequent = [...history]
    .filter((g) => g.days >= 2)
    .sort((a, b) => b.days - a.days || b.count - a.count || new Date(b.lastDate) - new Date(a.lastDate))
    .slice(0, 6)
    .map(view);
  let matches = [];
  if (text) {
    const tokens = text.split(' ');
    matches = byRecent
      .filter((g) => tokens.every((t) => g.key.includes(t)))
      .sort((a, b) => Number(b.key.startsWith(text)) - Number(a.key.startsWith(text)))
      .slice(0, 20)
      .map(view);
  }
  const exact = text ? history.some((g) => g.key === text) : false;
  return { recent, frequent, matches, exact };
}
