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
