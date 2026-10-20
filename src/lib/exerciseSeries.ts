import type { TrendPoint } from '@/lib/trend';

// Un registro de ejercicio (solo los campos que usa la pantalla)
export interface ExerciseRecord {
  _id: string;
  exerciseName: string;
  date: string;
  sets?: number;
  reps?: number;
  weight?: number;
  weightUnit?: string;
  category?: string;
}

// Serie de carga de UN ejercicio: el mayor peso de cada día, en orden de fecha. Sin peso no hay punto (no se inventa nada).
export function weightSeries(records: ExerciseRecord[]): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const r of records) {
    if (!r.weight || r.weight <= 0) continue;
    const day = r.date.slice(0, 10);
    byDay.set(day, Math.max(byDay.get(day) ?? 0, r.weight));
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

// Ejercicios ordenados por cuántas veces se registraron (el más frecuente primero)
export function exercisesByFrequency(records: ExerciseRecord[]): string[] {
  const count = new Map<string, number>();
  records.forEach((r) => count.set(r.exerciseName, (count.get(r.exerciseName) ?? 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}

// Volumen total (series × repeticiones × peso) en toneladas; solo cuenta registros con los tres datos
export function totalVolumeTons(records: ExerciseRecord[]): number {
  return records.reduce((sum, r) => (r.sets && r.reps && r.weight ? sum + r.sets * r.reps * r.weight : sum), 0) / 1000;
}

// Un ejercicio es «de rehabilitación» si la mayoría de sus registros lo son: ahí subir la carga NO es necesariamente el objetivo
export const isRehabExercise = (records: ExerciseRecord[]): boolean =>
  records.length > 0 && records.filter((r) => r.category === 'rehabilitacion').length * 2 > records.length;

// Días distintos con algún registro (una «sesión registrada» por día, aunque ese día se hayan anotado varios ejercicios)
export const sessionDays = (records: ExerciseRecord[]): number => new Set(records.map((r) => r.date.slice(0, 10))).size;

// Volumen de entrenamiento (toneladas) de los últimos 30 días frente a los 30 anteriores. Solo ejercicios de entrenamiento (no de rehabilitación).
// Devuelve null si falta alguno de los dos periodos: no se compara contra nada inventado.
export function volumeComparison(records: ExerciseRecord[], now: Date = new Date()): { current: number; previous: number } | null {
  const DAY = 24 * 60 * 60 * 1000;
  const t = now.getTime();
  const training = records.filter((r) => r.category !== 'rehabilitacion');
  const inWindow = (from: number, to: number) => totalVolumeTons(training.filter((r) => { const d = new Date(r.date).getTime(); return d > t - to * DAY && d <= t - from * DAY; }));
  const current = inWindow(0, 30);
  const previous = inWindow(30, 60);
  return current > 0 && previous > 0 ? { current, previous } : null;
}
