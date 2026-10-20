import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Funciones puras para mostrar la evolución de una medida (peso, perímetros, saltos…). Sin datos inventados: todo sale de los puntos reales.
export interface TrendPoint {
  date: string; // ISO
  value: number;
}

export type TrendRange = '3m' | '6m' | 'all';

const MINUS = '−';

// Números en formato chileno (coma decimal). Sin decimales sobrantes en cifras enteras de 0 decimales.
export function formatValue(value: number, decimals = 1): string {
  return value.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function sortPoints(points: TrendPoint[]): TrendPoint[] {
  return [...points].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
}

// Filtra por rango de tiempo contando hacia atrás desde el ÚLTIMO registro (no desde hoy: un dato de hace 4 meses sigue siendo «lo último»).
export function filterByRange(points: TrendPoint[], range: TrendRange): TrendPoint[] {
  const sorted = sortPoints(points);
  if (range === 'all' || sorted.length === 0) return sorted;
  const last = parseISO(sorted[sorted.length - 1].date);
  const from = new Date(last);
  from.setMonth(from.getMonth() - (range === '3m' ? 3 : 6));
  return sorted.filter((p) => parseISO(p.date) >= from);
}

export interface TrendSummary {
  count: number;
  last: TrendPoint;
  first: TrendPoint;
  change: number; // último − primero
  changeText: string; // «−3,6 kg» · «+2 cm» · «Sin cambios»
  sinceText: string; // «desde el 10 jul.»
  direction: 'up' | 'down' | 'flat';
}

export function summarize(points: TrendPoint[], unit: string, decimals = 1): TrendSummary | null {
  const sorted = sortPoints(points);
  if (sorted.length === 0) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const change = Math.round((last.value - first.value) * 10 ** decimals) / 10 ** decimals;
  const unitText = unit ? ` ${unit}` : '';
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const changeText = direction === 'flat' ? 'Sin cambios' : `${direction === 'up' ? '+' : MINUS}${formatValue(Math.abs(change), decimals)}${unitText}`;
  return { count: sorted.length, first, last, change, changeText, sinceText: `desde el ${shortDate(first.date)}`, direction };
}

// «10 jul.» / «10 jul. 2025» si cruza de año respecto de `ref`
export function shortDate(iso: string, ref?: string): string {
  const d = parseISO(iso);
  const crossesYear = ref ? parseISO(ref).getFullYear() !== d.getFullYear() : false;
  return format(d, crossesYear ? "d MMM yyyy" : 'd MMM', { locale: es }).replace(/\./g, '');
}

export function longDate(iso: string): string {
  return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
}

// Texto para lectores de pantalla (el gráfico es una imagen): rango, primer y último valor y cuántos registros
export function describeTrend(label: string, points: TrendPoint[], unit: string, decimals = 1): string {
  const s = summarize(points, unit, decimals);
  if (!s) return `${label}: sin registros.`;
  const u = unit ? ` ${unit}` : '';
  if (s.count === 1) return `${label}: un registro, ${formatValue(s.last.value, decimals)}${u} el ${longDate(s.last.date)}.`;
  return `${label}: ${s.count} registros, de ${formatValue(s.first.value, decimals)}${u} el ${longDate(s.first.date)} a ${formatValue(s.last.value, decimals)}${u} el ${longDate(s.last.date)}. Cambio: ${s.changeText}.`;
}
