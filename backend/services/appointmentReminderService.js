import Appointment from '../models/Appointment.js';
import { nowInSantiago } from '../utils/timezone.js';
import { sendAppointmentReminderEmail } from './emailService.js';

const HOUR_MS = 60 * 60 * 1000;

// Cada recordatorio tiene su ventana, medida en horas que faltan para la sesión.
// Con el programador corriendo cada pocos minutos, la ventana entera sirve de
// margen: si el servidor estuvo caído un rato, el recordatorio sale al volver.
const REMINDERS = [
  { hoursBefore: 24, field: 'reminder24hSentAt', minHours: 4, maxHours: 24 },
  { hoursBefore: 4, field: 'reminder4hSentAt', minHours: 0, maxHours: 4 }
];

// Las fechas de las citas y startTime están en "hora de pared" de Santiago.
// Se comparan en ese mismo eje (ver utils/timezone.js): fullDateTime menos
// "ahora en Santiago" da las horas reales que faltan.
const hoursUntilStart = (appointment, nowSantiago) =>
  (appointment.fullDateTime - nowSantiago) / HOUR_MS;

// Cuántas horas antes de la sesión se agendó (para no mandar un "recordatorio
// de 24 h" a quien agendó hace una hora para dentro de 6).
const hoursBookedAhead = (appointment) =>
  (appointment.fullDateTime - nowInSantiago(new Date(appointment.createdAt))) / HOUR_MS;

export async function sendDueReminders(now = new Date()) {
  const nowSantiago = nowInSantiago(now);

  // Solo citas de los próximos días: evita recorrer todo el historial
  const from = new Date(now.getTime() - 24 * HOUR_MS);
  const to = new Date(now.getTime() + 3 * 24 * HOUR_MS);

  const appointments = await Appointment.find({
    status: 'scheduled',
    date: { $gte: from, $lte: to }
  })
    .populate('patient', 'firstName lastName email isActive')
    .populate('professional', 'firstName lastName');

  const summary = { sent24h: 0, sent4h: 0, failed: 0 };

  for (const appointment of appointments) {
    if (!appointment.patient?.email || appointment.patient.isActive === false) continue;

    const hoursLeft = hoursUntilStart(appointment, nowSantiago);

    for (const { hoursBefore, field, minHours, maxHours } of REMINDERS) {
      if (appointment[field]) continue;
      if (hoursLeft <= minHours || hoursLeft > maxHours) continue;
      if (hoursBookedAhead(appointment) <= hoursBefore) continue;

      // Se reclama el recordatorio de forma atómica ANTES de enviar: si dos
      // procesos corren a la vez, solo uno gana la actualización.
      const claimed = await Appointment.findOneAndUpdate(
        { _id: appointment._id, [field]: null, status: 'scheduled' },
        { $set: { [field]: now } }
      );
      if (!claimed) continue;

      const result = await sendAppointmentReminderEmail({
        patient: appointment.patient,
        professional: appointment.professional,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        type: appointment.type,
        hoursBefore
      });

      if (result?.ok) {
        summary[hoursBefore === 24 ? 'sent24h' : 'sent4h']++;
      } else {
        // Si el correo no salió, se libera la marca para reintentar en la próxima vuelta
        await Appointment.updateOne({ _id: appointment._id }, { $set: { [field]: null } });
        summary.failed++;
      }
    }
  }

  return summary;
}
