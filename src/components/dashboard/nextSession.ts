import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDay } from '../../lib/appointments';
import type { Appointment } from '../../types';

export interface NextSessionLabel {
  text: string; // «Hoy», «Mañana» o «Jueves 15 de octubre»
  isToday: boolean;
  detail?: string; // «en 2 días» (solo sesiones que no son de hoy ni de mañana)
}

// Distingue con texto una sesión de hoy de una futura. No repite cuánto falta para las de hoy (eso ya lo dice «Para hoy»).
export const nextSessionLabel = (apt: Appointment, now: Date): NextSessionLabel => {
  const day = parseDay(apt.date);
  const diff = differenceInCalendarDays(day, now);
  if (diff <= 0) return { text: 'Hoy', isToday: true };
  if (diff === 1) return { text: 'Mañana', isToday: false };
  const weekday = format(day, "EEEE d 'de' MMMM", { locale: es });
  return { text: weekday.charAt(0).toUpperCase() + weekday.slice(1), isToday: false, detail: `en ${diff} días` };
};

export const sessionsWord = (n: number) => (n === 1 ? '1 sesión' : `${n} sesiones`);
