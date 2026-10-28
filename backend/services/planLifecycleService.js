import mongoose from 'mongoose';
import ClientPlan from '../models/ClientPlan.js';
import User from '../models/User.js';
import { notify } from './notificationService.js';
import { formatDayMonthSantiago, santiagoToUtc } from '../utils/timezone.js';
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
const MAX_STEPS = 20;
const NOTICE_HORIZON_DAYS = 5;
const EXPIRED_NOTICE_LOOKBACK_DAYS = 60;

// ─── Renovación automática (beca y Miembro Fundador) ────────────────────────
// Miembro Fundador es una marca que pone el administrador (no depende del plan: no se apaga sola ni al cambiar de plan).
// Un plan con beca, o de un Miembro Fundador, no se queda «pendiente de pago»: al terminar el último ciclo se abre el
// siguiente ya activo. La beca no avisa nada de pagos; el fundador recibe el aviso de que debe pagar y los administradores
// reciben el aviso de la renovación para revisar su transferencia (el sistema no registra ese pago).

const founderIdSet = async (patientIds) => {
  const ids = [...new Set(patientIds.map(String))];
  if (ids.length === 0) return new Set();
  const founders = await User.find({ _id: { $in: ids }, isFounder: true }).select('_id');
  return new Set(founders.map((u) => String(u._id)));
};

// Un plan se renueva solo si es de una beca o de un fundador, y es de los que se renuevan (no un plan puntual)
const renewsByItself = (plan, founders) => plan.renews !== false && (plan.scholarship === true || founders.has(String(plan.patient)));

// ─── Crear un plan (todos sus ciclos) ───────────────────────────────────────

export async function createTermPlans({
  patientId,
  serviceType,
  sessionsTotal,
  unlimited = false,
  term = 'mensual',
  billingCycle = 'calendar',
  startDate = new Date(),
  renews: renewsRequested = true,
  paymentMode = 'prepaid',
  scholarship = false,
  graceDays,
  registeredBy,
  notes
}) {
  // Una beca siempre se renueva sola (la casilla «Se renueva cada mes» no puede dejarla sin renovación)
  const renews = scholarship ? true : renewsRequested;

  // Kinesiología: un solo plan por sesiones, sin ciclos, sin fecha de término y sin renovación automática
  if (serviceType === 'kinesiologia') {
    const plan = await ClientPlan.create({
      patient: patientId,
      serviceType,
      sessionsTotal,
      unlimited: false,
      startDate,
      term: 'mensual',
      billingCycle: 'calendar',
      cycleNumber: 1,
      cyclesTotal: 1,
      termId: new mongoose.Types.ObjectId(),
      renews: false,
      openEnded: true,
      scholarship,
      registeredBy,
      notes,
      status: 'active'
    });
    return plan;
  }

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
      paymentMode: cyclesTotal > 1 ? paymentMode : 'prepaid',
      scholarship,
      ...(graceDays !== undefined ? { graceDays } : {}),
      registeredBy,
      notes,
      status: cycle.cycleNumber === 1 ? 'active' : 'upcoming'
    }));
  }
  return created[0];
}

// El admin registra el pago de una renovación que estaba pendiente: el ciclo
// queda pagado CONSERVANDO las sesiones ya usadas (así quien agendó en los
// días de plazo no recibe un cupo nuevo por pagar), y si pagó un plan de
// varios meses se crean los ciclos que faltan.
export async function settlePendingPlan(plan, { sessionsTotal, unlimited = false, term = 'mensual', renews: renewsRequested = true, paymentMode = 'prepaid', scholarship = false, graceDays, registeredBy, notes }) {
  // Una renovación pendiente de pago de kinesiología pasa a plan por sesiones: queda pagada, sin ciclos ni fecha, conservando lo ya usado
  if (plan.serviceType === 'kinesiologia') {
    plan.sessionsTotal = sessionsTotal;
    plan.unlimited = false;
    plan.term = 'mensual';
    plan.cyclesTotal = 1;
    plan.cycleNumber = 1;
    plan.renews = false;
    plan.openEnded = true;
    plan.scholarship = scholarship;
    plan.paymentPending = false;
    plan.paymentDueBy = undefined;
    plan.registeredBy = registeredBy;
    if (notes) plan.notes = notes;
    await plan.save();
    return plan;
  }

  const renews = scholarship ? true : renewsRequested;
  const cyclesTotal = TERM_CYCLES[term];
  const termId = new mongoose.Types.ObjectId();

  plan.sessionsTotal = unlimited ? 0 : sessionsTotal;
  plan.unlimited = unlimited;
  plan.term = term;
  plan.cyclesTotal = cyclesTotal;
  plan.cycleNumber = 1;
  plan.termId = termId;
  plan.renews = renews;
  plan.paymentMode = cyclesTotal > 1 ? paymentMode : 'prepaid';
  plan.scholarship = scholarship;
  if (graceDays !== undefined) plan.graceDays = graceDays;
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
      paymentMode: plan.paymentMode,
      scholarship,
      graceDays: plan.graceDays,
      registeredBy,
      notes,
      status: 'upcoming'
    });
  }
  return plan;
}

// Renovación por adelantado: el plazo siguiente queda PAGADO desde ya y parte justo cuando termina el último ciclo vigente (sin
// perder ni un día, sin tocar las citas ni el horario fijo). Si ya existía una renovación de ese ciclo, lanza ALREADY_RENEWED.
export class RenewalError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function createEarlyRenewal(plan, { registeredBy, notes, paymentMode = 'prepaid', scholarship = false, graceDays } = {}) {
  const start = new Date(plan.endDate.getTime() + 1);
  const cyclesTotal = TERM_CYCLES[plan.term] ?? 1;
  const termId = new mongoose.Types.ObjectId();
  const cycles = buildCycles(start, plan.billingCycle, cyclesTotal);
  const created = [];
  for (const cycle of cycles) {
    try {
      created.push(await ClientPlan.create({
        patient: plan.patient,
        serviceType: plan.serviceType,
        sessionsTotal: plan.sessionsTotal,
        unlimited: plan.unlimited,
        startDate: cycle.start,
        term: plan.term,
        billingCycle: plan.billingCycle,
        cycleNumber: cycle.cycleNumber,
        cyclesTotal,
        termId,
        renews: true,
        paymentMode: cyclesTotal > 1 ? paymentMode : 'prepaid',
        scholarship,
        ...(graceDays !== undefined ? { graceDays } : {}),
        ...(cycle.cycleNumber === 1 ? { renewedFrom: plan._id } : {}),
        registeredBy,
        notes,
        status: 'upcoming'
      }));
    } catch (error) {
      if (error.code === 11000) throw new RenewalError(409, 'ALREADY_RENEWED', 'Este plan ya fue renovado');
      throw error;
    }
  }
  return created[0];
}

// Cancela un plan y los ciclos futuros ya pagados de ese mismo pago
export async function cancelPlanAndFutureCycles(plan) {
  plan.status = 'cancelled';
  await plan.save();
  if (plan.termId) {
    await ClientPlan.updateMany({ termId: plan.termId, status: 'upcoming' }, { $set: { status: 'cancelled' } });
  }
}

// ─── Cambiar la fecha de inicio de un plan ──────────────────────────────────

export class PlanDateError extends Error {}

// Estado de cada ciclo según la fecha de hoy: los ya terminados vencen, el vigente queda activo y los que vienen, por empezar.
// Si todos terminaron, el último queda activo para que la pasada del programador abra la renovación como siempre.
export function statusesForCycles(cycles, now = new Date()) {
  const current = cycles.findIndex((c) => c.end.getTime() >= now.getTime());
  const activeIndex = current === -1 ? cycles.length - 1 : current;
  return cycles.map((_, i) => (i < activeIndex ? 'expired' : i === activeIndex ? 'active' : 'upcoming'));
}

/**
 * Mueve la fecha de inicio de un plan (y de todos los ciclos de ese mismo pago). Las sesiones ya usadas NO cambian: cada plan
 * conserva su contador. Lanza PlanDateError (mensaje listo para mostrar) si el cambio no es posible.
 */
export async function changePlanStartDate(plan, startDateStr, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateStr || '');
  if (!match) throw new PlanDateError('Elige una fecha válida');
  const [, y, m, d] = match.map(Number);
  const start = santiagoToUtc(y, m, d, 0, 0);
  if (Number.isNaN(start.getTime())) throw new PlanDateError('Elige una fecha válida');

  const dayMs = 24 * 60 * 60 * 1000;
  if (start.getTime() < now.getTime() - 400 * dayMs || start.getTime() > now.getTime() + 90 * dayMs) {
    throw new PlanDateError('La fecha de inicio debe estar entre hace un año y los próximos 3 meses');
  }
  if (plan.status === 'cancelled') throw new PlanDateError('Un plan cancelado no se puede modificar');
  if (plan.openEnded) {
    plan.startDate = start;
    await plan.save();
    return [plan];
  }
  if (plan.termId && plan.cycleNumber > 1) throw new PlanDateError('Cambia la fecha desde el primer ciclo del plan');

  const cycleDocs = plan.termId
    ? await ClientPlan.find({ termId: plan.termId, status: { $ne: 'cancelled' } }).sort({ cycleNumber: 1 })
    : [plan];
  const first = cycleDocs[0];
  if (String(first._id) !== String(plan._id)) throw new PlanDateError('Cambia la fecha desde el primer ciclo del plan');

  if (await ClientPlan.exists({ renewedFrom: { $in: cycleDocs.map((c) => c._id) } })) {
    throw new PlanDateError('Este plan ya tiene una renovación abierta. Cambia primero la fecha de esa renovación.');
  }

  const cycles = buildCycles(start, plan.billingCycle, cycleDocs.length);
  const total = cycleDocs.length;
  const lastEnd = cycles[total - 1].end;

  // No puede cruzarse con otro plan (no cancelado) del mismo paciente y servicio
  const others = await ClientPlan.find({
    patient: plan.patient,
    serviceType: plan.serviceType,
    status: { $ne: 'cancelled' },
    _id: { $nin: cycleDocs.map((c) => c._id) },
    openEnded: { $ne: true }
  });
  const clash = others.find((o) => o.startDate.getTime() <= lastEnd.getTime() && o.endDate.getTime() >= start.getTime());
  if (clash) throw new PlanDateError('Con esa fecha el plan se cruzaría con otro plan del paciente. Elige otra fecha.');

  const statuses = statusesForCycles(cycles, now);
  for (let i = 0; i < total; i++) {
    cycleDocs[i].startDate = i === 0 ? start : cycles[i].start;
    cycleDocs[i].endDate = cycles[i].end;
    cycleDocs[i].status = cycleDocs[i].paymentPending ? cycleDocs[i].status : statuses[i];
    if (cycleDocs[i].paymentPending) cycleDocs[i].paymentDueBy = paymentDueBy(cycleDocs[i].startDate, cycleDocs[i].graceDays ?? 5);
    await cycleDocs[i].save();
  }
  return cycleDocs;
}

// ─── Mover los planes al estado de "ahora" ──────────────────────────────────

async function openPendingRenewal(plan, now) {
  const start = new Date(plan.endDate.getTime() + 1);
  const graceDays = plan.graceDays ?? 5;
  const due = paymentDueBy(start, graceDays);

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
      graceDays,
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

// Ciclo nuevo de una beca o de un fundador: nace activo y pagado (con los ciclos que faltan si el plan es trimestral o anual).
// Pasa por el mismo camino que cuando el administrador registra el pago, así conserva las sesiones ya usadas y las reglas.
async function settleAutoRenewal(pending, previous) {
  await settlePendingPlan(pending, {
    sessionsTotal: pending.sessionsTotal,
    unlimited: pending.unlimited,
    term: pending.term,
    renews: true,
    paymentMode: previous?.paymentMode ?? 'prepaid',
    scholarship: previous?.scholarship === true,
    graceDays: pending.graceDays,
    registeredBy: pending.registeredBy,
    notes: 'Renovación automática'
  });
}

async function openAutoRenewal(plan) {
  const start = new Date(plan.endDate.getTime() + 1);
  const graceDays = plan.graceDays ?? 5;
  let renewal;
  try {
    renewal = await ClientPlan.create({
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
      paymentDueBy: paymentDueBy(start, graceDays),
      graceDays,
      renewedFrom: plan._id,
      autoRenewed: true,
      registeredBy: plan.registeredBy,
      status: 'active'
    });
  } catch (error) {
    // Otro proceso ya la abrió (índice único en renewedFrom): perfecto, es lo mismo
    if (error.code !== 11000) throw error;
    return;
  }
  await settleAutoRenewal(renewal, plan);
}

export async function advancePlans({ patientId, now = new Date() } = {}) {
  const scope = patientId ? { patient: patientId } : {};
  for (let step = 0; step < MAX_STEPS; step++) {
    let changed = false;

    // 0) Renovaciones pendientes de una beca o de un fundador (abiertas antes de que existiera la renovación automática,
    //    o que quedaron a medias): pasan a ser pagadas, nunca vencen
    const pendings = await ClientPlan.find({ ...scope, status: 'active', paymentPending: true });
    if (pendings.length) {
      const founders = await founderIdSet(pendings.map((p) => p.patient));
      for (const pending of pendings) {
        const previous = pending.renewedFrom ? await ClientPlan.findOne({ _id: pending.renewedFrom }) : null;
        if (!(founders.has(String(pending.patient)) || previous?.scholarship === true)) continue;
        pending.autoRenewed = true;
        await settleAutoRenewal(pending, previous);
        changed = true;
      }
    }

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

    const founders = await founderIdSet(ended.map((p) => p.patient));
    for (const plan of ended) {
      let next = plan.termId
        ? await ClientPlan.findOne({ termId: plan.termId, status: 'upcoming', cycleNumber: plan.cycleNumber + 1 })
        : null;
      // Renovación pagada por adelantado: el plazo siguiente espera, ya pagado, a que termine este ciclo
      if (!next) next = await ClientPlan.findOne({ renewedFrom: plan._id, status: 'upcoming' });

      if (next) {
        // Ciclo ya pagado: el siguiente arranca (con sus sesiones en cero) y el anterior cierra en silencio
        const activated = await ClientPlan.findOneAndUpdate({ _id: next._id, status: 'upcoming' }, { $set: { status: 'active' } });
        if (activated) {
          await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired', expiredNotifiedAt: now } });
          changed = true;
        }
        continue;
      }

      if (renewsByItself(plan, founders)) {
        // Beca o fundador: el ciclo siguiente se abre solo, ya activo (no se queda esperando un pago)
        await openAutoRenewal(plan);
        await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired', expiredNotifiedAt: now } });
      } else if (plan.renews && (await openPendingRenewal(plan, now))) {
        // El aviso al paciente lo da la renovación pendiente, no un "venció"
        await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired', expiredNotifiedAt: now } });
      } else {
        await ClientPlan.updateOne({ _id: plan._id, status: 'active' }, { $set: { status: 'expired' } });
      }
      changed = true;
    }

    if (!changed) break;
  }
}

// ─── Avisos (campanita + correo) ────────────────────────────────────────────

const dayBeforeEnd = (date) => formatDayMonthSantiago(new Date(date.getTime() - 1));

export function buildExpiringMessage(plan, now) {
  const msLeft = plan.endDate.getTime() - now.getTime();
  const isLastDay = msLeft <= DAY_MS;
  const endsOn = formatDayMonthSantiago(plan.endDate);

  const paymentLine = plan.renews
    ? ` Para seguir sin interrupciones tienes plazo hasta el ${dayBeforeEnd(paymentDueBy(new Date(plan.endDate.getTime() + 1), plan.graceDays ?? 5))} para pagar tu renovación; puedes seguir agendando hasta esa fecha.`
    : '';

  return {
    title: isLastDay ? 'Tu plan vence mañana' : 'Tu plan está por vencer',
    body: `Tu plan vence el ${endsOn}.${paymentLine} Contacta a Prime F&H para renovar.`
  };
}

export async function runPlanLifecycleJob(now = new Date()) {
  await advancePlans({ now });

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  const adminIds = admins.map((a) => a._id);
  const summary = { expiringNotices: 0, renewalNotices: 0, expiredNotices: 0, autoRenewed: 0 };

  // 1) Último ciclo de un plan que vence en 5 días (o en 1): aviso con el plazo de pago
  const horizon = new Date(now.getTime() + NOTICE_HORIZON_DAYS * DAY_MS);
  const expiring = await ClientPlan.find({
    status: 'active',
    paymentPending: false,
    endDate: { $gte: now, $lte: horizon },
    $expr: { $gte: ['$cycleNumber', '$cyclesTotal'] },
    $or: [{ expiringNotifiedAt: null }, { expiringTomorrowNotifiedAt: null }]
  });

  const selfRenewing = await founderIdSet(expiring.map((p) => p.patient));
  for (const plan of expiring) {
    // Una beca o un fundador se renueva solo: no tiene nada que pagar «para no perder» el plan
    if (renewsByItself(plan, selfRenewing)) continue;
    // Ya se renovó por adelantado: no hay nada que pagar
    if (await ClientPlan.exists({ renewedFrom: plan._id })) continue;
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

  // 2b) Renovaciones automáticas: la beca no recibe nada (no paga); al fundador se le recuerda pagar y a los administradores se
  //     les avisa para que revisen su transferencia (el sistema no registra ese pago). Un solo aviso por renovación.
  const autoOpened = await ClientPlan.find({ status: 'active', autoRenewed: true, paymentPending: false, renewalNotifiedAt: null })
    .populate('patient', 'firstName lastName');
  const renewedFounders = [];
  for (const plan of autoOpened) {
    if (plan.patient && !plan.scholarship) {
      await notify(plan.patient._id, 'plan_auto_renewed', {
        title: 'Tu plan se renovó',
        body: `Tu plan se renovó automáticamente y ya puedes agendar. Recuerda pagarlo por transferencia a Prime F&H antes del ${dayBeforeEnd(paymentDueBy(plan.startDate, plan.graceDays ?? 5))}.`,
        link: '/app/mi-perfil'
      });
      renewedFounders.push(`${plan.patient.firstName} ${plan.patient.lastName}`);
    }
    plan.renewalNotifiedAt = now;
    await plan.save();
    summary.autoRenewed++;
  }
  if (renewedFounders.length) {
    const shown = renewedFounders.slice(0, 6).join(', ');
    const more = renewedFounders.length > 6 ? ` y ${renewedFounders.length - 6} más` : '';
    for (const adminId of adminIds) {
      await notify(adminId, 'plan_auto_renewed', {
        title: 'Planes renovados automáticamente',
        body: `Se renovaron solos los planes de miembros fundadores: ${shown}${more}. Revisa que hayan transferido.`,
        link: '/app/admin/planes'
      });
    }
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
