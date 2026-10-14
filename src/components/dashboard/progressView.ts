import type { AchievementCategoryKey, AchievementProgress, AchievementsOverview } from '../../services/achievementService';

/**
 * «Tu constancia» del dashboard: sale de la respuesta de `/api/achievements/me` (que ya calcula el servidor). Aquí solo se
 * decide QUÉ de esa respuesta se muestra, sin inventar nada.
 *
 *  - Constancia del mes: solo si el servidor entrega el progreso de «Mes de constancia» con sesiones y una meta válida (> 0).
 *    Eso ocurre con un plan mensual de entrenamiento con objetivo de sesiones; con kinesiología o plan ilimitado no hay.
 *  - Siguiente logro: el `next` que calcula el servidor, solo si trae un progreso válido.
 *  - Privacidad: en el dashboard NO se muestran logros de peso, sueño ni estrés (datos de salud); esos solo se ven en «Mis logros».
 *  - Si no hay nada aplicable, el resultado es null y el bloque no se muestra.
 */

// Categorías cuyo progreso es información de salud: no van en el dashboard
export const HIDDEN_ON_DASHBOARD: AchievementCategoryKey[] = ['cuerpo', 'descanso', 'estres'];

export interface MeterView {
  current: number;
  target: number;
  ratio: number; // 0..1
}

export interface NextAchievementView extends MeterView {
  key: string;
  title: string;
  unit: string;
  label: string;
  // Es el mismo reto que la constancia del mes (no se repite como bloque aparte)
  isMonthlyConsistency: boolean;
}

export interface ProgressView {
  consistency: (MeterView & { done: boolean }) | null;
  next: NextAchievementView | null;
  earned: number;
}

const validProgress = (p: AchievementProgress | null | undefined): p is AchievementProgress =>
  !!p && Number.isFinite(p.current) && Number.isFinite(p.target) && p.target > 0 && p.current >= 0;

const meterOf = (p: AchievementProgress): MeterView => {
  const current = Math.min(p.current, p.target);
  return { current, target: p.target, ratio: current / p.target };
};

export function computeProgressView(overview: AchievementsOverview | null | undefined): ProgressView | null {
  if (!overview || !Array.isArray(overview.categories)) return null;

  const monthly = overview.categories
    .find((c) => c.key === 'constancia')
    ?.items.find((i) => i.key === 'consistency_month')?.progress;
  const consistency =
    validProgress(monthly) && monthly.unit === 'sesiones' ? { ...meterOf(monthly), done: monthly.current >= monthly.target } : null;

  const n = overview.next;
  const next: NextAchievementView | null =
    n && validProgress(n.progress) && !HIDDEN_ON_DASHBOARD.includes(n.category)
      ? { ...meterOf(n.progress), key: n.key, title: n.title, unit: n.progress.unit, label: n.progress.label, isMonthlyConsistency: n.key === 'consistency_month' }
      : null;

  // «Mes de constancia» como siguiente logro sin su progreso mensual válido no se puede explicar: no se muestra
  const usableNext = next && (!next.isMonthlyConsistency || consistency) ? next : null;

  if (!consistency && !usableNext) return null;
  const earnedCount = overview.summary?.earned;
  const earned = typeof earnedCount === 'number' && Number.isFinite(earnedCount) ? Math.max(0, earnedCount) : 0;
  return { consistency, next: usableNext, earned };
}
