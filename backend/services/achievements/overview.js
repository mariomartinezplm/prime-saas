import { ACHIEVEMENTS, CATEGORIES, CATEGORY_ORDER, PENDING_ACHIEVEMENTS } from '../../config/achievements.js';
import { kinesiologyProgress, KINESIOLOGY_MILESTONES } from './kinesiology.js';
import { groupTrainingPlansByPeriod, consistencyProgress } from './consistency.js';
import { streakProgress, STREAK_MILESTONES } from './streaks.js';
import { readinessWeekProgress } from './readiness.js';
import { wellbeingProgress } from './wellbeing.js';
import { bodyProgress, BODY_MILESTONES, isActiveGoal } from './body.js';
import { strengthSummary } from './strength.js';

/**
 * "Mis logros": arma lo que se muestra de un paciente (función pura, sin base de datos).
 *
 * Reglas de lo que se muestra:
 *  - Una categoría aparece solo si el paciente tiene datos reales para ella (kinesiología si tuvo sesiones o plan de
 *    kinesiología, etc.); nunca se muestra como si funcionara algo que no se puede evaluar.
 *  - Los retos que todavía no existen (dispositivos, reglas sin aprobar) se muestran como `pending`, sin progreso.
 *  - Para el paciente un logro "en revisión" se muestra como cualquier otro (el historial no se altera ni se alarma);
 *    el personal sí ve el estado, la nota y la evidencia.
 *  - Sin rankings ni comparaciones con otros pacientes.
 */

const trainingPlan = (p) => p.serviceType === 'entrenamiento';

// Qué categorías corresponden a este paciente
function visibleCategories({ appointments, plans, checkins, measurements, exercises, goal, awards }) {
  const withAwards = new Set(awards.map((a) => a.category));
  const hasKine = appointments.some((a) => a.type === 'kinesiologia') || plans.some((p) => p.serviceType === 'kinesiologia');
  const hasTraining = plans.some(trainingPlan);
  const hasAnyPlan = plans.length > 0 || checkins.length > 0;
  return {
    kinesiologia: hasKine,
    constancia: hasTraining,
    readiness: hasAnyPlan,
    descanso: hasAnyPlan,
    estres: hasAnyPlan,
    trayectoria: hasTraining,
    cuerpo: measurements.length > 0 || !!goal?.direction,
    fuerza: exercises.length > 0
  };
  // (las categorías con logros ya concedidos se agregan abajo)
}

const ratio = (p) => (p && p.target ? Math.min(1, p.current / p.target) : 0);

function progressFor(key, data, now) {
  const { appointments, plans, pauses, checkins, measurements, goal } = data;

  if (key === 'kine_5') {
    const p = kinesiologyProgress(appointments);
    const milestone = KINESIOLOGY_MILESTONES.find((m) => m.key === key);
    return { current: Math.min(p.completed, milestone.target), target: milestone.target, unit: 'sesiones', label: 'sesiones de kinesiología completadas' };
  }

  if (key === 'consistency_month') {
    const live = groupTrainingPlansByPeriod(plans).find((g) => g.governing?.status === 'active' && new Date(g.governing.endDate) >= now && g.target > 0);
    if (!live) return null;
    const p = consistencyProgress(plans, appointments, live.periodKey);
    return p ? { current: Math.min(p.completed, p.target), target: p.target, unit: 'sesiones', label: 'sesiones completadas este mes', periodKey: live.periodKey } : null;
  }

  const streak = STREAK_MILESTONES.find((m) => m.key === key);
  if (streak) {
    const p = streakProgress(plans, appointments, pauses, now);
    return { current: Math.min(p.current, streak.months), target: streak.months, unit: 'meses', label: 'meses seguidos de constancia' };
  }

  if (key === 'readiness_week') {
    const p = readinessWeekProgress(checkins);
    return { current: p.best, target: p.target, unit: 'días', label: 'días con Readiness en tu mejor semana' };
  }

  if (key === 'rest_week' || key === 'balance_week') {
    const p = wellbeingProgress(checkins, key);
    return { current: p.best, target: p.target, unit: 'días', label: 'días favorables en tu mejor semana (autorreporte)', source: 'autorreporte' };
  }

  const body = BODY_MILESTONES.find((m) => m.key === key);
  if (body) {
    const p = bodyProgress(measurements, goal);
    if (!p.active || !p.hasReference) return null;
    // Un hito se confirma con una SEGUNDA medición 14 días después: mientras tanto la barra puede estar llena sin que
    // el logro exista, y se dice (para que no parezca un error)
    const label = p.progressKg >= body.kg ? 'de cambio hacia tu meta · falta confirmarlo con otra medición (14 días después)' : 'de cambio hacia tu meta';
    return { current: Math.max(0, Math.min(p.progressKg, body.kg)), target: body.kg, unit: 'kg', label };
  }

  return null;
}

// Texto corto con el dato que justifica un logro (visible solo para la propia persona y su equipo)
function detailOf(award) {
  const v = award.evidence?.values;
  if (!v) return null;
  if (award.key === 'strength_pr' && v.exercise) return `${v.exercise}: ${v.weight} ${v.unit} (marca anterior ${v.previousBest} ${v.unit})`;
  if (award.key.startsWith('body_') && v.referenceWeight) return `Referencia ${v.referenceWeight} kg desde el ${v.referenceDate}`;
  if (award.key === 'consistency_month' && v.target) return `${v.completed} de ${v.target} sesiones`;
  if (award.key === 'kine_5' && v.completed) return `${v.completed} sesiones de kinesiología completadas`;
  return award.evidence?.summary ?? null;
}

function awardView(award, audience) {
  const base = {
    id: String(award._id),
    periodKey: award.periodKey,
    awardedAt: award.awardedAt,
    seenAt: award.seenAt ?? null,
    detail: detailOf(award)
  };
  if (audience === 'staff') {
    return {
      ...base,
      status: award.status,
      source: award.source,
      reason: award.reason ?? null,
      reviewNote: award.reviewNote ?? null,
      reviewFlaggedAt: award.reviewFlaggedAt ?? null,
      ruleVersion: award.ruleVersion,
      evidence: award.evidence ? { summary: award.evidence.summary ?? null, values: award.evidence.values ?? null, refModel: award.evidence.refModel ?? null, count: award.evidence.refs?.length ?? 0 } : null
    };
  }
  // El paciente no ve "en revisión": el logro conserva su lugar en el historial
  return base;
}

export function buildOverview(data, { audience = 'patient', now = new Date() } = {}) {
  const awards = data.awards ?? [];
  const byKey = new Map();
  for (const award of awards) {
    if (!byKey.has(award.key)) byKey.set(award.key, []);
    byKey.get(award.key).push(award);
  }

  const visible = visibleCategories({ ...data, awards });
  for (const award of awards) visible[award.category] = true;

  const categories = CATEGORY_ORDER.filter((key) => visible[key]).map((categoryKey) => {
    const items = Object.values(ACHIEVEMENTS)
      .filter((def) => def.category === categoryKey)
      .map((def) => {
        const earned = (byKey.get(def.key) ?? []).sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt));
        const progress = progressFor(def.key, data, now);
        let status;
        if (earned.length > 0) status = 'earned';
        else if (categoryKey === 'cuerpo' && !isActiveGoal(data.goal)) status = 'locked';
        else if (progress && progress.current > 0) status = 'in_progress';
        else status = 'available';

        return {
          key: def.key,
          title: def.title,
          description: def.description,
          criteria: def.criteria,
          status,
          progress,
          lockedNote: status === 'locked' ? 'Define tu meta corporal en Configuración para activar estos hitos.' : null,
          awards: earned.map((a) => awardView(a, audience))
        };
      });

    const pending = PENDING_ACHIEVEMENTS.filter((p) => p.category === categoryKey).map((p) => ({
      key: p.key,
      title: p.title,
      description: p.description,
      criteria: null,
      status: 'pending',
      progress: null,
      pendingNote: p.note,
      awards: []
    }));

    return { key: categoryKey, label: CATEGORIES[categoryKey].label, items: [...items, ...pending] };
  });

  // Próximo hito: el reto en curso más cercano a completarse; si no hay, el primero disponible
  const candidates = categories.flatMap((c) => c.items.map((item) => ({ ...item, category: c.key, categoryLabel: c.label })));
  const inProgress = candidates.filter((i) => i.status === 'in_progress').sort((a, b) => ratio(b.progress) - ratio(a.progress));
  const nextItem = inProgress[0] ?? candidates.find((i) => i.status === 'available' && i.progress) ?? null;

  // Para la animación de desbloqueo: lo que todavía no se mostró (el más antiguo primero)
  const unseen = awards
    .filter((a) => !a.seenAt)
    .sort((a, b) => new Date(a.awardedAt) - new Date(b.awardedAt))
    .map((a) => {
      const def = ACHIEVEMENTS[a.key];
      return def
        ? { id: String(a._id), key: a.key, title: def.title, message: def.message, category: a.category, categoryLabel: CATEGORIES[a.category]?.label ?? '', awardedAt: a.awardedAt, detail: detailOf(a) }
        : null;
    })
    .filter(Boolean);

  const history = awards
    .filter((a) => ACHIEVEMENTS[a.key])
    .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt))
    .map((a) => ({ ...awardView(a, audience), key: a.key, title: ACHIEVEMENTS[a.key].title, category: a.category, categoryLabel: CATEGORIES[a.category]?.label ?? '' }));

  return {
    categories,
    next: nextItem ? { key: nextItem.key, title: nextItem.title, category: nextItem.category, categoryLabel: nextItem.categoryLabel, progress: nextItem.progress } : null,
    unseen,
    history,
    summary: { earned: awards.filter((a) => ACHIEVEMENTS[a.key]).length }
  };
}
