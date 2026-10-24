import { getIndicator } from '../../config/goalCatalog.js';
import { dayNumber } from '../achievements/dates.js';

/**
 * Progreso de un objetivo, calculado SIEMPRE desde los registros (nunca guardado): si un registro se corrige o se
 * elimina, el progreso se recalcula solo y consistente.
 *
 * Una «serie» es la lista de registros de un indicador: [{ day: 'AAAA-MM-DD', value, refId, refModel }] de más antiguo a más
 * reciente, con un solo valor por día.
 *
 * Reglas:
 *  - Punto de partida = el valor guardado al crear el objetivo; si no hay, el último registro hasta el día de inicio; si
 *    tampoco, el primer registro posterior. Siempre un registro real y con fecha: nunca se inventa un valor.
 *  - La PRIMERA medición no es una mejora: con un solo registro el cambio es 0.
 *  - Se da por conseguido solo con los registros POSTERIORES al punto de partida que cumplen la meta, tantos y separados
 *    por tantos días como pide el indicador (una fluctuación aislada nunca basta).
 *  - Empeorar no se castiga: el porcentaje no baja de 0 y el cambio se muestra con su signo, sin mensajes de culpa.
 */

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function meetsTarget(value, target, direction) {
  if (!target || !isNum(target.value) || !isNum(value)) return false;
  if (direction === 'increase') return value >= target.value;
  if (direction === 'decrease') return value <= target.value;
  return Math.abs(value - target.value) <= (target.tolerance ?? 0);
}

// Cuánto falta para llegar a la meta (0 si ya está en ella)
export function remainingTo(value, target, direction) {
  if (!target || !isNum(target.value) || !isNum(value)) return null;
  if (direction === 'increase') return round(Math.max(0, target.value - value));
  if (direction === 'decrease') return round(Math.max(0, value - target.value));
  return round(Math.max(0, Math.abs(value - target.value) - (target.tolerance ?? 0)));
}

// Punto de partida: guardado → último registro hasta el inicio → primer registro posterior
export function resolveBaseline(series, stored, startedDay) {
  if (stored && isNum(stored.value) && stored.day) return { value: stored.value, day: stored.day, refId: stored.refId ?? null, derived: false };
  if (series.length === 0) return null;
  const before = startedDay ? series.filter((p) => dayNumber(p.day) <= dayNumber(startedDay)) : [];
  const pick = before.length ? before[before.length - 1] : series[0];
  return { value: pick.value, day: pick.day, refId: pick.refId ?? null, derived: true };
}

// ¿Los registros posteriores al punto de partida que cumplen la meta bastan para darla por conseguida?
export function confirmationOf(series, baseline, target, direction, rule = { records: 1, minDays: 0 }) {
  if (!baseline || !target) return { confirmed: false, confirmingDays: [] };
  const eligible = series.filter((p) => dayNumber(p.day) > dayNumber(baseline.day) && meetsTarget(p.value, target, direction));
  if (eligible.length < rule.records) return { confirmed: false, confirmingDays: eligible.map((p) => p.day) };
  const span = dayNumber(eligible[eligible.length - 1].day) - dayNumber(eligible[0].day);
  return { confirmed: span >= rule.minDays, confirmingDays: eligible.map((p) => p.day) };
}

/**
 * @param indicator  indicador guardado en el objetivo: { indicatorId, unit, direction, target, baseline }
 * @param series     registros del indicador (ver arriba)
 * @param startedDay día en que empezó el objetivo ('AAAA-MM-DD')
 */
export function computeIndicatorProgress(indicator, series, startedDay) {
  const def = getIndicator(indicator.indicatorId);
  const direction = indicator.direction;
  const target = indicator.target && isNum(indicator.target.value) ? indicator.target : null;
  const baseline = resolveBaseline(series, indicator.baseline, startedDay);
  const current = series.length ? series[series.length - 1] : null;

  const base = {
    indicatorId: indicator.indicatorId,
    seriesKey: indicator.seriesKey,
    params: indicator.params ?? {},
    source: indicator.source,
    manual: indicator.source === 'checkin',
    confirmation: def?.confirmation ?? { records: 1, minDays: 0 },
    professionalEntryOnly: def?.professionalEntryOnly === true,
    targetSetByRole: indicator.targetSetByRole ?? null,
    label: indicator.label,
    unit: indicator.unit,
    direction,
    origin: def?.origin ?? 'registro',
    note: def?.note ?? null,
    indirect: def?.indirect === true,
    target,
    baseline: baseline ? { value: baseline.value, day: baseline.day } : null,
    current: current ? { value: current.value, day: current.day } : null,
    lastDay: current?.day ?? null,
    recordsCount: series.length,
    points: baseline ? series.filter((p) => dayNumber(p.day) >= dayNumber(baseline.day)).map((p) => ({ day: p.day, value: p.value })) : series.map((p) => ({ day: p.day, value: p.value })),
    change: null,
    remaining: null,
    percent: null,
    reached: false,
    confirmed: false,
  };

  if (!target) return { ...base, state: 'needs_target' };
  if (!baseline) return { ...base, state: 'needs_baseline' };

  const value = current ? current.value : baseline.value;
  const rule = def?.confirmation ?? { records: 1, minDays: 0 };
  const { confirmed } = confirmationOf(series, baseline, target, direction, rule);
  const reached = meetsTarget(value, target, direction);

  let percent;
  if (direction === 'maintain') {
    const tolerance = target.tolerance ?? 0;
    const start = Math.abs(baseline.value - target.value);
    percent = Math.abs(value - target.value) <= tolerance ? 100 : start <= tolerance ? 100 : Math.max(0, 1 - (Math.abs(value - target.value) - tolerance) / (start - tolerance)) * 100;
  } else {
    const distance = direction === 'increase' ? target.value - baseline.value : baseline.value - target.value;
    const done = direction === 'increase' ? value - baseline.value : baseline.value - value;
    percent = distance > 0 ? (done / distance) * 100 : reached ? 100 : 0;
  }

  return {
    ...base,
    change: round(value - baseline.value),
    remaining: remainingTo(value, target, direction),
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    reached,
    confirmed,
    state: confirmed ? 'achieved' : 'in_progress',
  };
}

/**
 * Progreso de un objetivo completo (uno o varios indicadores). Está conseguido cuando TODOS sus indicadores con meta
 * están confirmados; un indicador sin meta todavía (pendiente del profesional) impide darlo por conseguido.
 */
export function computeGoalProgress(goal, seriesBySeriesKey, startedDay) {
  const indicators = goal.indicators.map((ind) => computeIndicatorProgress(ind, seriesBySeriesKey[ind.seriesKey] ?? [], startedDay));
  const withPercent = indicators.filter((i) => i.percent !== null);
  const states = indicators.map((i) => i.state);
  const state = states.every((s) => s === 'achieved')
    ? 'achieved'
    : states.includes('needs_target')
      ? 'needs_target'
      : states.includes('needs_baseline')
        ? 'needs_baseline'
        : 'in_progress';
  const lastDay = indicators.map((i) => i.lastDay).filter(Boolean).sort().at(-1) ?? null;
  return {
    state,
    percent: withPercent.length ? Math.round(withPercent.reduce((sum, i) => sum + i.percent, 0) / withPercent.length) : null,
    lastDay,
    indicators,
  };
}
