import { ACHIEVEMENTS, CATEGORIES } from '../../config/achievements.js';
import { santiagoToUtc, santiagoParts } from '../../utils/timezone.js';
import { consistencyProgress } from './consistency.js';
import { dayOf } from './dates.js';

/**
 * Resumen mensual de "Mi camino PRIME" (solo lectura, solo datos YA registrados, sin interpretar nada).
 *
 *  - Sesiones: citas de kinesiología y de entrenamiento con estado `completed` en ese mes (hora de Chile).
 *    Si el plan de entrenamiento de ese mes tiene sesiones definidas, se informa también "X de N del plan".
 *  - Hitos: los logros concedidos ese mes (por fecha del logro).
 *  - Registros: SOLO cuántos hay (mediciones, ejercicios, días de Readiness). Nunca valores ni conclusiones: ni peso,
 *    ni cambios, ni dolor. El peso es un objetivo opcional de la persona y no se muestra aquí.
 */

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MAX_MONTHS_BACK = 24;

export const monthKeyOf = (date) => {
  const p = santiagoParts(new Date(date));
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

// Mes pedido: formato válido, no futuro y no más de 24 meses atrás
export function validateMonth(month, now = new Date()) {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) return false;
  const current = monthKeyOf(now);
  if (month > current) return false;
  const [cy, cm] = current.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);
  return (cy - y) * 12 + (cm - m) <= MAX_MONTHS_BACK;
}

// Desde el inicio del mes hasta el inicio del siguiente (instantes UTC de la medianoche de Chile)
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return { from: santiagoToUtc(y, m, 1), to: santiagoToUtc(next[0], next[1], 1) };
}

const inMonth = (date, month) => dayOf(date).slice(0, 7) === month;

export function buildMonthlySummary({ appointments = [], plans = [], awards = [], counts = {} }, month, now = new Date()) {
  const seen = new Set();
  const completed = appointments.filter((a) => {
    if (a.status !== 'completed' || (a.type !== 'kinesiologia' && a.type !== 'entrenamiento') || !inMonth(a.date, month)) return false;
    const id = String(a._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const plan = consistencyProgress(plans, appointments, month);

  const milestones = awards
    .filter((a) => ACHIEVEMENTS[a.key] && inMonth(a.awardedAt, month))
    .sort((a, b) => new Date(a.awardedAt) - new Date(b.awardedAt))
    .map((a) => ({ key: a.key, title: ACHIEVEMENTS[a.key].title, category: a.category, categoryLabel: CATEGORIES[a.category]?.label ?? '', awardedAt: a.awardedAt }));

  const records = { measurements: counts.measurements ?? 0, exercises: counts.exercises ?? 0, readinessDays: counts.readinessDays ?? 0 };
  const sessions = {
    completed: completed.length,
    training: completed.filter((a) => a.type === 'entrenamiento').length,
    kinesiology: completed.filter((a) => a.type === 'kinesiologia').length,
    plan: plan ? { completed: plan.completed, target: plan.target, met: plan.met } : null
  };

  return {
    month,
    isCurrent: month === monthKeyOf(now),
    sessions,
    milestones,
    records,
    hasActivity: sessions.completed > 0 || milestones.length > 0 || records.measurements + records.exercises + records.readinessDays > 0
  };
}
