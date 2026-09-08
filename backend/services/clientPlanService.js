import ClientPlan from '../models/ClientPlan.js';
import ExtraSession from '../models/ExtraSession.js';

// Auto-sanación: si el plan activo del paciente ya venció por fecha, lo marca 'expired'.
// Se llama antes de cualquier lectura de balance/plan activo para que el estado
// sea correcto aunque el job masivo (scripts/expirePlans.js) no haya corrido todavía.
async function selfHealExpiredPlan(patientId) {
  await ClientPlan.expireOverduePlans(patientId);
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

  return {
    hasActivePlan: !!plan,
    plan,
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
export async function deductSession(patientId, serviceType, appointmentId) {
  const plan = await ClientPlan.findOneAndUpdate(
    {
      patient: patientId,
      serviceType,
      status: 'active',
      endDate: { $gte: new Date() },
      $expr: { $lt: ['$sessionsUsed', '$sessionsTotal'] }
    },
    { $inc: { sessionsUsed: 1 } },
    { new: true }
  );
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
