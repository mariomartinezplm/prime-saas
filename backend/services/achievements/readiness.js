/**
 * Logros del Readiness diario.
 *
 * Reconocen el HÁBITO de registrarlo (haber completado el check-in), nunca el resultado: el semáforo no entra
 * en la regla. Un día sin registro no es "malo": simplemente no cuenta.
 *
 * "Una semana de Readiness" = 5 check-ins dentro de cualquier ventana de 7 días seguidos.
 */

export const READINESS_WEEK = { key: 'readiness_week', days: 5, window: 7 };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDay) => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

// Primera ventana de `window` días con al menos `days` check-ins (uno por día), o null
export function findReadinessWindow(checkins, { days, window } = READINESS_WEEK) {
  const byDay = new Map();
  for (const c of checkins) if (c?.date && !byDay.has(c.date)) byDay.set(c.date, c);
  const ordered = [...byDay.values()].sort((a, b) => dayNumber(a.date) - dayNumber(b.date));

  for (let i = 0; i < ordered.length; i += 1) {
    const start = dayNumber(ordered[i].date);
    const inside = ordered.filter((c) => dayNumber(c.date) >= start && dayNumber(c.date) < start + window);
    if (inside.length >= days) return inside.slice(0, days);
  }
  return null;
}

export function computeReadinessCandidates(checkins) {
  const run = findReadinessWindow(checkins);
  if (!run) return [];
  return [{
    key: READINESS_WEEK.key,
    periodKey: 'once',
    evidence: {
      refs: run.map((c) => c._id),
      refModel: 'WellnessCheckin',
      values: { checkins: run.length, windowDays: READINESS_WEEK.window, from: run[0].date, to: run.at(-1).date },
      summary: `Readiness registrado ${run.length} de ${READINESS_WEEK.window} días`
    }
  }];
}

// Progreso para "Mis logros": cuántos días lleva en su mejor ventana de 7 días
export function readinessWeekProgress(checkins) {
  const byDay = new Map();
  for (const c of checkins) if (c?.date) byDay.set(c.date, c);
  const days = [...byDay.keys()].sort();
  let best = 0;
  for (const day of days) {
    const start = dayNumber(day);
    const count = days.filter((d) => dayNumber(d) >= start && dayNumber(d) < start + READINESS_WEEK.window).length;
    best = Math.max(best, count);
  }
  return { best: Math.min(best, READINESS_WEEK.days), target: READINESS_WEEK.days };
}
