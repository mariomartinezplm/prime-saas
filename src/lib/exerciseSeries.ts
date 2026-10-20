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
