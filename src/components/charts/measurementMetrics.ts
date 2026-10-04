import type { Measurement } from '@/types';

export const PERIMETER_LABELS: Record<string, string> = {
  shoulders: 'Hombros',
  chest: 'Pecho',
  neck: 'Cuello',
  bicepLeft: 'Bícep Izq',
  bicepRight: 'Bícep Der',
  forearmLeft: 'Antebrazo Izq',
  forearmRight: 'Antebrazo Der',
  waist: 'Cintura',
  hips: 'Cadera',
  thighLeft: 'Pierna Izq',
  thighRight: 'Pierna Der',
  calfLeft: 'Gemelo Izq',
  calfRight: 'Gemelo Der',
};

export const JUMP_TEST_LABELS: Record<string, { label: string; description: string; color: string }> = {
  cmj: { label: 'CMJ', description: 'Counter Movement Jump', color: '#398CA2' },
  sj: { label: 'SJ', description: 'Squat Jump', color: '#2F7A8F' },
  cmjLeftLeg: { label: 'CMJ Unipodal Izq', description: 'CMJ Unipodal Pie Izquierdo', color: '#4BA5BC' },
  cmjRightLeg: { label: 'CMJ Unipodal Der', description: 'CMJ Unipodal Pie Derecho', color: '#5BB5CC' },
  sjLeftLeg: { label: 'SJ Unipodal Izq', description: 'SJ Unipodal Pie Izquierdo', color: '#6BC5DC' },
  sjRightLeg: { label: 'SJ Unipodal Der', description: 'SJ Unipodal Pie Derecho', color: '#7BD5EC' },
  dropJump: { label: 'Drop Jump', description: 'Salto desde altura', color: '#F59E0B' },
  abalakov: { label: 'Abalakov', description: 'Salto con impulso de brazos', color: '#8B5CF6' },
  horizontalJump: { label: 'Salto Horizontal', description: 'Salto longitudinal', color: '#D946EF' },
};

export interface MetricPoint {
  date: string;
  value: number;
}

export interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  color: string;
  read: (m: Measurement) => number | undefined | null;
}

export const GENERAL_METRICS: MetricDefinition[] = [
  { key: 'weight', label: 'Peso', unit: 'kg', decimals: 1, color: '#398CA2', read: (m) => m.weight },
  { key: 'bodyFat', label: '% Grasa', unit: '%', decimals: 1, color: '#F59E0B', read: (m) => m.bodyFatPercentage },
  { key: 'muscle', label: '% Músculo', unit: '%', decimals: 1, color: '#10B981', read: (m) => m.muscleMassPercentage },
  { key: 'bmi', label: 'IMC', unit: '', decimals: 1, color: '#8B5CF6', read: (m) => m.bmi },
];

export const PERIMETER_METRICS: MetricDefinition[] = Object.entries(PERIMETER_LABELS).map(([key, label]) => ({
  key,
  label,
  unit: 'cm',
  decimals: 1,
  color: '#398CA2',
  read: (m: Measurement) => m.perimeters?.[key as keyof NonNullable<Measurement['perimeters']>] as number | undefined,
}));

export const JUMP_METRICS: MetricDefinition[] = Object.entries(JUMP_TEST_LABELS).map(([key, cfg]) => ({
  key,
  label: cfg.label,
  unit: 'cm',
  decimals: 1,
  color: cfg.color,
  read: (m: Measurement) => m.jumpTests?.[key as keyof NonNullable<Measurement['jumpTests']>] as number | undefined,
}));

// Un 0 se trata como "sin dato": ninguna de estas medidas puede ser 0 de verdad
export function buildSeries(measurements: Measurement[], read: MetricDefinition['read']): MetricPoint[] {
  return measurements
    .map((m) => ({ date: m.date, value: read(m) }))
    .filter((p): p is MetricPoint => typeof p.value === 'number' && Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
