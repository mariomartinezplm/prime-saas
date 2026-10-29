import { exerciseKeyOf } from './exerciseKey';
import type { ExerciseSummary, LibraryExercise } from '@/services/exerciseService';

// Ejercicios de la lista que coinciden con lo escrito: todas las palabras escritas deben aparecer en el nombre (sin tildes ni
// mayúsculas). Sin texto, se ofrecen todos (del más reciente al más antiguo). El que empieza igual que lo escrito va primero.
export function filterExercises(options: ExerciseSummary[], typed: string, max = 30): ExerciseSummary[] {
  const text = exerciseKeyOf(typed);
  if (!text) return options.slice(0, max);
  const tokens = text.split(' ');
  return options
    .filter((o) => tokens.every((t) => o.key.includes(t)))
    .sort((a, b) => Number(b.key.startsWith(text)) - Number(a.key.startsWith(text)))
    .slice(0, max);
}

// Ejercicios de la biblioteca compartida que la persona todavía NO tiene (los suyos ya salen arriba), filtrados igual que los suyos
export function filterLibrary(library: LibraryExercise[], own: ExerciseSummary[], typed: string, max = 30): LibraryExercise[] {
  const ownKeys = new Set(own.map((o) => o.key));
  const text = exerciseKeyOf(typed);
  const tokens = text ? text.split(' ') : [];
  return library
    .filter((l) => !ownKeys.has(l.key) && tokens.every((t) => l.key.includes(t)))
    .sort((a, b) => Number(b.key.startsWith(text)) - Number(a.key.startsWith(text)))
    .slice(0, max);
}

// El ejercicio ya registrado que corresponde EXACTAMENTE a lo escrito (misma identidad: sin tildes, mayúsculas ni espacios de más)
export const exactExercise = (options: ExerciseSummary[], typed: string): ExerciseSummary | undefined => {
  const key = exerciseKeyOf(typed);
  return key ? options.find((o) => o.key === key) : undefined;
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

// «60 kg · 3 series × 8 repeticiones · 12 oct» — solo con lo que de verdad se anotó (nunca inventa un dato)
export function lastRecordText(o: ExerciseSummary): string {
  const parts: string[] = [];
  if (o.last.weight !== null) parts.push(`${String(o.last.weight).replace('.', ',')} ${o.last.weightUnit}`);
  if (o.last.sets !== null && o.last.reps !== null) parts.push(`${o.last.sets} ${o.last.sets === 1 ? 'serie' : 'series'} × ${o.last.reps} ${o.last.reps === 1 ? 'repetición' : 'repeticiones'}`);
  else if (o.last.reps !== null) parts.push(`${o.last.reps} ${o.last.reps === 1 ? 'repetición' : 'repeticiones'}`);
  parts.push(dayLabel(o.lastDate));
  return parts.join(' · ');
}
