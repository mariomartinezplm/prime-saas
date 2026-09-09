// Genera archivos .ics (RFC 5545) para que el paciente agregue su cita a
// CUALQUIER calendario (Google, Apple, Outlook) con un clic — sin OAuth, sin
// que autorice nada (Paso 28.B de BLUEPRINT.md). Usa TZID=America/Santiago en
// vez de convertir a UTC a mano: los clientes de calendario (todos soportan
// nombres de zona IANA) hacen la conversión ellos mismos, evitando todo el
// cálculo de desfase/horario de verano que sí hace falta en otras partes
// del backend (ver utils/timezone.js).

const CENTER_LOCATION = 'Avenida Volcán Puntiagudo 100, Puerto Montt, Chile';

const TYPE_LABELS = {
  kinesiologia: 'Kinesiología',
  entrenamiento: 'Entrenamiento',
  evaluacion: 'Evaluación'
};

// Escapa texto libre según RFC 5545 (§3.3.11): backslash, coma, punto y coma,
// y saltos de línea van con un backslash antes.
function icsEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function icsDateTime(date, time) {
  // date ya es medianoche UTC del día correcto (así se guarda en toda la
  // app); time es "HH:MM". No hace falta más — se arma el string local que
  // pide TZID, sin ninguna conversión de zona horaria.
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = time.replace(':', '') + '00';
  return `${dateStr}T${timeStr}`;
}

function nowUTCStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateAppointmentICS(appointment) {
  const professional = appointment.professional;
  const professionalName = professional
    ? `${professional.firstName} ${professional.lastName}`
    : 'tu profesional';
  const typeLabel = TYPE_LABELS[appointment.type] || appointment.type;

  const dtStart = icsDateTime(appointment.date, appointment.startTime);
  const dtEnd = icsDateTime(appointment.date, appointment.endTime);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prime F&H//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:appointment-${appointment._id}@primefh.cl`,
    `DTSTAMP:${nowUTCStamp()}`,
    `DTSTART;TZID=America/Santiago:${dtStart}`,
    `DTEND;TZID=America/Santiago:${dtEnd}`,
    `SUMMARY:${icsEscape(`${typeLabel} - Prime F&H`)}`,
    `DESCRIPTION:${icsEscape(`Sesión de ${typeLabel} con ${professionalName} en Prime F&H.`)}`,
    `LOCATION:${icsEscape(CENTER_LOCATION)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  // RFC 5545 exige terminadores de línea CRLF.
  return lines.join('\r\n') + '\r\n';
}
