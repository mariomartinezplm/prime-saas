// Fecha de nacimiento: validación y cumpleaños. Se guarda como medianoche UTC del día escrito ("1990-05-12"),
// así que el día y el mes se leen siempre en UTC (nunca en la zona del servidor).

const MIN_YEAR = 1900;

// Devuelve { date } con una fecha válida, o { error } con el mensaje para la persona.
export function parseBirthDate(value, now = new Date()) {
  if (value === undefined || value === null || value === '') return { error: 'La fecha de nacimiento es obligatoria' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'La fecha de nacimiento no es válida' };
  if (date.getUTCFullYear() < MIN_YEAR) return { error: 'Revisa la fecha de nacimiento' };
  if (date.getTime() > now.getTime()) return { error: 'La fecha de nacimiento no puede ser futura' };
  return { date };
}

const isLeap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// Día y mes del cumpleaños dentro de `year`. Quien nació un 29 de febrero lo celebra el 28 en los años que no son bisiestos.
export function birthdayIn(dateOfBirth, year) {
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  let month = born.getUTCMonth() + 1;
  let day = born.getUTCDate();
  if (month === 2 && day === 29 && !isLeap(year)) day = 28;
  return { month, day, age: year - born.getUTCFullYear() };
}

export const dayKey = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
