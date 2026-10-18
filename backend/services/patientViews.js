/**
 * Qué puede ver el PACIENTE de sus citas y de su propia ficha (listas cerradas, mismo criterio que `toPatientPlanView`).
 *
 * Regla: el personal (administrador y profesional) recibe SIEMPRE el documento completo, igual que antes; cualquier otro rol
 * (hoy solo «paciente», pero se trata como restringido por defecto) recibe únicamente lo de abajo. Si el modelo agrega un campo
 * nuevo, por defecto NO llega al paciente hasta que se agregue aquí a propósito.
 */

const STAFF_ROLES = ['admin', 'professional'];
export const isStaffViewer = (user) => !!user && STAFF_ROLES.includes(user.role);

// ── Citas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Verificado contra lo que leen las pantallas del paciente (MyAppointments, NextSessionCard, todayActions, lib/appointments,
// BookAppointment): _id, date, startTime, endTime, type, status, professional (nombre), recurringSlot («Horario fijo») y
// priorToApp («Antes de entrar a la app»). Quedan fuera, entre otros: notas de la sesión y ejercicios (los escribe el equipo),
// sobrecupo y «sobre cupo» (decisiones administrativas), descuento de sesión, evento de Google, avisos enviados, motivo y autor de
// la cancelación, fecha de cierre y la marca de clase de prueba.
export const PATIENT_APPOINTMENT_FIELDS = [
  '_id', 'patient', 'professional', 'date', 'startTime', 'endTime', 'type', 'status', 'recurringSlot', 'priorToApp'
];

const refId = (value) => (value && typeof value === 'object' && value._id ? value._id : value);

// Del profesional solo se entrega el nombre (nunca correo ni teléfono). Si llega sin poblar (solo el id), se deja igual.
const professionalRef = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (value.firstName === undefined && value.lastName === undefined) return refId(value);
  return { _id: value._id, firstName: value.firstName, lastName: value.lastName };
};

export function toPatientAppointmentView(appointment) {
  if (!appointment) return appointment;
  const source = typeof appointment.toObject === 'function' ? appointment.toObject() : appointment;
  const view = {};
  for (const field of PATIENT_APPOINTMENT_FIELDS) {
    if (source[field] === undefined) continue;
    if (field === 'patient') view.patient = refId(source.patient); // el paciente es quien mira: solo su id
    else if (field === 'professional') view.professional = professionalRef(source.professional);
    else view[field] = source[field];
  }
  return view;
}

// El personal recibe la cita tal cual; el resto, la vista cerrada
export const appointmentForViewer = (user, appointment) => (isStaffViewer(user) ? appointment : toPatientAppointmentView(appointment));

// ── Ficha del propio paciente ────────────────────────────────────────────────────────────────────────────────────────────
// Campos administrativos o de origen que ninguna pantalla del paciente lee (verificado): «sobre cupo» (decisión del centro),
// id de la importación desde Airtable, última actividad, origen del registro y la marca de «interesado». El resto de la ficha
// (datos personales, historial clínico propio, profesional asignado, preferencias, insignia de miembro fundador) no cambia.
export const INTERNAL_USER_FIELDS = ['exemptFromCapacity', 'airtableId', 'lastActivityDate', 'source', 'isProspect'];

export function userForViewer(viewer, user) {
  if (!user || isStaffViewer(viewer)) return user;
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  for (const field of INTERNAL_USER_FIELDS) delete plain[field];
  return plain;
}
