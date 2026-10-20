import { exercisesByFrequency, type ExerciseRecord } from '@/lib/exerciseSeries';
import { formatValue, summarize } from '@/lib/trend';

// Resúmenes de una línea para la pantalla «Progreso». Todo sale de los registros reales; sin datos, devuelven null y la pantalla
// muestra un texto neutral (nunca un número inventado).
export function weightSummary(measurements: { date: string; weight?: number | null }[]): string | null {
  const points = measurements.filter((m) => typeof m.weight === 'number' && m.weight! > 0).map((m) => ({ date: m.date, value: m.weight as number }));
  const s = summarize(points, 'kg', 1);
  if (!s) return null;
  return s.count > 1 ? `Peso ${formatValue(s.last.value, 1)} kg · ${s.changeText}` : `Peso ${formatValue(s.last.value, 1)} kg`;
}

export function exercisesSummary(records: ExerciseRecord[]): string | null {
  if (records.length === 0) return null;
  const names = exercisesByFrequency(records).length;
  return `${records.length} ${records.length === 1 ? 'registro' : 'registros'} · ${names} ${names === 1 ? 'ejercicio' : 'ejercicios'}`;
}

export function painSummary(records: { bodyArea: string; painLevel: number; date: string }[]): string | null {
  if (records.length === 0) return null;
  const last = [...records].sort((a, b) => b.date.localeCompare(a.date))[0];
  const zone = last.bodyArea.replace(/-/g, ' ');
  return `${zone.charAt(0).toUpperCase()}${zone.slice(1)} · ${last.painLevel}/10`;
}
