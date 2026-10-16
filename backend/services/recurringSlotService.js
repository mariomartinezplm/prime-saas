import { isBefore, addHours } from 'date-fns';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import RecurringSlot from '../models/RecurringSlot.js';
import User from '../models/User.js';
import { getActivePlanByType, deductSession, refundSession } from './clientPlanService.js';
import { checkSessionBalanceForBooking } from './bookingGuards.js';
import {
  MAX_PATIENTS_PER_SLOT,
  PATIENT_BOOK_AHEAD_HOURS,
  nowInSantiago,
  countOverlappingAppointments,
  isExemptFromCapacity
} from './bookingRulesService.js';
import { notify, notifyOnce } from './notificationService.js';
import { santiagoParts } from '../utils/timezone.js';

/**
 * HORARIO FIJO — «todos los lunes a las 18:00».
 *
 * El paciente (o su profesional) deja una regla semanal y el sistema agenda por él las citas que falten, dentro de los DÍAS DE SU
 * PLAN y no más allá. Al abrirse el ciclo del mes siguiente (o al registrarse el pago de una renovación) la pasada siguiente agenda
 * esas fechas; si el plan vence sin pagar, simplemente no hay plan al que agendar y no se agenda nada.
 *
 * Cada fecha pasa por las MISMAS reglas que una reserva del paciente: 4 horas de anticipación, que el profesional atienda a esa
 * hora, plan/sesiones/plazo de pago (bookingGuards.js), máximo de pacientes simultáneos y descuento atómico de la sesión.
 * La pasada es idempotente (se puede repetir sin duplicar nada): corre al crear el horario, al reanudarlo y cada 10 minutos desde
 * el programador.
 */

export const MAX_RECURRING_SLOTS = 3;

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const dayName = (dayOfWeek) => DAY_NAMES[dayOfWeek];

const SKIP_REASONS = {
  FULL: 'el horario estaba lleno',
  NOT_AVAILABLE: 'el profesional no atiende ese día',
  ALREADY_BOOKED: 'ya tenías otra cita ese día'
};

// ─── Funciones puras (sin base de datos) ────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' → día de la semana (0 = domingo). Se calcula en UTC sobre la fecha sola: no depende de la zona del servidor.
export const weekdayOf = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

// Fecha de calendario (Santiago) de un instante, como 'YYYY-MM-DD'
export const santiagoDateString = (instant) => {
  const p = santiagoParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

// Las fechas ('YYYY-MM-DD') de ese día de la semana desde `today` hasta el último día del plan, ambos incluidos.
export function occurrenceDates({ dayOfWeek, today, planEndDate }) {
  const last = santiagoDateString(planEndDate);
  const dates = [];
  let cursor = new Date(`${today}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  while (cursor <= end) {
    if (cursor.getUTCDay() === dayOfWeek) dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

// Último día hasta el que se agenda: el fin del plan, pero nunca más allá del último día del mes en curso. Un plan de kinesiología
// «hasta completar» no tiene fin real (guarda una fecha interna lejana): se agenda mes a mes, y al empezar el mes siguiente la
// pasada siguiente agenda el nuevo mes sin que nadie haga nada.
export function schedulingHorizon(planEndDate, today) {
  const [year, month] = today.split('-').map(Number);
  const lastOfMonth = new Date(Date.UTC(year, month, 0, 12));
  return new Date(planEndDate) < lastOfMonth ? new Date(planEndDate) : lastOfMonth;
}

// ¿El profesional atiende ese día a esa hora? Mismo criterio que availabilityController.getAvailableSlots:
// la hora debe estar en su horario semanal y la fecha no puede estar bloqueada (completa o esa hora).
export function isSlotOpen(availability, dateStr, startTime) {
  if (!availability) return false;
  const day = (availability.weeklySchedule || []).find((d) => d.dayOfWeek === weekdayOf(dateStr));
  if (!day || !(day.slots || []).some((s) => s.startTime === startTime)) return false;

  const blocked = (availability.blockedDates || []).find((b) => new Date(b.date).toISOString().slice(0, 10) === dateStr);
  if (blocked) {
    if (blocked.allDay) return false;
    if ((blocked.slots || []).some((s) => s.startTime === startTime)) return false;
  }
  return true;
}

// 'YYYY-MM-DD' → «lunes 5 de octubre»
export const formatDateEs = (dateStr) =>
  new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${dateStr}T00:00:00Z`))
    .replace(',', '');

const listDates = (dates) => dates.map(formatDateEs).join(', ');

// ─── Acceso a datos (reemplazable en las pruebas) ───────────────────────────

export const defaultDeps = {
  getActivePlanByType,
  checkBalance: checkSessionBalanceForBooking,
  deduct: deductSession,
  refund: refundSession,
  isExempt: isExemptFromCapacity,
  countOverlapping: countOverlappingAppointments,
  async listPatientAppointments(patientId, firstDate, lastDate) {
    const docs = await Appointment.find({
      patient: patientId,
      date: { $gte: new Date(firstDate), $lte: new Date(`${lastDate}T23:59:59.999Z`) }
    }).select('date startTime status').lean();
    return docs.map((d) => ({ date: new Date(d.date).toISOString().slice(0, 10), startTime: d.startTime, status: d.status }));
  },
  async getAvailability(professionalId) {
    return Availability.findOne({ professional: professionalId }).lean();
  },
  async createAppointment(data) {
    return Appointment.create(data);
  },
  async addSkipped(slotId, entries) {
    if (entries.length === 0) return;
    await RecurringSlot.updateOne(
      { _id: slotId },
      { $push: { skipped: { $each: entries } } }
    );
  },
  async markNotified(slotId, dates, at) {
    await RecurringSlot.updateOne(
      { _id: slotId },
      { $set: { 'skipped.$[s].notifiedAt': at } },
      { arrayFilters: [{ 's.date': { $in: dates }, 's.notifiedAt': null }] }
    );
  },
  notify,
  notifyOnce
};

// Una pasada a la vez por horario dentro de este proceso (la pasada del programador y una petición no se pisan)
const running = new Set();

/**
 * Agenda las citas que le faltan a UN horario fijo. Nunca lanza por una fecha que no se pueda agendar: esa fecha se salta y se
 * informa. Devuelve { created, skipped, pendingPayment, noSessions, noPlan, busy }.
 *
 * @param slot     documento RecurringSlot (con patient/professional/type/dayOfWeek/startTime/skipped)
 * @param options  { now, silent (no avisar: la persona está mirando la pantalla), deps }
 */
export async function syncSlot(slot, { now = new Date(), silent = false, deps = defaultDeps } = {}) {
  const result = { created: [], skipped: [], pendingPayment: 0, noSessions: false, noPlan: false, busy: false };
  if (!slot.active) return result;

  const key = String(slot._id);
  if (running.has(key)) return { ...result, busy: true };
  running.add(key);

  try {
    const plan = await deps.getActivePlanByType(slot.patient, slot.type);
    if (!plan) return { ...result, noPlan: true };

    const today = santiagoDateString(now);
    const dates = occurrenceDates({ dayOfWeek: slot.dayOfWeek, today, planEndDate: schedulingHorizon(plan.endDate, today) });
    if (dates.length === 0) return result;

    const alreadyResolved = new Set((slot.skipped || []).map((s) => s.date));
    const existing = await deps.listPatientAppointments(slot.patient, dates[0], dates[dates.length - 1]);
    const availability = await deps.getAvailability(slot.professional);
    const exempt = await deps.isExempt(slot.patient);
    const minStart = addHours(nowInSantiago(now), PATIENT_BOOK_AHEAD_HOURS);
    const newSkips = [];

    for (const date of dates) {
      if (alreadyResolved.has(date)) continue;

      const sameDay = existing.filter((e) => e.date === date);
      // Esa hora ya tiene una cita (también si la persona la canceló a propósito): no se vuelve a agendar
      if (sameDay.some((e) => e.startTime === slot.startTime)) continue;
      // Otra cita vigente ese día: no se agenda una segunda (evita gastar dos sesiones en un día por accidente)
      if (sameDay.some((e) => e.status !== 'cancelled')) {
        newSkips.push({ date, code: 'ALREADY_BOOKED', notifiedAt: now });
        continue;
      }

      // Mismo criterio de anticipación que una reserva normal; si ya no alcanza, la fecha simplemente no se agenda
      if (isBefore(new Date(`${date}T${slot.startTime}`), minStart)) continue;

      if (!isSlotOpen(availability, date, slot.startTime)) {
        newSkips.push({ date, code: 'NOT_AVAILABLE', notifiedAt: null });
        continue;
      }

      const guard = await deps.checkBalance(slot.patient, slot.type, { date, startTime: slot.startTime });
      if (guard) {
        const code = guard.body?.code;
        if (code === 'PAYMENT_PENDING') {
          // Renovación sin pagar: esa fecha queda para cuando se registre el pago (no se marca como saltada)
          result.pendingPayment++;
          continue;
        }
        // Sin sesiones: no tiene sentido seguir con las fechas siguientes
        result.noSessions = true;
        break;
      }

      const taken = exempt ? 0 : await deps.countOverlapping(slot.professional, date, slot.startTime);
      if (taken >= MAX_PATIENTS_PER_SLOT) {
        newSkips.push({ date, code: 'FULL', notifiedAt: null });
        continue;
      }

      const deduction = await deps.deduct(slot.patient, slot.type, null);
      if (!deduction) {
        result.noSessions = true;
        break;
      }

      const [hours, minutes] = slot.startTime.split(':').map(Number);
      try {
        await deps.createAppointment({
          patient: slot.patient,
          professional: slot.professional,
          date: new Date(date),
          startTime: slot.startTime,
          endTime: `${pad(hours + 1)}:${pad(minutes)}`,
          type: slot.type,
          sessionDeducted: true,
          deduction,
          overbooked: false,
          outsideCapacity: exempt,
          recurringSlot: slot._id
        });
        result.created.push(date);
      } catch (error) {
        // La sesión ya se había descontado: se devuelve para no dejar un descuento sin cita
        await deps.refund({ deduction });
        console.error('Horario fijo: no se pudo crear una cita:', error.message);
      }
    }

    await deps.addSkipped(slot._id, newSkips);
    result.skipped = newSkips.map((s) => ({ date: s.date, code: s.code }));

    if (!silent) await announce({ slot, plan, result, newSkips, now, deps });
    return result;
  } finally {
    running.delete(key);
  }
}

// Avisos a la persona (campanita; el de «no pudimos agendar» también por correo)
async function announce({ slot, plan, result, newSkips, now, deps }) {
  const label = `los ${dayName(slot.dayOfWeek)} a las ${slot.startTime}`;

  if (result.created.length > 0) {
    const n = result.created.length;
    await deps.notify(slot.patient, 'recurring_booked', {
      title: 'Agendamos tu horario fijo',
      body: `Agendamos ${n} ${n === 1 ? 'sesión' : 'sesiones'} de tu horario fijo (${label}): ${listDates(result.created)}.`,
      link: '/app/mis-citas'
    });
  }

  const toTell = newSkips.filter((s) => (s.code === 'FULL' || s.code === 'NOT_AVAILABLE') && !s.notifiedAt);
  if (toTell.length > 0) {
    const lines = toTell.map((s) => `${formatDateEs(s.date)} (${SKIP_REASONS[s.code]})`).join('; ');
    await deps.notify(slot.patient, 'recurring_skipped', {
      title: 'No pudimos agendar algunas fechas de tu horario fijo',
      body: `De tu horario fijo (${label}) no pudimos agendar: ${lines}. Puedes elegir otra hora desde Reservar hora.`,
      link: '/app/reservar'
    });
    await deps.markNotified(slot._id, toTell.map((s) => s.date), now);
  }

  if (result.noSessions) {
    await deps.notifyOnce(slot.patient, 'recurring_skipped', {
      title: 'Se acabaron las sesiones de tu plan',
      body: `Tu horario fijo (${label}) no pudo agendar más citas porque ya no te quedan sesiones. Contacta a Prime F&H para renovar.`,
      link: '/app/mi-perfil',
      dedupeKey: `recurring-nosessions:${slot._id}:${plan._id}`
    });
  }
}

// Pasada de todos los horarios activos (la usa el programador cada 10 minutos). Un error en un horario no detiene a los demás.
export async function syncAllRecurringSlots({ now = new Date(), deps = defaultDeps } = {}) {
  const summary = { slots: 0, created: 0, skipped: 0, failed: 0 };
  const slots = await RecurringSlot.find({ active: true });
  const activePatients = new Set(
    (await User.find({ _id: { $in: slots.map((s) => s.patient) }, isActive: true, role: 'patient' }).select('_id')).map((u) => String(u._id))
  );

  for (const slot of slots) {
    if (!activePatients.has(String(slot.patient))) continue;
    summary.slots++;
    try {
      const result = await syncSlot(slot, { now, deps });
      summary.created += result.created.length;
      summary.skipped += result.skipped.length;
    } catch (error) {
      summary.failed++;
      console.error('Horario fijo: error en una pasada:', error.message);
    }
  }
  return summary;
}
