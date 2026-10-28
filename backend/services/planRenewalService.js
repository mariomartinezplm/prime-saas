import ClientPlan from '../models/ClientPlan.js';
import Appointment from '../models/Appointment.js';
import RecurringSlot from '../models/RecurringSlot.js';
import { advancePlans, createTermPlans, createEarlyRenewal, settlePendingPlan, RenewalError } from './planLifecycleService.js';
import { syncSlot } from './recurringSlotService.js';
import { buildCycles, TERM_CYCLES } from './planCycles.js';
import { formatDayMonthSantiago } from '../utils/timezone.js';

/**
 * «Renovar plan» con un toque (administración y profesionales, para sus pacientes).
 *
 * Renueva EXACTAMENTE el plan que la persona ya tiene (mismo servicio, sesiones, plazo, ciclo, pago mes a mes y beca) y no toca nada más:
 * las citas ya agendadas quedan como están y el horario fijo sigue vigente (al terminar, se agendan al tiro las fechas del ciclo nuevo).
 *
 * Según el estado del plan hace una de cuatro cosas:
 *   settle_pending  hay una renovación «pendiente de pago»: se da por pagada (conserva las sesiones ya usadas en los días de plazo)
 *   early           el plan vigente está en su último ciclo y todavía no hay renovación: el plazo siguiente queda pagado y parte justo
 *                   cuando este termina
 *   reactivate      el plan venció: vuelve a partir hoy, con las mismas condiciones
 *   kine_new        kinesiología «hasta completar» sin sesiones por usar: un paquete nuevo igual
 * Si no hay nada que renovar (ya está pagado, o aún le quedan sesiones de kinesiología) lo dice con el motivo.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// La renovación por adelantado se ofrece solo en los últimos días del plazo: así un segundo toque, justo después de renovar, no deja
// pagado otro mes sin querer.
export const EARLY_RENEWAL_DAYS = 10;

const idOf = (value) => String(value?._id ?? value);

// Condiciones del plan que se renueva. Una renovación pendiente o vencida no trae el pago mes a mes ni la beca: se heredan del ciclo del que nació.
async function inheritedTerms(plan) {
  let source = plan;
  if (plan.paymentPending && plan.renewedFrom) {
    const previous = await ClientPlan.findOne({ _id: plan.renewedFrom });
    if (previous) source = previous;
  }
  return { paymentMode: source.paymentMode ?? 'prepaid', scholarship: source.scholarship === true };
}

// Qué pasaría al tocar «Renovar plan» para este paciente (sin cambiar nada)
export async function planRenewalStatus(patientId, { now = new Date() } = {}) {
  await advancePlans({ patientId, now });
  const plans = await ClientPlan.find({ patient: patientId, status: { $ne: 'cancelled' } }).sort({ endDate: -1, startDate: -1 }).limit(60);
  if (plans.length === 0) {
    return { kind: 'none', reason: 'NO_PLAN', message: 'Este paciente todavía no tiene un plan: usa «Asignar plan».' };
  }

  const active = plans.find((p) => p.status === 'active' && p.endDate.getTime() >= now.getTime());
  const paidAhead = plans.filter((p) => p.status === 'upcoming');

  if (active?.paymentPending) return { kind: 'settle_pending', plan: active };

  if (active) {
    if (active.openEnded) {
      const left = active.sessionsAvailable();
      if (left > 0) return { kind: 'none', reason: 'SESSIONS_LEFT', message: `Aún le quedan ${left} sesión(es) de kinesiología: se renueva cuando se terminen.` };
      return { kind: 'kine_new', plan: active };
    }
    if (paidAhead.length > 0) {
      const last = paidAhead.reduce((a, b) => (a.endDate > b.endDate ? a : b));
      return { kind: 'none', reason: 'PAID_AHEAD', message: `El plan ya está pagado hasta el ${formatDayMonthSantiago(last.endDate)}.`, paidUntil: last.endDate };
    }
    if (active.cycleNumber < active.cyclesTotal) {
      return { kind: 'none', reason: 'PAID_AHEAD', message: 'El plan todavía tiene ciclos pagados por delante.', paidUntil: active.endDate };
    }
    const daysLeft = (active.endDate.getTime() - now.getTime()) / DAY_MS;
    if (daysLeft > EARLY_RENEWAL_DAYS) {
      return { kind: 'none', reason: 'TOO_EARLY', message: `El plan está pagado hasta el ${formatDayMonthSantiago(active.endDate)}. Se puede renovar en los últimos ${EARLY_RENEWAL_DAYS} días.`, paidUntil: active.endDate };
    }
    return { kind: 'early', plan: active };
  }

  if (paidAhead.length > 0) {
    const last = paidAhead.reduce((a, b) => (a.endDate > b.endDate ? a : b));
    return { kind: 'none', reason: 'PAID_AHEAD', message: 'Ya tiene un plan pagado que todavía no parte.', paidUntil: last.endDate };
  }

  const last = plans[0];
  if (last.openEnded) return { kind: 'kine_new', plan: last };
  return { kind: 'reactivate', plan: last };
}

const cyclesOf = (plan) => TERM_CYCLES[plan.term] ?? 1;

// Descripción simple de lo que se va a renovar, con las fechas del primer ciclo y del plazo completo
export async function describeRenewal(patientId, { now = new Date() } = {}) {
  const status = await planRenewalStatus(patientId, { now });
  if (status.kind === 'none') return status;
  const { plan, kind } = status;

  let start;
  if (kind === 'settle_pending') start = plan.startDate;
  else if (kind === 'early') start = new Date(plan.endDate.getTime() + 1);
  else start = now;

  const cycles = plan.openEnded || kind === 'kine_new' ? null : buildCycles(start, plan.billingCycle, cyclesOf(plan));
  const keep = {
    futureAppointments: await Appointment.countDocuments({ patient: patientId, status: 'scheduled', date: { $gte: new Date(now.getTime() - DAY_MS) } }),
    fixedSlots: await RecurringSlot.countDocuments({ patient: patientId, active: true })
  };

  return {
    kind,
    plan: {
      serviceType: plan.serviceType,
      sessionsTotal: plan.sessionsTotal,
      unlimited: plan.unlimited === true,
      term: kind === 'kine_new' ? 'mensual' : plan.term,
      billingCycle: plan.billingCycle,
      cyclesTotal: cycles ? cycles.length : 1,
      openEnded: kind === 'kine_new',
      scholarship: (await inheritedTerms(plan)).scholarship
    },
    starts: start,
    firstCycleEnds: cycles ? cycles[0].end : null,
    endsOn: cycles ? cycles[cycles.length - 1].end : null,
    keep
  };
}

// Renueva el plan del paciente. `actor` es quien lo hace (administración o profesional).
export async function renewPatientPlan(patientId, actor, { now = new Date() } = {}) {
  const status = await planRenewalStatus(patientId, { now });
  if (status.kind === 'none') throw new RenewalError(409, status.reason, status.message);
  const { plan, kind } = status;
  const terms = await inheritedTerms(plan);

  // Mismas reglas que al registrar un pago a mano: el plan anual, el pago mes a mes y la beca los deja solo administración
  if (actor.role !== 'admin') {
    if (plan.term === 'anual' && plan.serviceType !== 'kinesiologia') throw new RenewalError(403, 'ADMIN_ONLY', 'Solo el administrador puede renovar un plan anual');
    if (terms.paymentMode === 'monthly' || terms.scholarship) throw new RenewalError(403, 'ADMIN_ONLY', 'Solo el administrador puede renovar un plan con pago mes a mes o con beca');
  }

  const shared = { registeredBy: actor._id, notes: 'Renovado con un toque desde la ficha del paciente' };
  let renewed;

  if (kind === 'settle_pending') {
    renewed = await settlePendingPlan(plan, { sessionsTotal: plan.sessionsTotal, unlimited: plan.unlimited, term: plan.term, renews: true, ...terms, graceDays: plan.graceDays, ...shared });
  } else if (kind === 'early') {
    renewed = await createEarlyRenewal(plan, { ...terms, graceDays: plan.graceDays, ...shared });
  } else {
    // Plan vencido o kinesiología terminada: el nuevo parte hoy con las mismas condiciones (el anterior, si seguía abierto, se cierra)
    if (plan.status === 'active') {
      plan.status = 'expired';
      await plan.save();
    }
    renewed = await createTermPlans({
      patientId,
      serviceType: plan.serviceType,
      sessionsTotal: plan.sessionsTotal,
      unlimited: plan.unlimited === true,
      term: kind === 'kine_new' ? 'mensual' : plan.term,
      billingCycle: plan.billingCycle ?? 'calendar',
      startDate: now,
      renews: kind !== 'kine_new',
      ...terms,
      graceDays: plan.graceDays,
      ...shared
    });
  }

  // El horario fijo sigue vigente: se agendan ya las fechas que el ciclo nuevo permite (la pasada es idempotente: nunca duplica)
  const fixed = { slots: 0, created: 0, skipped: 0 };
  const slots = await RecurringSlot.find({ patient: patientId, active: true });
  for (const slot of slots) {
    fixed.slots += 1;
    try {
      const result = await syncSlot(slot, { now });
      fixed.created += result.created.length;
      fixed.skipped += result.skipped.length;
    } catch (error) {
      console.error('Renovación: error al ajustar un horario fijo:', error.message);
    }
  }

  return { kind, plan: renewed, fixed, patient: idOf(patientId) };
}

export { RenewalError };
