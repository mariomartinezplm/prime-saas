import { appointmentEnd, appointmentStart, personName } from '@/lib/appointments';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import type { Appointment } from '@/types';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

// Las fechas de la cita se leen como día LOCAL (ver lib/appointments.ts): sin esto, en Chile
// cada cita aparecía un día antes.
export const toEvents = (appointments: Appointment[]): CalendarEvent[] =>
  appointments.map((apt) => ({
    id: apt._id,
    title: `${personName(apt.patient, 'Paciente')} · ${appointmentTypeLabels[apt.type]}`,
    start: appointmentStart(apt),
    end: appointmentEnd(apt),
    resource: apt,
  }));

export const statusClass = (status: Appointment['status']) => `apt-${status}`;

// El calendario muestra de 07:00 a 21:00, y se amplía si hay citas fuera de ese rango
// (antes una cita a las 21:00 o más tarde quedaba oculta).
export const visibleHours = (events: CalendarEvent[], coverage: { minHour: number; maxHour: number } | null = null) => {
  const earliest = Math.min(7, ...events.map((e) => e.start.getHours()), coverage?.minHour ?? 7);
  const latest = Math.max(21, ...events.map((e) => (e.end.getMinutes() > 0 ? e.end.getHours() + 1 : e.end.getHours())), coverage?.maxHour ?? 21);
  return { minHour: earliest, maxHour: Math.min(24, latest) };
};
