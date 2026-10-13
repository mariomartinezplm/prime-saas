import { santiagoParts } from '../../utils/timezone.js';

/**
 * Constancia mensual en entrenamiento.
 *
 * Cada mes del paciente es su propio registro `ClientPlan` (los planes trimestral y anual son varios
 * registros enlazados). El objetivo del mes es el `sessionsTotal` de ESE plan (8, 12, también 4 y 16).
 * Solo cuentan las sesiones COMPLETADAS que se descontaron de ese plan (`deduction.refId`): una reserva, una
 * cita cancelada o una ausencia no cuentan, y cada cita cuenta una sola vez.
 *
 * El periodo ('YYYY-MM') es el mes, en hora de Santiago, en que TERMINA el ciclo del plan. En el ciclo normal
 * (hasta fin de mes) es el mes del plan; en el ciclo "de fecha a fecha" (del 10 al 9) es el mes en que cierra.
 * Así cada ciclo tiene un periodo único y los ciclos consecutivos tienen periodos consecutivos.
 *
 * Cambio de plan dentro del mes (el plan anterior queda cancelado): el objetivo es el del plan vigente al
 * final del periodo, y las sesiones completadas bajo cualquiera de los planes del periodo cuentan.
 * Los planes ilimitados y los de kinesiología quedan fuera (esta categoría es de entrenamiento).
 */

export function periodKeyOfPlan(plan) {
  const p = santiagoParts(new Date(plan.endDate));
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

const isTrainingPlan = (plan) => plan.serviceType === 'entrenamiento';

// Agrupa los planes de entrenamiento por periodo y decide cuál manda (el vigente más reciente)
export function groupTrainingPlansByPeriod(plans) {
  const groups = new Map();
  for (const plan of plans.filter(isTrainingPlan)) {
    const key = periodKeyOfPlan(plan);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(plan);
  }

  return [...groups.entries()]
    .map(([periodKey, group]) => {
      const live = group.filter((p) => p.status !== 'cancelled' && p.status !== 'upcoming');
      const governing = [...live].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0] ?? null;
      const target = governing && !governing.unlimited ? governing.sessionsTotal : 0;
      return { periodKey, plans: group, governing, target };
    })
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

// Cuántas sesiones completadas (sin repetir) se descontaron de alguno de estos planes
export function completedForPlans(appointments, plans) {
  const planIds = new Set(plans.map((p) => String(p._id)));
  const seen = new Set();
  const refs = [];
  for (const a of appointments) {
    if (a.status !== 'completed' || a.deduction?.source !== 'clientPlan') continue;
    if (!planIds.has(String(a.deduction.refId))) continue;
    const id = String(a._id);
    if (seen.has(id)) continue;
    seen.add(id);
    refs.push(a._id);
  }
  return refs;
}

// Logros que corresponde conceder (función pura)
export function computeConsistencyCandidates(plans, appointments) {
  return groupTrainingPlansByPeriod(plans)
    .filter((g) => g.target > 0)
    .map((g) => ({ ...g, refs: completedForPlans(appointments, g.plans) }))
    .filter((g) => g.refs.length >= g.target)
    .map((g) => ({
      key: 'consistency_month',
      periodKey: g.periodKey,
      evidence: {
        refs: g.refs,
        refModel: 'Appointment',
        values: { completed: g.refs.length, target: g.target, planId: g.governing._id },
        summary: `Plan de ${g.target} sesiones completado`
      }
    }));
}

// Progreso del periodo en curso o de cualquier periodo (para "Mis logros")
export function consistencyProgress(plans, appointments, periodKey) {
  const group = groupTrainingPlansByPeriod(plans).find((g) => g.periodKey === periodKey);
  if (!group || group.target === 0) return null;
  const completed = completedForPlans(appointments, group.plans).length;
  return { periodKey, completed, target: group.target, met: completed >= group.target };
}

// ¿Sigue cumpliéndose este periodo con los datos de hoy? (para revisar tras una corrección)
export function consistencyPeriodStillMet(plans, appointments, periodKey) {
  return consistencyProgress(plans, appointments, periodKey)?.met === true;
}
