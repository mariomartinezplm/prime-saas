import mongoose from 'mongoose';
import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { notify } from './notificationService.js';
import { formatDayMonthSantiago } from '../utils/timezone.js';
import { buildCycles, paymentDueBy, TERM_CYCLES } from './planCycles.js';

// Vida de un plan (Prime F&H):
//   pago registrado ──► ciclo activo ──► (ciclos siguientes ya pagados, si es trimestral/anual)
//   último ciclo termina ──► se abre solo un ciclo nuevo "pendiente de pago"
//   el admin registra el pago ──► el ciclo queda pagado
//   no se paga en 5 días ──► vence (solo lectura y sin agendar) hasta que el admin lo reactive
//
// advancePlans() mueve los planes al estado correcto "a la hora de ahora". Se
// llama antes de leer el plan de un paciente (así nada depende de que un
// proceso haya corrido a medianoche) y desde el programador para todos.

const DAY_MS = 24 * 60 * 60 * 1000;
const FOUNDER_STATUSES = ['active', 'upcoming'];
const MAX_STEPS = 20;
const NOTICE_HORIZON_DAYS = 5;
const EXPIRED_NOTICE_LOOKBACK_DAYS = 60;

// ─── Miembro Fundador (plan anual) ──────────────────────────────────────────
// La insignia sigue al plan: se enciende con un plan anual vigente (o pagado por
// adelantado) y se apaga cuando el paciente deja de tenerlo.

export async function syncFounderFlag(patientId) {
  const hasAnnual = !!(await ClientPlan.exists({
    patient: patientId,
    term: 'anual',
    status: { $in: FOUNDER_STATUSES }
  }));
  await User.updateOne({ _id: patientId, isFounder: { $ne: hasAnnual } }, { $set: { isFounder: hasAnnual } });
}

export async function syncAllFounderFlags() {
  const founders = await ClientPlan.distinct('patient', { term: 'anual', status: { $in: FOUNDER_STATUSES } });
  await User.updateMany({ _id: { $in: founders }, isFounder: { $ne: true } }, { $set: { isFounder: true } });
  await User.updateMany({ role: 'patient', isFounder: true, _id: { $nin: founders } }, { $set: { isFounder: false } });
}

// ─── Crear un plan (todos sus ciclos) ───────────────────────────────────────

export async function createTermPlans({
  patientId,
  serviceType,
  sessionsTotal,
  unlimited = false,
  term = 'mensual',
  billingCycle = 'calendar',
  startDate = new Date(),
  renews = true,
  registeredBy,
  notes
}) {
  const cyclesTotal = TERM_CYCLES[term];
  const termId = new mongoose.Types.ObjectId();
  const cycles = buildCycles(startDate, billingCycle, cyclesTotal);

  const created = [];
  for (const cycle of cycles) {
    created.push(await ClientPlan.create({
      patient: patientId,
      serviceType,
      sessionsTotal: unlimited ? 0 : sessionsTotal,
      unlimited,
      startDate: cycle.start,
      term,
      billingCycle,
      cycleNumber: cycle.cycleNumber,
      cyclesTotal,
      termId,
      renews,
      registeredBy,
      notes,
      status: cycle.cycleNumber === 1 ? 'active' : 'upcoming'
    }));
  }
  await syncFounderFlag(patientId);
  return created[0];
}

// El admin registra el pago de una renovación que estaba pendiente: el ciclo
// queda pagado CONSERVANDO las sesiones ya usadas (así quien agendó en los
// días de plazo no recibe un cupo nuevo por pagar), y si pagó un plan de
// varios meses se crean los ciclos que faltan.
export async function settlePendingPlan(plan, { sessionsTotal, unlimited = false, term = 'mensual', renews = true, registeredBy, notes }) {
  const cyclesTotal = TERM_CYCLES[term];
  const termId = new mongoose.Types.ObjectId();

  plan.sessionsTotal = unlimited ? 0 : sessionsTotal;
  plan.unlimited = unlimited;
  plan.term = term;
  plan.cyclesTotal = cyclesTotal;
  plan.cycleNumber = 1;
  plan.termId = termId;
  plan.renews = renews;
  plan.paymentPending = false;
  plan.paymentDueBy = undefined;
  plan.registeredBy = registeredBy;
  if (notes) plan.notes = notes;
  await plan.save();

  const cycles = buildCycles(plan.startDate, plan.billingCycle, cyclesTotal);
  for (const cycle of cycles.slice(1)) {
    await ClientPlan.create({
      patient: plan.patient,
      serviceType: plan.serviceType,
      sessionsTotal: plan.sessionsTotal,
      unlimited: plan.unlimited,
      startDate: cycle.start,
      term,
      billingCycle: plan.billingCycle,
      cycleNumber: cycle.cycleNumber,
      cyclesTotal,
      termId,
      renews,
      registeredBy,
      notes,
      status: 'upcoming'
    });
  }
  await syncFounderFlag(plan.patient);
  return plan;
}

// Cancela un plan y los ciclos futuros ya pagados de ese mismo pago
export async function cancelPlanAndFutureCycles(plan) {
  plan.status = 'cancelled';
  await plan.save();
  if (plan.termId) {
    await ClientPlan.updateMany({ termId: plan.termId, status: 'upcoming' }, { $set: { status: 'cancelled' } });
  }
  await syncFounderFlag(plan.patient);
}

// ─── Mover los planes al estado de "ahora" ──────────────────────────────────

async function openPendingRenewal(plan, now) {
  const start = new Date(plan.endDate.getTime() + 1);
  const due = paymentDueBy(start);

  // Si el plazo de pago del ciclo siguiente ya pasó, no tiene sentido abrirlo
  if (now.getTime() >= due.getTime()) return false;

  try {
    await ClientPlan.create({
      patient: plan.patient,
      serviceType: plan.serviceType,
      sessionsTotal: plan.sessionsTotal,
      unlimited: plan.unlimited,
      startDate: start,
      term: plan.term,
      billingCycle: plan.billingCycle,
      cycleNumber: 1,
      cyclesTotal: TERM_CYCLES[plan.term],
      renews: true,
      paymentPending: true,
      paymentDueBy: due,
      renewedFrom: plan._id,
      registeredBy: plan.registeredBy,
      status: 'active'
    });
  } catch (error) {
    // Otro proceso ya la abrió (índice único en renewedFrom): perfecto, es lo mismo
    if (error.code !== 11000) throw error;
  }
  return true;
}

export async function advancePlans({ patientId, now = new Date() } = {}) {
  const scope = patientId ? { patient: patientId } : {};
  let anyChange = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    let changed = false;

    // 1) Renovaciones pendientes que no se pagaron a tiempo: vencen
    const unpaid = await ClientPlan.updateMany(
      { ...scope, status: 'active', paymentPending: true, paymentDueBy: { $lt: now } },
      { $set: { status: 'expired' } }
    );
    if (unpaid.modifiedCount) changed = true;

    // 2) Ciclos activos que ya terminaron
    const ended = await ClientPlan.find({
      ...scope,
      status: 'active',
      paymentPending: false,
      endDate: { $lt: now }
    });

    for (const plan of ended) {
      const next = plan.termId
        ? await ClientPlan.findOne({ termId: plan.termId, status: 'upcoming', cycleNumber: plan.cycleNumber + 1 })
        : null;

      if (next) {
        // Ciclo ya pagado: el siguiente arranca (con sus sesiones en cero) y el anterior cierra en silencio
        const activated = await ClientPlan.findOneAndUpdate({ _id: next._id, status: 'upcoming' }, { $set: { status: 'active' } });
        if (activated) {
          await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired', expiredNotifiedAt: now } });
          changed = true;
        }
        continue;
      }

      if (plan.renews && (await openPendingRenewal(plan, now))) {
        // El aviso al paciente lo da la renovación pendiente, no un "venció"
        await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired', expiredNotifiedAt: now } });
      } else {
        await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired' } });
      }
      changed = true;
    }

    if (!changed) break;
    anyChange = true;
  }

  // Una renovación que venció sin pago puede apagar la insignia de Fundador
  if (anyChange && patientId) await syncFounderFlag(patientId);
}

// ─── Avisos (campanita + correo) ────────────────────────────────────────────

const dayBeforeEnd = (date) => formatDayMonthSantiago(new Date(date.getTime() - 1));

export function buildExpiringMessage(plan, now) {
  const msLeft = plan.endDate.getTime() - now.getTime();
  const isLastDay = msLeft <= DAY_MS;
  const endsOn = formatDayMonthSantiago(plan.endDate);

  const paymentLine = plan.renews
    ? ` Para seguir sin interrupciones tienes plazo hasta el ${dayBeforeEnd(paymentDueBy(new Date(plan.endDate.getTime() + 1)))} para pagar tu renovación; puedes seguir agendando hasta esa fecha.`
    : '';

  return {
    title: isLastDay ? 'Tu plan vence mañana' : 'Tu plan está por vencer',
    body: `Tu plan vence el ${endsOn}.${paymentLine} Contacta a Prime F&H para renovar.`
  };
}

export async function runPlanLifecycleJob(now = new Date()) {
  await advancePlans({ now });
  await syncAllFounderFlags();

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  const adminIds = admins.map((a) => a._id);
  const summary = { expiringNotices: 0, renewalNotices: 0, expiredNotices: 0 };

  // 1) Último ciclo de un plan que vence en 5 días (o en 1): aviso con el plazo de pago
  const horizon = new Date(now.getTime() + NOTICE_HORIZON_DAYS * DAY_MS);
  const expiring = await ClientPlan.find({
    status: 'active',
    paymentPending: false,
    endDate: { $gte: now, $lte: horizon },
    $expr: { $gte: ['$cycleNumber', '$cyclesTotal'] },
    $or: [{ expiringNotifiedAt: null }, { expiringTomorrowNotifiedAt: null }]
  });

  for (const plan of expiring) {
    const isLastDay = plan.endDate.getTime() - now.getTime() <= DAY_MS;
    if (isLastDay ? plan.expiringTomorrowNotifiedAt : plan.expiringNotifiedAt) continue;

    const { title, body } = buildExpiringMessage(plan, now);
    await notify(plan.patient, 'plan_expiring', { title, body, link: '/app/mi-perfil' });

    plan.expiringNotifiedAt = plan.expiringNotifiedAt || now;
    if (isLastDay) plan.expiringTomorrowNotifiedAt = now;
    await plan.save();
    summary.expiringNotices++;
  }

  // 2) Renovaciones pendientes recién abiertas: se le avisa al paciente
  const pendingOpened = await ClientPlan.find({ status: 'active', paymentPending: true, renewalNotifiedAt: null });
  for (const plan of pendingOpened) {
    await notify(plan.patient, 'plan_expiring', {
      title: 'Renovación pendiente de pago',
      body: `Empezó un nuevo ciclo de tu plan. Tienes hasta el ${dayBeforeEnd(plan.paymentDueBy)} para pagar y puedes seguir agendando hasta esa fecha. Contacta a Prime F&H para pagar.`,
      link: '/app/mi-perfil'
    });
    plan.renewalNotifiedAt = now;
    await plan.save();
    summary.renewalNotices++;
  }

  // 3) Planes vencidos sin pagar: aviso al paciente y a los administradores
  const since = new Date(now.getTime() - EXPIRED_NOTICE_LOOKBACK_DAYS * DAY_MS);
  const expired = await ClientPlan.find({
    status: 'expired',
    expiredNotifiedAt: null,
    endDate: { $gte: since }
  }).populate('patient', 'firstName lastName');

  for (const plan of expired) {
    if (!plan.patient) continue;
    const patientName = `${plan.patient.firstName} ${plan.patient.lastName}`;

    await notify(plan.patient._id, 'plan_expired', {
      title: 'Tu plan venció',
      body: 'Tu plan venció. Contacta a Prime F&H para renovar y seguir agendando.',
      link: '/app/mi-perfil'
    });
    for (const adminId of adminIds) {
      await notify(adminId, 'plan_expired', {
        title: 'Plan de paciente vencido',
        body: `El plan de ${patientName} venció.`,
        link: '/app/admin/planes'
      });
    }

    plan.expiredNotifiedAt = now;
    await plan.save();
    summary.expiredNotices++;
  }

  return summary;
}
