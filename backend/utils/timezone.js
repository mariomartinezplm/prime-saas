// El servidor corre en UTC (Railway), pero las reglas de agenda son respecto
// a la hora real de Puerto Montt. Comparar `new Date()` directo contra un
// horario ingresado como hora de Chile desfasaba las reglas varias horas
// (Paso 17 de BLUEPRINT.md). Se arma un Date cuyos campos "locales" (los que
// lee `new Date(string)` al parsear una fecha sin offset, como
// `${date}T${startTime}`) coinciden con la hora real de Santiago — así ambos
// lados de cualquier comparación quedan en el mismo eje, sin depender de una
// librería de zonas horarias nueva.
export function nowInSantiago() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
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
