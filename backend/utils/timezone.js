// El servidor corre en UTC (Railway), pero las reglas de agenda son respecto
// a la hora real de Puerto Montt. Comparar `new Date()` directo contra un
// horario ingresado como hora de Chile desfasaba las reglas varias horas
// (Paso 17 de BLUEPRINT.md). Se arma un Date cuyos campos "locales" (los que
// lee `new Date(string)` al parsear una fecha sin offset, como
// `${date}T${startTime}`) coinciden con la hora real de Santiago — así ambos
// lados de cualquier comparación quedan en el mismo eje, sin depender de una
// librería de zonas horarias nueva.
export function nowInSantiago(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type).value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`);
}

// Fecha de HOY en Santiago como "YYYY-MM-DD" (Paso 23) — formateada directo
// con Intl, sin pasar por un Date intermedio: nowInSantiago() ida y vuelta
// por un string sin offset solo da la fecha correcta si el proceso corre en
// UTC; en un servidor con otra zona local (como este entorno de desarrollo,
// que corre en America/Santiago) esa vuelta puede correr el día. Esto no
// tiene ese problema — Intl convierte directo desde el instante real.
export function todayInSantiago() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ─── Fechas "de pared" de Santiago (ciclos de planes por mes calendario) ────
// Los planes empiezan y terminan a medianoche de Chile, no de UTC: un plan que
// "termina el 31 de octubre" debe llegar hasta las 23:59 del 31 hora de Puerto
// Montt. Sin librerías de zonas: se parte del reloj de Santiago y se corrige
// hasta que coincida (también cubre el cambio de horario de verano).
const SANTIAGO_TZ = 'America/Santiago';

export function santiagoParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SANTIAGO_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24, // algunos motores devuelven 24 a medianoche
    minute: get('minute'),
    second: get('second'),
  };
}

// Instante real (UTC) en que el reloj de Santiago marca esa fecha y hora.
// `month` y `day` pueden desbordar (mes 13 = enero del año siguiente).
export function santiagoToUtc(year, month, day, hour = 0, minute = 0, second = 0) {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wallAsUtc;
  for (let i = 0; i < 3; i++) {
    const p = santiagoParts(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wallAsUtc - shown;
  }
  return new Date(guess);
}

export function startOfDaySantiago(date) {
  const p = santiagoParts(date);
  return santiagoToUtc(p.year, p.month, p.day);
}

// Primer instante del mes siguiente (00:00 del día 1) en Santiago
export function startOfNextMonthSantiago(date) {
  const p = santiagoParts(date);
  return santiagoToUtc(p.year, p.month + 1, 1);
}

// Mismo día del mes, `months` meses después, a las 00:00 de Santiago
// (si el mes no tiene ese día, usa el último: 31 de enero + 1 mes = 28 de febrero)
export function addMonthsSantiago(date, months) {
  const p = santiagoParts(date);
  const targetIndex = p.month - 1 + months;
  const lastDay = new Date(Date.UTC(p.year, targetIndex + 1, 0)).getUTCDate();
  return santiagoToUtc(p.year, targetIndex + 1, Math.min(p.day, lastDay));
}

export function addDaysSantiago(date, days) {
  const p = santiagoParts(date);
  return santiagoToUtc(p.year, p.month, p.day + days);
}

// "5 de noviembre" — para los mensajes que se muestran al paciente
export function formatDayMonthSantiago(date) {
  return new Intl.DateTimeFormat('es-CL', { timeZone: SANTIAGO_TZ, day: 'numeric', month: 'long' }).format(date);
}
