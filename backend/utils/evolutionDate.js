const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Una medición o ejercicio con fecha futura quedaría como "el último registro"
// en los gráficos hasta que llegue ese día. Se da un día de margen por zona horaria.
export function evolutionDateError(date, now = new Date()) {
  if (date === undefined || date === null || date === '') return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'La fecha no es válida';
  if (parsed.getTime() > now.getTime() + ONE_DAY_MS) return 'La fecha no puede ser futura';
  return null;
}
