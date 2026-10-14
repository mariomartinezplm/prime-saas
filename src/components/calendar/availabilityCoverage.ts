import { format, getDay } from 'date-fns';
import { dayKey } from '@/lib/appointments';
import type { Availability } from '@/types';

// Minutos desde medianoche: [desde, hasta)
type Range = [number, number];

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Une tramos que se tocan o se pisan (07:00-08:00 y 07:30-08:30 → 07:00-08:30)
const merge = (ranges: Range[]): Range[] => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else out.push([range[0], range[1]]);
  }
  return out;
};

const contains = (ranges: Range[], minutes: number) => ranges.some(([from, to]) => minutes >= from && minutes < to);

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Cuándo atiende un profesional (según su Disponibilidad) y qué fechas tiene bloqueadas. Es solo para MOSTRAR en el
// calendario: quien decide qué se puede reservar sigue siendo el servidor.
export interface Coverage {
  weekly: Map<number, Range[]>;
  blocked: Map<string, { allDay: boolean; ranges: Range[] }>;
}

export type SlotKind = 'blocked' | 'working' | 'off';

// null = no hay horario configurado (no se dibuja nada)
export const buildCoverage = (availability: Availability | null): Coverage | null => {
  const weekly = new Map<number, Range[]>();
  for (const day of availability?.weeklySchedule ?? []) {
    if (day.slots.length === 0) continue;
    weekly.set(day.dayOfWeek, merge(day.slots.map((s) => [toMinutes(s.startTime), toMinutes(s.endTime)] as Range)));
  }
  if (weekly.size === 0) return null;

  const blocked = new Map<string, { allDay: boolean; ranges: Range[] }>();
  for (const block of availability?.blockedDates ?? []) {
    const key = dayKey(block.date);
    const previous = blocked.get(key);
    blocked.set(key, {
      allDay: block.allDay || !!previous?.allDay,
      ranges: merge([...(previous?.ranges ?? []), ...(block.slots ?? []).map((s) => [toMinutes(s.startTime), toMinutes(s.endTime)] as Range)]),
    });
  }
  return { weekly, blocked };
};

// Tipo de una celda de calendario, según el instante en que empieza
export const slotKind = (coverage: Coverage, date: Date): SlotKind => {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const block = coverage.blocked.get(format(date, 'yyyy-MM-dd'));
  if (block && (block.allDay || contains(block.ranges, minutes))) return 'blocked';
  return contains(coverage.weekly.get(getDay(date)) ?? [], minutes) ? 'working' : 'off';
};

// Resumen de un día en texto, para la lista del móvil: "07:00–08:00 · 10:00–11:00", "Día bloqueado" o null
export const dayAvailabilityText = (coverage: Coverage, date: Date): string | null => {
  const block = coverage.blocked.get(format(date, 'yyyy-MM-dd'));
  if (block?.allDay) return 'Día bloqueado';
  const ranges = coverage.weekly.get(getDay(date));
  if (!ranges) return null;
  return ranges.map(([from, to]) => `${clock(from)}–${clock(to)}`).join(' · ');
};

// Horas (enteras) que hay que mostrar para que se vea todo el horario de atención
export const coverageHours = (coverage: Coverage | null) => {
  if (!coverage) return null;
  const all = [...coverage.weekly.values()].flat();
  return { minHour: Math.floor(Math.min(...all.map((r) => r[0])) / 60), maxHour: Math.ceil(Math.max(...all.map((r) => r[1])) / 60) };
};
