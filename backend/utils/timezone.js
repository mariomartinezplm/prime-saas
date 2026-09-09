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
