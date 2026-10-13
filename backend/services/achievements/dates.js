import { santiagoParts } from '../../utils/timezone.js';

// Día civil en Chile ('YYYY-MM-DD') de una fecha. Las fechas de la evolución se guardan al mediodía local, así
// que el día no se corre por la zona horaria del servidor (UTC).
export function dayOf(date) {
  const p = santiagoParts(new Date(date));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const dayNumber = (isoDay) => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

// Semana ISO ('YYYY-Www') del día civil
export function isoWeekOf(isoDay) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay() || 7; // lunes = 1 … domingo = 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // el jueves de esa semana decide el año
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date - yearStart) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
