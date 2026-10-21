import { dayOf, dayNumber } from './dates.js';
import { periodKeyOfPlan } from './consistency.js';

/**
 * Objetivo semanal de "Mi camino PRIME" (función pura, solo lectura).
 *
 * Regla por defecto (decidida con Mario): sesiones del plan del mes ÷ 4 semanas, redondeado hacia arriba
 * (8 → 2 por semana, 12 → 3, 16 → 4, 4 → 1; 10 → 3). Nunca más que las sesiones del plan.
 * Solo para planes de ENTRENAMIENTO con sesiones definidas: los planes ilimitados y de kinesiología no tienen
 * objetivo semanal (en kinesiología lo define el profesional; no se inventa).
 *
 * La semana va de lunes a domingo, en hora de Chile. Solo cuentan las sesiones COMPLETADAS y descontadas del plan
 * (igual que la constancia mensual); las agendadas se informan aparte, sin contarlas como logradas.
 * Un mes con pausa autorizada oculta el objetivo: no se castiga ni se pide nada.
 */

export const DEFAULT_WEEKS_PER_CYCLE = 4;

export function defaultWeeklyTarget(sessionsTotal) {
  if (!Number.isFinite(sessionsTotal) || sessionsTotal <= 0) return 0;
  return Math.min(sessionsTotal, Math.ceil(sessionsTotal / DEFAULT_WEEKS_PER_CYCLE));
}

const isoOfDayNumber = (n) => new Date(n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Lunes y domingo ('YYYY-MM-DD') de la semana que contiene el día
export function weekBounds(isoDay) {
  const n = dayNumber(isoDay);
  const weekday = new Date(n * 24 * 60 * 60 * 1000).getUTCDay() || 7; // lunes = 1 … domingo = 7
  return { start: isoOfDayNumber(n - (weekday - 1)), end: isoOfDayNumber(n + (7 - weekday)) };
}

// Plan de entrenamiento vigente hoy (si hay varios, el que empezó más tarde)
function currentTrainingPlan(plans, now) {
  return (
    plans
      .filter((p) => p.serviceType === 'entrenamiento' && p.status === 'active' && new Date(p.startDate) <= now && new Date(p.endDate) >= now)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0] ?? null
  );
}

export function computeWeeklyGoal({ plans = [], appointments = [], pauses = [] }, now = new Date()) {
  const today = dayOf(now);
  const { start, end } = weekBounds(today);
  const plan = currentTrainingPlan(plans, now);

  if (!plan || plan.unlimited || !(plan.sessionsTotal > 0)) return { state: 'none', weekStart: start, weekEnd: end };

  const periodKey = periodKeyOfPlan(plan);
  if (pauses.some((p) => p.periodKey === periodKey)) return { state: 'paused', weekStart: start, weekEnd: end, periodKey };

  const inWeek = (a) => {
    const day = dayOf(a.date);
    return day >= start && day <= end;
  };
  const planId = String(plan._id);
  const seen = new Set();
  let completed = 0;
  let scheduled = 0;
  for (const a of appointments) {
    if (a.type !== 'entrenamiento' || !inWeek(a)) continue;
    const id = String(a._id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (a.status === 'completed' && a.deduction?.source === 'clientPlan' && String(a.deduction.refId) === planId) completed += 1;
    else if (a.status === 'scheduled') scheduled += 1;
  }

  const target = defaultWeeklyTarget(plan.sessionsTotal);
  return { state: 'active', weekStart: start, weekEnd: end, periodKey, target, completed, scheduled, met: completed >= target, source: 'plan' };
}
