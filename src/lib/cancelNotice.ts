// Aviso de cancelación: cada vez que el paciente entra a la app le recuerda la regla de las 3 horas para cancelar o cambiar su
// horario. No sale mientras está en su horario de entrenamiento (desde 30 min antes de que empiece hasta que termina).
import type { Appointment } from '../types';
import { appointmentEnd, appointmentStart } from './appointments';
import { PATIENT_CANCEL_AHEAD_HOURS } from '../config/bookingRules';

export const CANCEL_NOTICE_HOURS = PATIENT_CANCEL_AHEAD_HOURS;
const BEFORE_START_MS = 30 * 60 * 1000;

export const CANCEL_NOTICE = {
  title: `Cancela o cambia tu hora con ${CANCEL_NOTICE_HOURS} horas de anticipación`,
  body: `Si no puedes asistir, cancela o cambia tu horario con al menos ${CANCEL_NOTICE_HOURS} horas de anticipación. Pasado ese tiempo la sesión se descuenta de tu plan como si la hubieras usado, porque ya no alcanza a tomarla otra persona. Así cuidamos los cupos de todos.`,
};

// ¿Está ahora dentro de un horario de entrenamiento suyo? (cita agendada, de 30 min antes del inicio hasta el fin)
export function isInTrainingTime(appointments: Appointment[] | null, now: Date): boolean {
  return (appointments ?? []).some((a) => {
    if (a.status !== 'scheduled' || a.type !== 'entrenamiento') return false;
    const start = appointmentStart(a).getTime();
    const end = appointmentEnd(a).getTime();
    const t = now.getTime();
    return t >= start - BEFORE_START_MS && t <= end;
  });
}

// ¿Se muestra? A quien tiene plan vigente, una vez cada vez que entra (si ya lo cerró en esta visita no vuelve), y nunca en pleno
// horario de entrenamiento. Mientras las citas siguen cargando no se muestra, para que no aparezca y desaparezca.
export function shouldShowCancelNotice(input: { now: Date; hasPlan: boolean; appointments: Appointment[] | null; appointmentsLoading: boolean; dismissed: boolean }): boolean {
  if (!input.hasPlan || input.dismissed || input.appointmentsLoading) return false;
  return !isInTrainingTime(input.appointments, input.now);
}
