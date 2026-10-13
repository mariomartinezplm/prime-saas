import { dayOf, dayNumber } from './dates.js';

/**
 * Hitos de evolución corporal (peso).
 *
 * Solo existen si la persona (o su profesional) definió una META activa: bajar o subir de peso. Sin meta, o con la
 * meta desactivada, NO se evalúa nada (no se asume que perder peso sea el objetivo de nadie). La meta
 * 'maintain' (mantener) todavía no tiene hitos definidos.
 *
 * Reglas aprobadas:
 *  - Referencia = la última medición de peso hasta el día en que empezó la meta (si no hay ninguna, la primera
 *    medición posterior). Siempre una medición real, con fecha, identificada en la evidencia.
 *  - Progreso = kilos de cambio HACIA la meta respecto de la referencia (bajar: referencia − peso; subir: peso − referencia).
 *  - Un hito se concede solo si DOS mediciones posteriores a la referencia, separadas por al menos 14 días, ambas
 *    con el progreso del umbral. Una fluctuación puntual nunca basta.
 *  - Una sola vez por umbral: el peso que sube y baja alrededor de un umbral no repite el logro.
 */

export const BODY_MILESTONES = [
  { key: 'body_1kg', kg: 1 },
  { key: 'body_3kg', kg: 3 },
  { key: 'body_5kg', kg: 5 },
  { key: 'body_10kg', kg: 10 }
];
export const CONFIRM_DAYS = 14;

export const isActiveGoal = (goal) => !!goal && goal.enabled !== false && (goal.direction === 'lose' || goal.direction === 'gain');

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

// Para un umbral: las dos mediciones que lo confirman, o null
function confirmation(measurements, goal, reference, kg) {
  const eligible = weighings(measurements).filter(
    (m) => dayNumber(m.day) > dayNumber(reference.day) && progressOf(m.weight, reference.weight, goal.direction) >= kg
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

  return BODY_MILESTONES.flatMap((m) => {
    const proof = confirmation(measurements, goal, reference, m.kg);
    if (!proof) return [];
    return [{
      key: m.key,
      periodKey: 'once',
      evidence: {
        refs: [reference._id, proof.first._id, proof.last._id],
        refModel: 'Measurement',
        values: {
          direction: goal.direction,
          milestoneKg: m.kg,
          referenceWeight: reference.weight,
          referenceDate: reference.day,
          confirmedBy: [
            { weight: proof.first.weight, date: proof.first.day },
            { weight: proof.last.weight, date: proof.last.day }
          ]
        },
        summary: `${m.kg} kg de evolución confirmados en dos mediciones`
      }
    }];
  });
}

// ¿Sigue cumpliéndose el hito con los datos de hoy? Si no hay meta activa o la dirección cambió, NO se puede
// juzgar (otra meta, otra referencia): se considera vigente para no marcarlo "en revisión" sin motivo.
export function bodyMilestoneStillMet(measurements, goal, key, awardedDirection) {
  const milestone = BODY_MILESTONES.find((m) => m.key === key);
  if (!milestone) return false;
  if (!isActiveGoal(goal) || (awardedDirection && awardedDirection !== goal.direction)) return true;
  const reference = referenceOf(measurements, goal);
  return !!reference && confirmation(measurements, goal, reference, milestone.kg) !== null;
}

// Progreso para "Mis logros": cambio actual hacia la meta (solo se muestra a la propia persona y a su profesional)
export function bodyProgress(measurements, goal) {
  if (!isActiveGoal(goal)) return { active: false };
  const reference = referenceOf(measurements, goal);
  const all = weighings(measurements);
  if (!reference || all.length === 0) return { active: true, direction: goal.direction, hasReference: false };

  const latest = all.at(-1);
  const progressKg = latest._id === reference._id ? 0 : round1(progressOf(latest.weight, reference.weight, goal.direction));
  const next = BODY_MILESTONES.find((m) => !confirmation(measurements, goal, reference, m.kg)) ?? null;
  return {
    active: true,
    direction: goal.direction,
    hasReference: true,
    referenceWeight: reference.weight,
    referenceDate: reference.day,
    progressKg,
    nextKey: next?.key ?? null,
    nextKg: next?.kg ?? null
  };
}
