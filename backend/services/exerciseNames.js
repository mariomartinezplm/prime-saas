import ExerciseProgress from '../models/Exercise.js';

/**
 * Identidad de los ejercicios SIN un catálogo nuevo: el nombre que ya existe en el historial de la persona manda.
 *
 * Dos escrituras son el mismo ejercicio solo si son iguales una vez quitados tildes, mayúsculas, signos y espacios de más
 * («Sentadilla Búlgara » = «sentadilla bulgara»). NUNCA se unen nombres distintos aunque se parezcan: «sentadilla trasera» y
 * «sentadilla búlgara» son ejercicios diferentes. Todo se consulta solo con el historial del propio paciente.
 */

export const MAX_EXERCISE_NAME = 60;

export function exerciseKey(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

// Texto que se guarda para un ejercicio NUEVO. Devuelve null si no es un nombre válido.
export function cleanExerciseName(name) {
  if (typeof name !== 'string') return null;
  const text = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > MAX_EXERCISE_NAME || exerciseKey(text) === '') return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const HISTORY_LIMIT = 3000;

// Historial del paciente agrupado por ejercicio (identidad = clave normalizada). El nombre mostrado es la escritura más reciente.
export async function exerciseHistory(patientId) {
  const rows = await ExerciseProgress.find({ patient: patientId }).sort({ date: -1, createdAt: -1 }).limit(HISTORY_LIMIT).select('exerciseName date reps weight weightUnit durationSec modality').lean();
  const groups = new Map();
  for (const r of rows) {
    const key = exerciseKey(r.exerciseName);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { key, name: r.exerciseName, count: 0, days: new Set(), lastDate: r.date, last: { reps: r.reps ?? null, weight: r.weight ?? null, weightUnit: r.weightUnit ?? 'kg', durationSec: r.durationSec ?? null, modality: r.modality ?? null } };
      groups.set(key, g);
    }
    g.count += 1;
    g.days.add(new Date(r.date).toISOString().slice(0, 10));
  }
  return [...groups.values()].map((g) => ({ key: g.key, name: g.name, count: g.count, days: g.days.size, lastDate: g.lastDate, last: g.last }));
}

// Si el nombre ya existe en el historial, se reutiliza EXACTAMENTE esa escritura (misma identidad); si no, es un ejercicio nuevo
export async function resolveCanonicalName(patientId, typed, history) {
  const clean = cleanExerciseName(typed);
  if (!clean) return null;
  const rows = history ?? (await exerciseHistory(patientId));
  const found = rows.find((g) => g.key === exerciseKey(clean));
  return found ? { name: found.name, existing: true } : { name: clean, existing: false };
}

const view = (g) => ({ name: g.name, count: g.count, days: g.days, lastDate: g.lastDate, last: g.last });

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
