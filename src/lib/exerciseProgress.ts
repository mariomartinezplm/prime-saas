import { exerciseKeyOf } from './exerciseKey';

// Un registro del historial de ejercicios (solo los campos que usa el progreso por ejercicio)
export interface ProgressRecord {
  _id: string;
  exerciseName: string;
  date: string;
  sets?: number;
  reps?: number;
  weight?: number;
  weightUnit?: string;
  durationSec?: number;
  duration?: number; // minutos (registros antiguos)
  modality?: 'weight' | 'bodyweight' | 'time';
  category?: string;
}

export type Metric = 'load' | 'reps' | 'time';
export type Period = '30' | '90' | 'all';

export interface ExerciseGroup {
  key: string;
  name: string; // escritura que se muestra (la más reciente)
  records: ProgressRecord[];
}

const day = (r: ProgressRecord) => r.date.slice(0, 10);
const isKg = (r: ProgressRecord) => (r.weightUnit ?? 'kg') === 'kg';

// Agrupa el historial por identidad canónica: «Press Banca» y «press banca» son UN ejercicio. Nada se fusiona por parecido.
export function groupExercises(records: ProgressRecord[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  for (const r of [...records].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = exerciseKeyOf(r.exerciseName);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.records.push(r);
    else groups.set(key, { key, name: r.exerciseName, records: [r] });
  }
  return [...groups.values()];
}

// Cómo se mide un registro (sin inventar nada): lo guardado manda; en registros antiguos se deduce de los datos
export function modalityOf(r: ProgressRecord): 'weight' | 'bodyweight' | 'time' | null {
  if (r.modality) return r.modality;
  if (r.durationSec || (r.duration && !r.weight && !r.reps)) return 'time';
  if (r.weight && r.weight > 0) return 'weight';
  if (r.reps && r.reps > 0) return 'bodyweight';
  return null;
}

// Métrica principal del ejercicio: la del registro más reciente. Las métricas incompatibles nunca se mezclan en un gráfico.
export function primaryMetric(records: ProgressRecord[]): Metric | null {
  for (const r of [...records].sort((a, b) => b.date.localeCompare(a.date))) {
    const m = modalityOf(r);
    if (m === 'weight') return 'load';
    if (m === 'bodyweight') return 'reps';
    if (m === 'time') return 'time';
  }
  return null;
}

export interface ProgressPoint {
  date: string; // AAAA-MM-DD
  value: number; // kg, repeticiones o segundos según la métrica
  reps: number | null; // repeticiones asociadas (solo con carga)
  sets: number; // series registradas ese día
}

const seconds = (r: ProgressRecord) => r.durationSec ?? (r.duration ? Math.round(r.duration * 60) : 0);

// Un punto por día: la carga máxima del día (kg) con sus repeticiones; o las repeticiones máximas; o la duración máxima.
export function progressPoints(records: ProgressRecord[], metric: Metric): ProgressPoint[] {
  const byDay = new Map<string, ProgressPoint>();
  const sets = new Map<string, number>();
  for (const r of records) sets.set(day(r), (sets.get(day(r)) ?? 0) + (r.sets ?? 1));
  for (const r of records) {
    const m = modalityOf(r);
    let value = 0;
    let reps: number | null = null;
    if (metric === 'load') {
      if (m !== 'weight' || !isKg(r) || !(r.weight && r.weight > 0)) continue; // las libras conservan su valor pero no se grafican con kg
      value = r.weight;
      reps = r.reps ?? null;
    } else if (metric === 'reps') {
      if (m !== 'bodyweight' || !(r.reps && r.reps > 0)) continue;
      value = r.reps;
    } else {
      if (m !== 'time' || !(seconds(r) > 0)) continue;
      value = seconds(r);
    }
    const cur = byDay.get(day(r));
    if (!cur || value > cur.value || (value === cur.value && (reps ?? 0) > (cur.reps ?? 0))) byDay.set(day(r), { date: day(r), value, reps, sets: sets.get(day(r)) ?? 1 });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Recorta por período: últimos 30 o 90 días contados desde HOY (no desde el último registro), o todo
export function filterPeriod(points: ProgressPoint[], period: Period, now: Date = new Date()): ProgressPoint[] {
  if (period === 'all') return points;
  const from = new Date(now.getTime() - Number(period) * 86400000).toISOString().slice(0, 10);
  return points.filter((p) => p.date >= from);
}

export interface BestMark {
  value: number;
  reps: number | null;
  date: string;
}

// Mejor marca histórica (sobre TODO el historial, no solo el período): mayor carga, más repeticiones o más tiempo
export function bestMark(points: ProgressPoint[]): BestMark | null {
  if (points.length === 0) return null;
  const best = points.reduce((b, p) => (p.value > b.value || (p.value === b.value && p.date > b.date) ? p : b));
  return { value: best.value, reps: best.reps, date: best.date };
}

// Historial por día (más reciente primero) con cada serie tal como se registró
export interface SessionRow {
  date: string;
  sets: { reps: number | null; weight: number | null; unit: string; seconds: number | null }[];
}
export function sessionHistory(records: ProgressRecord[]): SessionRow[] {
  const map = new Map<string, SessionRow>();
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) {
    const row = map.get(day(r)) ?? { date: day(r), sets: [] };
    const count = Math.max(1, r.sets ?? 1);
    for (let i = 0; i < count; i += 1) row.sets.push({ reps: r.reps ?? null, weight: r.weight ?? null, unit: r.weightUnit ?? 'kg', seconds: seconds(r) || null });
    map.set(day(r), row);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export const metricLabel: Record<Metric, { title: string; unit: string; axis: string }> = {
  load: { title: 'Carga máxima por día', unit: 'kg', axis: 'kg' },
  reps: { title: 'Repeticiones máximas por serie', unit: 'rep', axis: 'repeticiones' },
  time: { title: 'Duración máxima por serie', unit: 's', axis: 'segundos' },
};

// Unifica la escritura del nombre dentro del historial cargado: «press banca» y «PRESS BANCA» pasan a mostrarse como la escritura
// del registro más reciente. Solo cambia el texto mostrado en memoria; no toca los datos.
export function normalizeNames<T extends { exerciseName: string; date: string }>(records: T[]): T[] {
  const display = new Map<string, string>();
  for (const r of [...records].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = exerciseKeyOf(r.exerciseName);
    if (key && !display.has(key)) display.set(key, r.exerciseName);
  }
  return records.map((r) => {
    const name = display.get(exerciseKeyOf(r.exerciseName));
    return name && name !== r.exerciseName ? { ...r, exerciseName: name } : r;
  });
}

// Texto corto de una serie: «10 × 20 kg», «12 rep», «30 s»
export function setLabel(s: { reps: number | null; weight: number | null; unit: string; seconds: number | null }): string {
  if (s.seconds) return `${s.seconds} s`;
  if (s.reps && s.weight) return `${s.reps} × ${String(s.weight).replace('.', ',')} ${s.unit}`;
  if (s.reps) return `${s.reps} rep`;
  return '—';
}

export const formatNumber = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

// Lectura simple del progreso (sin diagnosticar ni exagerar): cambio frente a la sesión anterior, mejora sobre la mejor marca previa
// y cuántas sesiones lleva registrando el ejercicio. Todo sale de los puntos reales; con un solo registro no hay comparación.
export interface Insights {
  sessions: number;
  changeFromPrevious: number | null; // última − anterior (misma métrica)
  improvedOverPreviousBest: number | null; // solo si la última sesión SUPERA la mejor marca anterior
  tie: boolean; // igualó su mejor marca anterior
}
export function insights(points: ProgressPoint[]): Insights {
  const n = points.length;
  if (n === 0) return { sessions: 0, changeFromPrevious: null, improvedOverPreviousBest: null, tie: false };
  const last = points[n - 1];
  if (n === 1) return { sessions: 1, changeFromPrevious: null, improvedOverPreviousBest: null, tie: false };
  const previousBest = Math.max(...points.slice(0, -1).map((p) => p.value));
  return {
    sessions: n,
    changeFromPrevious: Math.round((last.value - points[n - 2].value) * 100) / 100,
    improvedOverPreviousBest: last.value > previousBest ? Math.round((last.value - previousBest) * 100) / 100 : null,
    tie: last.value === previousBest,
  };
}
