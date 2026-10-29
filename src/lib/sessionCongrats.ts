// Mensaje de felicitación al terminar un entrenamiento: cuenta cuántas sesiones lleva en el mes (las que la persona registró y
// finalizó; no es la asistencia que valida el centro). Puro: recibe lo que ya calculó el servidor.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// 1 → «1.ª», 5 → «5.ª»
export const ordinalSession = (n: number): string => `${n}.ª`;

export interface MonthCongrats {
  title: string;
  body: string;
}

export function monthCongrats(monthCount: number, monthlyTarget: number | null, monthMet: boolean, now: Date = new Date(), remainingMonth: number | null = null): MonthCongrats | null {
  if (!Number.isInteger(monthCount) || monthCount < 1) return null;
  const month = MONTHS[Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', month: '2-digit' }).format(now)) - 1];
  const title = monthCount === 1 ? `¡Primera sesión de ${month}!` : `¡Esta es tu ${ordinalSession(monthCount)} sesión de ${month}!`;

  let body: string;
  if (monthMet) body = monthCount === monthlyTarget ? 'Cumpliste tu meta del mes. Felicidades, sigue así.' : 'Ya superaste tu meta del mes. Felicidades, sigue así.';
  else if (monthCount === 1) body = 'Buen comienzo. Cada sesión suma: sigue así.';
  else if (remainingMonth !== null && remainingMonth > 0) body = `Felicidades, sigue así: te ${remainingMonth === 1 ? 'falta 1 sesión' : `faltan ${remainingMonth} sesiones`} para tu meta del mes.`;
  else body = 'Felicidades, sigue así.';
  return { title, body };
}

// Texto de la mejora de un ejercicio frente a la última vez
export function improvementText(i: { kind: 'weight' | 'reps' | 'time'; previous: number; current: number; pct: number; unit: string | null }): string {
  const n = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
  if (i.kind === 'weight') return `+${i.pct} % de carga (${n(i.previous)} → ${n(i.current)} ${i.unit ?? 'kg'})`;
  if (i.kind === 'reps') return `+${i.pct} % de repeticiones (${n(i.previous)} → ${n(i.current)})`;
  return `+${i.pct} % de tiempo (${n(i.previous)} s → ${n(i.current)} s)`;
}

// «8 × 60 kg · 8 × 60 kg · 6 × 55 kg», una entrada por serie (solo con lo que se guardó)
export function setLine(s: { reps: number | null; weight: number | null; unit: string | null; durationSec: number | null }): string {
  const n = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
  const parts: string[] = [];
  if (s.reps !== null) parts.push(`${s.reps}`);
  if (s.weight !== null) parts.push(`${n(s.weight)} ${s.unit ?? 'kg'}`);
  if (s.durationSec !== null) parts.push(`${s.durationSec} s`);
  return s.reps !== null && s.weight !== null ? `${s.reps} × ${n(s.weight)} ${s.unit ?? 'kg'}` : parts.join(' · ');
}
