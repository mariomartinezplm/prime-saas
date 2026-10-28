// Aviso de los lunes: al entrar a la app, un recordatorio de la regla de las 4 horas para cancelar o reagendar.
// Aparece una vez por lunes (hora de Chile) y se puede cerrar con «Entendido».

export const CANCEL_NOTICE_HOURS = 4;

// 'AAAA-MM-DD' de hoy en Chile y si es lunes
export function santiagoDay(now: Date): { day: string; isMonday: boolean } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, isMonday: get('weekday') === 'Mon' };
}

// ¿Se muestra? Solo los lunes, a quien tiene un plan vigente, y una vez por día (si ya lo cerró hoy, no vuelve)
export function shouldShowMondayNotice(input: { now: Date; hasPlan: boolean; dismissedDay: string | null }): boolean {
  if (!input.hasPlan) return false;
  const { day, isMonday } = santiagoDay(input.now);
  return isMonday && input.dismissedDay !== day;
}

export const MONDAY_NOTICE = {
  title: 'Cancelar o reagendar: con 4 horas de anticipación',
  body: 'Si necesitas cancelar o reagendar tu sesión, hazlo con al menos 4 horas de anticipación. Si lo haces más tarde, la sesión se descuenta de tu plan como una sesión realizada.',
};
