import { toScale9 } from '../../utils/readiness.js';

/**
 * Logros de descanso y de equilibrio (estrés), basados SOLO en lo que la persona registra en su Readiness.
 *
 * FUENTE: autorreporte. "Sueño" y "estrés" del Readiness son respuestas del 1 al 9 sobre cómo se sintió la
 * persona (9 = bien; el estrés ya se guarda invertido). No son horas de sueño ni mediciones de un dispositivo, y
 * así se dicen en pantalla. No se usa ningún dato de un wearable.
 *
 * Reglas aprobadas:
 *  - Una noche/día "favorable" = respuesta >= 7 (en la escala 1-9; los check-ins antiguos en escala 1-5 se
 *    convierten al leerlos).
 *  - El logro es "5 días favorables dentro de una ventana de 7 días". NUNCA una medición aislada.
 *  - Un día SIN check-in no cuenta ni a favor ni en contra: no se interpreta como una mala noche ni se inventa.
 *  - Un día con respuesta baja tampoco "castiga": simplemente no suma; no hay racha que perder.
 *  - Son hábitos y sensaciones, no diagnósticos.
 */

export const FAVORABLE_FROM = 7;
export const WELLBEING_RULES = {
  rest_week: { key: 'rest_week', metric: 'sleep', days: 5, window: 7 },
  balance_week: { key: 'balance_week', metric: 'stress', days: 5, window: 7 }
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDay) => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

// Valor de la respuesta en escala 1-9 (convierte los check-ins antiguos de escala 1-5)
export const answerOf = (checkin, metric) => {
  const raw = checkin?.[metric];
  return Number.isFinite(raw) ? toScale9(raw, checkin.scale) : null;
};

// Días con check-in cuya respuesta fue favorable (uno por día)
export function favorableDays(checkins, metric) {
  const byDay = new Map();
  for (const c of checkins) {
    const value = answerOf(c, metric);
    if (c?.date && value !== null && value >= FAVORABLE_FROM && !byDay.has(c.date)) byDay.set(c.date, c);
  }
  return [...byDay.values()].sort((a, b) => dayNumber(a.date) - dayNumber(b.date));
}

// Primera ventana de `window` días con al menos `days` días favorables, o null
export function findFavorableWindow(checkins, { metric, days, window }) {
  const favorable = favorableDays(checkins, metric);
  for (const first of favorable) {
    const start = dayNumber(first.date);
    const inside = favorable.filter((c) => dayNumber(c.date) >= start && dayNumber(c.date) < start + window);
    if (inside.length >= days) return inside.slice(0, days);
  }
  return null;
}

export function computeWellbeingCandidates(checkins) {
  return Object.values(WELLBEING_RULES).flatMap((rule) => {
    const run = findFavorableWindow(checkins, rule);
    if (!run) return [];
    return [{
      key: rule.key,
      periodKey: 'once',
      evidence: {
        refs: run.map((c) => c._id),
        refModel: 'WellnessCheckin',
        values: { metric: rule.metric, source: 'autorreporte', days: run.length, windowDays: rule.window, threshold: FAVORABLE_FROM, from: run[0].date, to: run.at(-1).date },
        summary: `Autorreporte favorable ${run.length} de ${rule.window} días`
      }
    }];
  });
}

// Progreso para "Mis logros": mejor tramo de 7 días (máximo = objetivo)
export function wellbeingProgress(checkins, key) {
  const rule = WELLBEING_RULES[key];
  if (!rule) return null;
  const favorable = favorableDays(checkins, rule.metric);
  let best = 0;
  for (const first of favorable) {
    const start = dayNumber(first.date);
    best = Math.max(best, favorable.filter((c) => dayNumber(c.date) >= start && dayNumber(c.date) < start + rule.window).length);
  }
  return { best: Math.min(best, rule.days), target: rule.days, source: 'autorreporte' };
}
