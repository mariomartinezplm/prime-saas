import type { Measurement } from '@/types';
import { CHART } from '@/lib/chartColors';

export const PERIMETER_LABELS: Record<string, string> = {
  shoulders: 'Hombros',
  chest: 'Pecho',
  neck: 'Cuello',
  bicepLeft: 'Bícep Izq',
  bicepRight: 'Bícep Der',
  bicepFlexedLeft: 'Bícep contraído Izq',
  bicepFlexedRight: 'Bícep contraído Der',
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
  cmj: { label: 'CMJ', description: 'Counter Movement Jump', color: CHART.primary },
  sj: { label: 'SJ', description: 'Squat Jump', color: CHART.secondary },
  cmjLeftLeg: { label: 'CMJ Unipodal Izq', description: 'CMJ Unipodal Pie Izquierdo', color: CHART.info },
  cmjRightLeg: { label: 'CMJ Unipodal Der', description: 'CMJ Unipodal Pie Derecho', color: CHART.success },
  sjLeftLeg: { label: 'SJ Unipodal Izq', description: 'SJ Unipodal Pie Izquierdo', color: CHART.coral },
  sjRightLeg: { label: 'SJ Unipodal Der', description: 'SJ Unipodal Pie Derecho', color: CHART.warning },
  dropJump: { label: 'Drop Jump', description: 'Salto desde altura', color: CHART.coral },
  abalakov: { label: 'Abalakov', description: 'Salto con impulso de brazos', color: CHART.info },
  horizontalJump: { label: 'Salto Horizontal', description: 'Salto longitudinal', color: CHART.secondary },
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
  { key: 'weight', label: 'Peso', unit: 'kg', decimals: 1, color: CHART.primary, read: (m) => m.weight },
  { key: 'bodyFat', label: '% Grasa', unit: '%', decimals: 1, color: CHART.warning, read: (m) => m.bodyFatPercentage },
  { key: 'muscle', label: '% Músculo', unit: '%', decimals: 1, color: CHART.success, read: (m) => m.muscleMassPercentage },
  { key: 'bmi', label: 'IMC', unit: '', decimals: 1, color: CHART.info, read: (m) => m.bmi },
];

export const PERIMETER_METRICS: MetricDefinition[] = Object.entries(PERIMETER_LABELS).map(([key, label]) => ({
  key,
  label,
  unit: 'cm',
  decimals: 1,
  color: CHART.primary,
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
