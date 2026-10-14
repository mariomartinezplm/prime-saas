import { dayOf, dayNumber } from './dates.js';

/**
 * Meta de peso de la persona.
 *
 * Solo existe si el peso es un objetivo de la persona: ella (o su profesional junto con ella) elige bajar o subir Y
 * escribe cuántos kg. Sin meta completa, o con la meta desactivada, NO se evalúa nada (no se asume que perder peso
 * sea el objetivo de nadie) y no se muestra nada de peso.
 *
 * Reglas aprobadas:
 *  - Referencia = la última medición de peso hasta el día en que empezó la meta (si no hay ninguna, la primera
 *    medición posterior). Siempre una medición real, con fecha, identificada en la evidencia.
 *  - Progreso = kilos de cambio HACIA la meta respecto de la referencia (bajar: referencia − peso; subir: peso − referencia).
 *  - El trofeo se concede solo si DOS mediciones posteriores a la referencia, separadas por al menos 14 días, ambas
 *    con el cambio que la persona se propuso. Una fluctuación puntual nunca basta.
 *  - Cada meta tiene su propio trofeo (clave `goal@<segundos del inicio>`): cambiar la dirección o los kg empieza una
 *    meta nueva, que puede ganar el suyo. Un trofeo ya ganado nunca se pierde por cambiar de meta.
 */

export const CONFIRM_DAYS = 14;
export const BODY_GOAL_KEY = 'body_goal';

export const isCompleteGoal = (goal) =>
  !!goal && (goal.direction === 'lose' || goal.direction === 'gain') && Number.isFinite(goal.targetKg) && goal.targetKg > 0 && !!goal.startedAt;

export const isActiveGoal = (goal) => isCompleteGoal(goal) && goal.enabled !== false;

// Identifica a la meta: el momento (en segundos) en que empezó. Cambiar de meta fija un inicio nuevo.
export const goalPeriodKey = (goal) => `goal@${Math.floor(new Date(goal.startedAt).getTime() / 1000)}`;

// Mediciones válidas (peso > 0 y fecha), de la más antigua a la más reciente
function weighings(measurements) {
  return measurements
    .filter((m) => Number.isFinite(m.weight) && m.weight > 0 && m.date)
    .map((m) => ({ ...m, day: dayOf(m.date) }))
    .sort((a, b) => dayNumber(a.day) - dayNumber(b.day) || String(a._id).localeCompare(String(b._id)));
}

export function referenceOf(measurements, goal) {
  const all = weighings(measurements);
  const start = goal?.startedAt ? dayOf(goal.startedAt) : null;
  if (all.length === 0) return null;
  if (!start) return all[0];
  const before = all.filter((m) => dayNumber(m.day) <= dayNumber(start));
  return before.length ? before.at(-1) : (all.find((m) => dayNumber(m.day) > dayNumber(start)) ?? null);
}

const progressOf = (weight, reference, direction) => (direction === 'lose' ? reference - weight : weight - reference);
const round1 = (n) => Math.round(n * 10) / 10;

// Las dos mediciones que confirman que llegó a su cambio, o null
function confirmation(measurements, goal, reference) {
  const eligible = weighings(measurements).filter(
    (m) => dayNumber(m.day) > dayNumber(reference.day) && progressOf(m.weight, reference.weight, goal.direction) >= goal.targetKg
  );
  if (eligible.length < 2) return null;
  const first = eligible[0];
  const last = eligible.at(-1);
  return dayNumber(last.day) - dayNumber(first.day) >= CONFIRM_DAYS ? { first, last } : null;
}

export function computeBodyCandidates(measurements, goal) {
  if (!isActiveGoal(goal)) return [];
  const reference = referenceOf(measurements, goal);
  if (!reference) return [];
  const proof = confirmation(measurements, goal, reference);
  if (!proof) return [];

  return [{
    key: BODY_GOAL_KEY,
    periodKey: goalPeriodKey(goal),
    evidence: {
      refs: [reference._id, proof.first._id, proof.last._id],
      refModel: 'Measurement',
      values: {
        direction: goal.direction,
        targetKg: goal.targetKg,
        referenceWeight: reference.weight,
        referenceDate: reference.day,
        confirmedBy: [
          { weight: proof.first.weight, date: proof.first.day },
          { weight: proof.last.weight, date: proof.last.day }
        ]
      },
      summary: `Meta de ${goal.targetKg} kg confirmada en dos mediciones`
    }
  }];
}

// ¿Sigue cumpliéndose esa meta con los datos de hoy? Si la meta vigente ya es otra (o no hay una activa), NO se puede
// juzgar el trofeo de la anterior: se considera vigente para no marcarlo "en revisión" sin motivo.
export function bodyGoalStillMet(measurements, goal, periodKey) {
  if (!isActiveGoal(goal) || goalPeriodKey(goal) !== periodKey) return true;
  const reference = referenceOf(measurements, goal);
  return !!reference && confirmation(measurements, goal, reference) !== null;
}

// Progreso para "Mis logros": cambio actual hacia SU meta (solo se muestra a la propia persona y a su profesional)
export function bodyProgress(measurements, goal) {
  if (!isActiveGoal(goal)) return { active: false };
  const reference = referenceOf(measurements, goal);
  const all = weighings(measurements);
  if (!reference || all.length === 0) return { active: true, direction: goal.direction, targetKg: goal.targetKg, hasReference: false };

  const latest = all.at(-1);
  const progressKg = String(latest._id) === String(reference._id) ? 0 : round1(progressOf(latest.weight, reference.weight, goal.direction));
  return {
    active: true,
    direction: goal.direction,
    targetKg: goal.targetKg,
    hasReference: true,
    referenceWeight: reference.weight,
    referenceDate: reference.day,
    progressKg,
    confirmed: confirmation(measurements, goal, reference) !== null
  };
}
