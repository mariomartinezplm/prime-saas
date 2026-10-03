import { format } from 'date-fns';

// Fecha de hoy en el calendario local, para el valor inicial de <input type="date">
export const todayLocal = () => format(new Date(), 'yyyy-MM-dd');

// El servidor guarda un instante. Enviar "2026-10-03" lo dejaría a medianoche UTC,
// y en Chile se vería como el 2 de octubre. A mediodía local el día es el mismo en
// cualquier zona cercana.
export const localNoonISO = (day: string) => new Date(`${day}T12:00:00`).toISOString();
