import { format } from 'date-fns';

// Fecha de hoy en el calendario local, para el valor inicial de <input type="date"> y para pedir "citas desde hoy".
// NO usar `new Date().toISOString().split('T')[0]` para esto: da el día en UTC, que en Chile ya es "mañana" desde las
// 21:00 (verano) o las 20:00 (invierno), y dejaría fuera las citas que quedan hoy. `now` solo existe para las pruebas.
export const todayLocal = (now: Date = new Date()) => format(now, 'yyyy-MM-dd');

// El servidor guarda un instante. Enviar "2026-10-03" lo dejaría a medianoche UTC,
// y en Chile se vería como el 2 de octubre. A mediodía local el día es el mismo en
// cualquier zona cercana.
export const localNoonISO = (day: string) => new Date(`${day}T12:00:00`).toISOString();
