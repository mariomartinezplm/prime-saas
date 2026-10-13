import { parseISO } from 'date-fns';
import type { Appointment, User } from '@/types';

// El servidor guarda el DÍA de una cita (y de un bloqueo de agenda) como medianoche UTC:
// "2026-10-12T00:00:00.000Z". Si se parsea completo, en Chile (UTC-3/-4) cae en la tarde del
// día ANTERIOR y todo se ve un día antes. Por eso siempre se usan solo los 10 primeros
// caracteres ("2026-10-12"), que date-fns lee como medianoche LOCAL de ese día.
export const dayKey = (iso: string) => iso.slice(0, 10);

export const parseDay = (iso: string): Date => parseISO(dayKey(iso));

const atTime = (apt: Appointment, time: string) => {
  const [h, m] = time.split(':').map(Number);
  const date = parseDay(apt.date);
  date.setHours(h, m, 0, 0);
  return date;
};

// Inicio y fin de la cita en la hora local del dispositivo
export const appointmentStart = (apt: Appointment) => atTime(apt, apt.startTime);
export const appointmentEnd = (apt: Appointment) => atTime(apt, apt.endTime);

type Person = User | string;

export const personId = (value: Person): string | undefined =>
  typeof value === 'object' && value ? (value.id ?? (value as { _id?: string })._id) : typeof value === 'string' ? value : undefined;

export const personName = (value: Person, fallback: string): string =>
  typeof value === 'object' && value ? `${value.firstName} ${value.lastName}` : fallback;
