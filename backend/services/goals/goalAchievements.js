import PatientGoal from '../../models/PatientGoal.js';
import { getCategory, getIndicator } from '../../config/goalCatalog.js';
import { grantAchievement } from '../achievementService.js';
import { computeGoalProgress } from './goalProgress.js';
import { makeSourceReader, seriesForGoals } from './goalSources.js';
import { dayOf } from '../achievements/dates.js';

/**
 * Reconocimiento de objetivos conseguidos, dentro del MISMO motor de logros (AchievementAward): nada paralelo.
 *
 * - Solo objetivos ACTIVOS (un objetivo pendiente de validación o pausado nunca se reconoce).
 * - Solo con la confirmación que pide cada indicador (ver goalProgress): una fluctuación aislada no basta.
 * - Idempotente: el logro es uno por objetivo (periodKey = su id) y el objetivo pasa a «conseguido» con una actualización
 *   atómica; dos pasadas a la vez, reintentos o recargas no repiten nada. Corregir un registro después NO revierte lo ya
 *   reconocido.
 * - Si la persona desactivó las celebraciones, queda en su historial sin aviso ni animación.
 */

const ACHIEVEMENT_KEY = 'goal_achieved';
const decimal = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const UNIT_TEXT = { '/10': ' de 10', '°': '°', '%': ' %' };
const valueText = (value, unit) => (UNIT_TEXT[unit] !== undefined ? `${decimal(value)}${UNIT_TEXT[unit]}` : `${decimal(value)} ${unit}`.trim());

// «Press banca», «Bíceps contraído derecho», «Rodilla derecha»…
export function indicatorDetail(indicator) {
  const def = getIndicator(indicator.indicatorId);
  const parts = [];
  for (const p of def?.params ?? []) {
    const raw = indicator.params?.[p.key];
    if (raw === undefined || raw === '') continue;
    if (p.type === 'enum') parts.push(p.options.find((o) => o.value === raw)?.label ?? String(raw));
    else if (p.type === 'exercise') parts.push(String(raw).charAt(0).toUpperCase() + String(raw).slice(1));
    else if (p.type === 'number') parts.push(`con ${decimal(Number(raw))} kg`);
    else parts.push(String(raw));
  }
  return parts.join(' · ');
}

// Texto de la celebración: «Alcanzaste tu meta de 75 kg en Press banca»
export function celebrationOf(goal) {
  const items = goal.indicators.map((ind) => ({
    label: ind.label,
    detail: indicatorDetail(ind),
    value: ind.target?.value ?? null,
    unit: ind.unit,
  }));
  const one = items.length === 1 ? items[0] : null;
  const headline = one
    ? `Alcanzaste tu meta de ${valueText(one.value, one.unit)}${one.detail ? ` en ${one.detail}` : ''}`
    : `Alcanzaste las metas de tu objetivo «${getCategory(goal.categoryId)?.name ?? ''}»`;
  return { headline, value: one ? one.value : null, unit: one ? one.unit : null, items };
}

export async function evaluateGoalAchievements(patientId, { reader = makeSourceReader(patientId), now = new Date() } = {}) {
  const goals = await PatientGoal.find({ patient: patientId, status: 'active' });
  if (goals.length === 0) return [];
  const seriesMap = await seriesForGoals(goals, reader);
  const achieved = [];

  for (const goal of goals) {
    const progress = computeGoalProgress(goal, seriesMap, dayOf(goal.startedAt));
    if (progress.state !== 'achieved') continue;

    const celebration = celebrationOf(goal);
    // 1) El reconocimiento (idempotente por objetivo). Si falla, el objetivo sigue activo y la próxima pasada lo reintenta.
    await grantAchievement({
      patientId,
      key: ACHIEVEMENT_KEY,
      periodKey: `obj@${goal._id}`,
      awardedAt: now,
      evidence: {
        summary: celebration.headline,
        refModel: 'PatientGoal',
        refs: [String(goal._id)],
        values: { goalId: String(goal._id), categoryId: goal.categoryId, ...celebration },
      },
      notify: goal.celebrate !== false,
      seen: goal.celebrate === false,
    });

    // 2) Cierre del objetivo: solo si SIGUE activo (otro proceso pudo cerrarlo antes) y liberando su cupo
    const closed = await PatientGoal.findOneAndUpdate(
      { _id: goal._id, status: 'active' },
      { $set: { status: 'achieved', achievedAt: now, 'indicators.$[].achievedAt': now }, $unset: { slot: '' }, $push: { history: { at: now, byRole: 'system', action: 'achieved', note: celebration.headline } } },
      { new: true }
    );
    if (closed) achieved.push(String(goal._id));
  }
  return achieved;
}
