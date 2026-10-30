import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';
import { advancePlans } from './planLifecycleService.js';
import { paymentDueBy } from './planCycles.js';
import { santiagoToUtc } from '../utils/timezone.js';

// Antes de cualquier lectura de balance/plan activo se deja el plan del paciente
// en el estado correcto de "ahora" (pasa al ciclo siguiente, abre la renovación
// pendiente o vence), así nada depende de que el programador haya corrido ya.
async function selfHealExpiredPlan(patientId) {
  await advancePlans({ patientId });
}

// Lo que el PACIENTE puede ver de su plan: solo los datos propios del plan (lista cerrada). Quedan fuera las `notes` que escribe el
// personal, quién lo registró (`registeredBy`) y los campos internos del sistema (ids de ciclo, avisos enviados). Si el modelo
// agrega un campo nuevo, por defecto NO llega al paciente hasta que se agregue aquí.
export const PATIENT_PLAN_FIELDS = [
  '_id', 'patient', 'serviceType', 'sessionsTotal', 'unlimited', 'sessionsUsed', 'startDate', 'endDate', 'status',
  'term', 'billingCycle', 'cycleNumber', 'cyclesTotal', 'renews', 'openEnded', 'paymentPending', 'paymentDueBy', 'createdAt', 'updatedAt'
];

export function toPatientPlanView(plan) {
  if (!plan) return plan;
  const source = typeof plan.toObject === 'function' ? plan.toObject() : plan;
  return Object.fromEntries(PATIENT_PLAN_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

// ─── Qué fechas se pueden agendar y de qué ciclo sale la sesión ──────────────────────────────────────────────────────────

// Instante (hora de Chile) de una cita a partir de su fecha ('YYYY-MM-DD' o Date a medianoche UTC) y su hora de inicio
export function bookingInstant(date, startTime) {
  const [year, month, day] = new Date(date).toISOString().split('T')[0].split('-').map(Number);
  const [hour, minute] = String(startTime ?? '00:00').split(':').map(Number);
  return santiagoToUtc(year, month, day, hour, minute);
}

// Planes (ciclos) que cuentan para agendar un tipo de sesión: el vigente y los ya pagados que vienen después
export async function bookablePlansFor(patientId, serviceType) {
  return bookablePlans(patientId, serviceType);
}

async function bookablePlans(patientId, serviceType, { heal = true } = {}) {
  if (heal) await selfHealExpiredPlan(patientId);
  return ClientPlan.find({ patient: patientId, serviceType, status: { $in: ['active', 'upcoming'] }, endDate: { $gte: new Date() } }).sort({ startDate: 1 });
}

/**
 * Hasta cuándo se puede agendar y con qué ciclo. Regla (decisión de Mario, 2026-10-30):
 *  - se puede agendar dentro del ciclo vigente y, si el siguiente ya está pagado, dentro de todo ese ciclo siguiente;
 *  - al final del último ciclo el plazo sigue abierto hasta el día 5 del mes que viene (el plazo de pago), para quien se demora un
 *    poco en renovar: esos días usan lo que le queda del último ciclo;
 *  - con la renovación pendiente de pago, solo hasta el fin del plazo de pago (como siempre).
 * Devuelve { until: Date|null, last } (`last` = el ciclo donde termina la ventana) o null si no hay planes.
 */
export function bookingWindowOf(plans) {
  if (!plans?.length) return null;
  const active = plans.find((p) => p.status === 'active') ?? plans[0];
  if (active.paymentPending && active.paymentDueBy) return { until: new Date(new Date(active.paymentDueBy).getTime() - 1), last: active };
  const next = plans.find((p) => p.status === 'upcoming' && p.startDate > active.endDate);
  const last = next ?? active;
  const isChainEnd = !plans.some((p) => p._id !== last._id && p.startDate > last.endDate);
  if (last.openEnded || last.renews === false || !isChainEnd) return { until: last.endDate, last };
  return { until: new Date(paymentDueBy(new Date(last.endDate.getTime() + 1), last.graceDays ?? 5).getTime() - 1), last };
}

// Plan (ciclo) al que pertenece una cita en el instante `at`, o null si esa fecha no se puede agendar.
// Camino corriente (la fecha cae dentro del plan vigente): no hace ninguna consulta de más.
export async function planForBooking(patientId, serviceType, at, { heal = true } = {}) {
  const active = heal
    ? await getActivePlanByType(patientId, serviceType)
    : await ClientPlan.findOne({ patient: patientId, serviceType, status: 'active', endDate: { $gte: new Date() } });
  if (!active) return null;
  const t = at.getTime();
  if (!active.endDate || !active.startDate || t <= active.endDate.getTime()) return { plan: active, tail: false, until: active.endDate ?? null };

  // La fecha queda después del ciclo vigente: puede ser del ciclo siguiente (ya pagado) o del plazo de pago al final
  const plans = await bookablePlans(patientId, serviceType, { heal });
  const window = bookingWindowOf(plans);
  if (!window || t > window.until.getTime()) return null;
  const inside = plans.find((p) => p.startDate.getTime() <= t && t <= p.endDate.getTime());
  if (inside) return { plan: inside, tail: false, until: window.until };
  return { plan: window.last, tail: true, until: window.until };
}

// Plan activo real (no vencido) del paciente, o null.
export async function getActivePlan(patientId) {
  await selfHealExpiredPlan(patientId);

  return ClientPlan.findOne({
    patient: patientId,
    status: 'active',
    endDate: { $gte: new Date() }
  });
}

export async function hasActivePlan(patientId) {
  const plan = await getActivePlan(patientId);
  return !!plan;
}

// Sesiones disponibles = (plan activo no vencido: total - usadas) + extras no usadas
export async function getSessionBalance(patientId) {
  const plan = await getActivePlan(patientId);
  const planSessionsAvailable = plan ? plan.sessionsAvailable() : 0;

  const extraSessionsAvailable = await ExtraSession.countDocuments({
    patient: patientId,
    used: false
  });

  // Ventana de agendamiento (hasta cuándo se puede reservar) y sesiones ya pagadas del ciclo siguiente
  let bookingWindow = null;
  if (plan) {
    const chain = await bookablePlans(patientId, plan.serviceType);
    const win = bookingWindowOf(chain);
    if (win) {
      const upcomingSessionsAvailable = chain.filter((p) => p.status === 'upcoming' && p.startDate <= win.until).reduce((n, p) => n + (p.unlimited ? 0 : p.sessionsAvailable()), 0);
      bookingWindow = { until: win.until, upcomingSessionsAvailable };
    }
  }

  return {
    hasActivePlan: !!plan,
    plan,
    bookingWindow,
    paymentPending: !!plan?.paymentPending,
    paymentDueBy: plan?.paymentPending ? plan.paymentDueBy : null,
    planSessionsAvailable,
    extraSessionsAvailable,
    totalAvailable: planSessionsAvailable + extraSessionsAvailable
  };
}

// Variantes conscientes del tipo de sesión (Paso 15). Necesarias para que el
// gate de "¿puede agendar?" distinga "no tienes saldo de ESTE tipo" (403, ya
// se sabía) de "alguien se llevó el último cupo justo ahora" (409, conflicto
// real) — sin esto, un paciente con plan de kinesiología que intenta agendar
// entrenamiento recibiría "conflicto" en vez del mensaje correcto.
export async function getActivePlanByType(patientId, serviceType) {
  await selfHealExpiredPlan(patientId);

  return ClientPlan.findOne({
    patient: patientId,
    serviceType,
    status: 'active',
    endDate: { $gte: new Date() }
  });
}

export async function getSessionBalanceByType(patientId, serviceType) {
  const plan = await getActivePlanByType(patientId, serviceType);
  const planSessionsAvailable = plan ? plan.sessionsAvailable() : 0;

  const extraSessionsAvailable = await ExtraSession.countDocuments({
    patient: patientId,
    serviceType,
    used: false
  });

  return {
    hasActivePlan: !!plan,
    plan,
    planSessionsAvailable,
    extraSessionsAvailable,
    totalAvailable: planSessionsAvailable + extraSessionsAvailable
  };
}

/**
 * Descuenta UNA sesión de forma atómica (Paso 15 de BLUEPRINT.md).
 *
 * `findOneAndUpdate` es una sola operación en el servidor de Mongo: el filtro
 * completo (incluido `$expr`, que compara sessionsUsed contra sessionsTotal
 * DEL MISMO documento) y el `$inc` se evalúan como una unidad indivisible.
 * Si dos peticiones compiten por el último cupo, Mongo las serializa —
 * solo una ve la condición cumplida en el momento de aplicar el update.
 *
 * Sin transacción entre esto y la creación de la cita (decisión consciente,
 * ver BLUEPRINT.md): el caso no cubierto (el proceso se cae exactamente
 * entre las dos escrituras) es tan raro para este volumen de negocio que no
 * justifica la complejidad de una transacción real.
 */
export async function deductSession(patientId, serviceType, appointmentId, { date, startTime } = {}) {
  // La sesión sale del ciclo al que pertenece la FECHA de la cita. Lo corriente (la fecha cae dentro del plan vigente) es una sola
  // operación, como siempre; si la fecha queda después del fin del plan vigente (ciclo siguiente ya pagado, o plazo de pago del
  // día 1 al 5) se busca el ciclo que corresponde. Sin fecha, o si no corresponde ninguno, se descuenta del plan vigente.
  const at = date && startTime ? bookingInstant(date, startTime) : null;
  const now = new Date();
  const hasSessions = { $or: [{ unlimited: true }, { $expr: { $lt: ['$sessionsUsed', '$sessionsTotal'] } }] };
  const activeFilter = (until) => ({ patient: patientId, serviceType, status: 'active', endDate: { $gte: until }, ...hasSessions });

  let plan = await ClientPlan.findOneAndUpdate(activeFilter(at && at > now ? at : now), { $inc: { sessionsUsed: 1 } }, { new: true });
  if (!plan && at && at > now) {
    const target = await planForBooking(patientId, serviceType, at, { heal: false });
    if (target) {
      plan = await ClientPlan.findOneAndUpdate({ _id: target.plan._id, ...hasSessions }, { $inc: { sessionsUsed: 1 } }, { new: true });
    } else {
      plan = await ClientPlan.findOneAndUpdate(activeFilter(now), { $inc: { sessionsUsed: 1 } }, { new: true });
    }
  }
  if (plan) return { source: 'clientPlan', refId: plan._id };

  // Sin cupo en el plan: se intenta con la sesión extra no usada más antigua
  // (FIFO — se consumen en el orden en que se otorgaron).
  const extra = await ExtraSession.findOneAndUpdate(
    { patient: patientId, serviceType, used: false },
    { $set: { used: true, usedAt: new Date(), usedInAppointment: appointmentId } },
    { new: true, sort: { createdAt: 1 } }
  );
  if (extra) return { source: 'extraSession', refId: extra._id };

  return null;
}

// Devuelve la sesión que se descontó al crear `appointment` (cancelación con
// anticipación, o cancelación hecha por el centro). Nunca deja sessionsUsed
// negativo ni revive una ExtraSession que no estuviera marcada como usada.
export async function refundSession(appointment) {
  const deduction = appointment?.deduction;
  if (!deduction?.source || !deduction?.refId) return;

  if (deduction.source === 'clientPlan') {
    await ClientPlan.findOneAndUpdate(
      { _id: deduction.refId, sessionsUsed: { $gt: 0 } },
      { $inc: { sessionsUsed: -1 } }
    );
  } else if (deduction.source === 'extraSession') {
    await ExtraSession.findOneAndUpdate(
      { _id: deduction.refId, used: true },
      { $set: { used: false, usedAt: null, usedInAppointment: null } }
    );
  }
}
