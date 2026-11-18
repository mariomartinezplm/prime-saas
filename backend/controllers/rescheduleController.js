import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import User from '../models/User.js';
import { canAccessAppointment } from '../middleware/auth.js';
import { deductSession, refundSession, bookingInstant } from '../services/clientPlanService.js';
import { DEDUCTIBLE_TYPES, planServiceOf, checkSessionBalanceForBooking, checkTypeBookableByPatient } from '../services/bookingGuards.js';
import {
  MAX_PATIENTS_PER_SLOT,
  PATIENT_BOOK_AHEAD_HOURS,
  PATIENT_CANCEL_AHEAD_HOURS,
  countOverlappingAppointments,
  hasIdenticalAppointment,
  isExemptFromCapacity
} from '../services/bookingRulesService.js';
import { isSlotClosed, SLOT_CLOSED_PATIENT_MESSAGE } from '../services/slotClosureService.js';
import { isSlotOpen } from '../services/recurringSlotService.js';
import { sendAppointmentUpdatedEmail, sendAppointmentConfirmationToPatientEmail } from '../services/emailService.js';
import { generateAppointmentICS } from '../services/icsService.js';
import { notify } from '../services/notificationService.js';
import { appointmentForViewer } from '../services/patientViews.js';
import { formatDayMonthSantiago } from '../utils/timezone.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;
const HOUR_MS = 3600 * 1000;
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const dayOf = (date) => new Date(date).toISOString().slice(0, 10);
const reject = (res, status, code, message) => res.status(status).json({ success: false, code, message });

/**
 * «Cambiar hora»: el paciente mueve una cita suya a otra hora, A TIEMPO (con al menos las mismas horas de anticipación que se exigen
 * para cancelar sin perder la sesión). Es una sola operación: la cita nueva se crea con las mismas reglas de una reserva y la de
 * origen queda cancelada (con su sesión devuelta). Si algo falla, la cita original queda tal cual estaba.
 *
 * @route   PUT /api/appointments/:id/reschedule   { date: 'YYYY-MM-DD', startTime: 'HH:MM' }
 * @access  Private/Patient (el equipo cambia horas desde el calendario)
 */
export const rescheduleAppointment = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return reject(res, 403, 'PATIENT_ONLY', 'Esta opción es para pacientes. El equipo cambia las horas desde el calendario.');
    }
    const { date, startTime } = req.body ?? {};
    if (typeof date !== 'string' || !DATE_RE.test(date) || typeof startTime !== 'string' || !TIME_RE.test(startTime)) {
      return reject(res, 400, 'INVALID_SLOT', 'Elige un día y un horario válidos.');
    }

    const old = await Appointment.findById(req.params.id);
    if (!old || !(await canAccessAppointment(req.user, old))) return reject(res, 404, 'NOT_FOUND', 'Cita no encontrada');
    if (old.status !== 'scheduled') return reject(res, 409, 'NOT_SCHEDULED', 'Solo se puede cambiar una cita agendada.');
    const typeCheck = checkTypeBookableByPatient(old.type);
    if (typeCheck) return res.status(typeCheck.status).json(typeCheck.body);

    // A tiempo: la regla es la misma de cancelar sin perder la sesión
    const now = Date.now();
    const oldStart = bookingInstant(old.date, old.startTime);
    if (oldStart.getTime() - now < PATIENT_CANCEL_AHEAD_HOURS * HOUR_MS) {
      return reject(res, 409, 'CHANGE_TOO_LATE', `Ya pasó el plazo para cambiar esta hora (hasta ${PATIENT_CANCEL_AHEAD_HOURS} horas antes). Si no puedes asistir, cancélala.`);
    }

    // La hora nueva debe cumplir lo mismo que una reserva
    const newStart = bookingInstant(date, startTime);
    if (newStart.getTime() - now < PATIENT_BOOK_AHEAD_HOURS * HOUR_MS) {
      return reject(res, 400, 'BOOKING_WINDOW', `La nueva hora debe ser con al menos ${PATIENT_BOOK_AHEAD_HOURS} horas de anticipación.`);
    }
    if (dayOf(old.date) === date && old.startTime === startTime) return reject(res, 400, 'SAME_SLOT', 'Elige un horario distinto al actual.');

    const professionalId = old.professional;
    const availability = await Availability.findOne({ professional: professionalId });
    if (!availability || !isSlotOpen(availability, date, startTime)) {
      return reject(res, 409, 'NOT_AVAILABLE', 'Ese horario no está disponible. Elige otro.');
    }
    if (await isSlotClosed(professionalId, date, startTime)) return reject(res, 409, 'SLOT_CLOSED', SLOT_CLOSED_PATIENT_MESSAGE);
    if (await hasIdenticalAppointment(old.patient, professionalId, date, startTime)) {
      return reject(res, 409, 'DUPLICATE_APPOINTMENT', 'Ya tienes una cita agendada en ese día y horario.');
    }

    // Cupo: la cita que se mueve no cuenta contra sí misma si se solapa con la hora nueva
    const exempt = await isExemptFromCapacity(old.patient);
    if (!exempt) {
      let inSlot = await countOverlappingAppointments(professionalId, date, startTime);
      const overlapsSelf = dayOf(old.date) === date && Math.abs(toMin(old.startTime) - toMin(startTime)) < 60 && !old.outsideCapacity;
      if (overlapsSelf) inSlot -= 1;
      if (inSlot >= MAX_PATIENTS_PER_SLOT) return reject(res, 409, 'SLOT_FULL', `El horario ${startTime} ya tiene ${MAX_PATIENTS_PER_SLOT} pacientes. Elige otro horario.`);
    }

    // ── Sesión: se devuelve la de la cita de origen y se descuenta la de la nueva fecha (puede ser el mismo plan: queda igual) ──
    const deductible = DEDUCTIBLE_TYPES.includes(old.type);
    const service = planServiceOf(old.type);
    const hadDeduction = deductible && old.sessionDeducted;
    const restoreOld = async () => {
      if (hadDeduction) await deductSession(old.patient, service, null, { date: dayOf(old.date), startTime: old.startTime });
    };

    let deduction = null;
    if (hadDeduction) await refundSession(old);
    if (deductible) {
      const guard = await checkSessionBalanceForBooking(old.patient, old.type, { date, startTime });
      if (guard) {
        await restoreOld();
        return res.status(guard.status).json(guard.body);
      }
      deduction = await deductSession(old.patient, service, null, { date, startTime });
      if (!deduction && hadDeduction) {
        await restoreOld();
        return reject(res, 409, 'SESSION_CONFLICT', 'No hay una sesión disponible para esa fecha. Tu cita original se mantiene.');
      }
    }

    // ── Cita nueva ──
    const [h, m] = startTime.split(':').map(Number);
    const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    let created;
    try {
      created = await Appointment.create({
        patient: old.patient,
        professional: professionalId,
        date: new Date(date),
        startTime,
        endTime,
        type: old.type,
        notes: old.notes,
        sessionDeducted: !!deduction,
        deduction: deduction || undefined,
        overbooked: false,
        outsideCapacity: exempt,
        rescheduledFrom: old._id
      });
    } catch (createError) {
      if (deduction) await refundSession({ deduction });
      await restoreOld();
      throw createError;
    }

    // ── Cita de origen: cancelada, con la sesión ya devuelta, apuntando a la nueva ──
    try {
      old.status = 'cancelled';
      old.cancellationReason = 'Cambio de hora';
      old.cancelledBy = req.user._id;
      old.cancelledAt = new Date();
      if (hadDeduction) old.sessionDeducted = false;
      old.rescheduledTo = created._id;
      await old.save();
    } catch (saveError) {
      // No se pudo cerrar la de origen: se deshace todo y queda la cita original
      await Appointment.deleteOne({ _id: created._id });
      if (deduction) await refundSession({ deduction });
      await restoreOld();
      throw saveError;
    }

    // ── Avisos (nunca afectan el cambio) ──
    const [patient, professional] = await Promise.all([User.findById(old.patient).select('firstName lastName email'), User.findById(professionalId).select('firstName lastName email')]);
    if (patient && professional) {
      const view = { patient, professional, date: created.date, startTime: created.startTime, endTime: created.endTime, type: created.type };
      sendAppointmentUpdatedEmail({ ...view, changes: `Cambió su hora: antes ${formatDayMonthSantiago(old.date)} a las ${old.startTime}` });
      let icsContent;
      try {
        icsContent = generateAppointmentICS({ ...created.toObject(), patient, professional });
      } catch (icsError) {
        console.error('No se pudo generar el .ics del cambio de hora:', icsError.message);
      }
      sendAppointmentConfirmationToPatientEmail({ ...view, icsContent, appointmentId: created._id });
      notify(professional._id, 'appointment_booked', {
        title: 'Cambio de hora',
        body: `${patient.firstName} ${patient.lastName} cambió su cita del ${dayOf(old.date)} ${old.startTime} al ${date} a las ${startTime}.`,
        link: '/app/admin/citas'
      }).catch((error) => console.error('Error al notificar el cambio de hora:', error.message));
    }

    res.status(200).json({
      success: true,
      message: 'Cambiaste tu hora. La anterior quedó liberada.',
      data: { appointment: appointmentForViewer(req.user, created), previousId: String(old._id) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo cambiar la hora. Tu cita original sigue como estaba.' });
  }
};
