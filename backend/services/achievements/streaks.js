import { groupTrainingPlansByPeriod, completedForPlans } from './consistency.js';

/**
 * Rachas de constancia: meses CONSECUTIVOS con "Mes de constancia".
 *
 * Cada mes del paciente tiene uno de estos estados (se calcula con los datos de hoy):
 *   met      cumplió el objetivo de su plan del mes (cuente o no con una pausa).
 *   missed   tenía plan, el mes ya cerró y no llegó al objetivo, sin pausa autorizada → corta la racha.
 *   neutral  no suma ni corta: sin plan ese mes (vacaciones, tiempo sin contratar), plan ilimitado (no tiene
 *            objetivo de sesiones), plan solo "próximo" o cancelado, o PAUSA AUTORIZADA.
 *   pending  el mes sigue en curso y todavía no llega al objetivo: no cuenta ni corta (nunca se da por perdido
 *            un mes que no terminó).
 *
 * Los meses neutrales no se cuentan como cumplidos ni se inventan sesiones: la racha continúa "a través" de
 * ellos. Un mes `missed` la reinicia, pero sin mensajes de pérdida: lo único visible es el progreso actual.
 */

export const STREAK_MILESTONES = [
  { key: 'streak_3', months: 3 },
  { key: 'streak_6', months: 6 },
  { key: 'streak_12', months: 12 }
];

// Estado de cada mes con plan de entrenamiento (función pura)
export function monthStates(plans, appointments, pauses = [], now = new Date()) {
  const paused = new Set(pauses.map((p) => p.periodKey));

  return groupTrainingPlansByPeriod(plans).map((group) => {
    const { periodKey, governing, target } = group;
    if (!governing) return { periodKey, state: 'neutral', reason: 'no_plan' };
    if (target === 0) return { periodKey, state: 'neutral', reason: 'unlimited' };

    const completed = completedForPlans(appointments, group.plans).length;
    if (completed >= target) return { periodKey, state: 'met', completed, target };
    if (paused.has(periodKey)) return { periodKey, state: 'neutral', reason: 'paused', completed, target };
    if (new Date(governing.endDate) < now) return { periodKey, state: 'missed', completed, target };
    return { periodKey, state: 'pending', completed, target };
  });
}

// Tramos de meses cumplidos seguidos (los neutrales y pendientes no los cortan; los `missed` sí)
export function metRuns(states) {
  const runs = [];
  let current = [];
  for (const s of states) {
    if (s.state === 'met') current.push(s.periodKey);
    else if (s.state === 'missed') {
      if (current.length) runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

// Logros de racha que corresponde conceder (función pura). La evidencia son los meses del tramo que la alcanzó.
export function computeStreakCandidates(plans, appointments, pauses = [], now = new Date()) {
  const runs = metRuns(monthStates(plans, appointments, pauses, now));
  return STREAK_MILESTONES.flatMap((m) => {
    const run = runs.find((r) => r.length >= m.months);
    if (!run) return [];
    return [{
      key: m.key,
      periodKey: 'once',
      evidence: {
        values: { months: run.slice(0, m.months), target: m.months },
        summary: `${m.months} meses de constancia consecutivos`
      }
    }];
  });
}

// ¿Sigue cumpliéndose el hito con los datos de hoy? (para revisar tras una corrección o al quitar una pausa)
export function streakMilestoneStillMet(plans, appointments, pauses, now, key) {
  const milestone = STREAK_MILESTONES.find((m) => m.key === key);
  if (!milestone) return false;
  return metRuns(monthStates(plans, appointments, pauses, now)).some((r) => r.length >= milestone.months);
}

// Progreso para "Mis logros": racha en curso y próximo hito
export function streakProgress(plans, appointments, pauses = [], now = new Date()) {
  const states = monthStates(plans, appointments, pauses, now);
  const runs = metRuns(states);
  const longest = runs.reduce((max, r) => Math.max(max, r.length), 0);

  // Racha en curso: el último tramo, solo si no quedó cortado por un mes perdido posterior
  let current = 0;
  for (const s of states) {
    if (s.state === 'met') current += 1;
    else if (s.state === 'missed') current = 0;
  }

  const next = STREAK_MILESTONES.find((m) => longest < m.months) ?? null;
  return { current, longest, nextKey: next?.key ?? null, nextMonths: next?.months ?? null };
}
