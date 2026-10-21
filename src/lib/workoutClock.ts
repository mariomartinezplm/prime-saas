// Relojes del entrenamiento en curso. TODO se deriva de instantes guardados en el servidor: nunca se cuenta con un
// intervalo. El `setInterval` de la pantalla solo la repinta; si la pestaña se suspende, al volver se recalcula.
//
// `offsetMs` = hora del servidor − hora de este dispositivo, medida al recibir cada respuesta. Así un celular con la hora
// mal puesta (o cambiada a mano) muestra igualmente el tiempo correcto.

export interface RestState {
  state: 'idle' | 'running' | 'paused' | 'done';
  dueAt: string | null;
  remainingSec: number;
  durationSec: number;
  nextDurationSec: number;
  version: number;
}

export const clockOffset = (serverNowIso: string, deviceNowMs: number = Date.now()): number => new Date(serverNowIso).getTime() - deviceNowMs;

// Segundos de entrenamiento transcurridos. Sin tope: pasada la hora sigue contando (01:15:00, 01:40:00, …).
export const elapsedSec = (startedAtIso: string, deviceNowMs: number, offsetMs: number): number =>
  Math.max(0, Math.floor((deviceNowMs + offsetMs - new Date(startedAtIso).getTime()) / 1000));

// Segundos que faltan del descanso (hacia arriba, como un cronómetro de cocina)
export function restRemainingSec(rest: RestState, deviceNowMs: number, offsetMs: number): number {
  if (rest.state === 'running' && rest.dueAt) return Math.max(0, Math.ceil((new Date(rest.dueAt).getTime() - (deviceNowMs + offsetMs)) / 1000));
  if (rest.state === 'paused') return Math.max(0, rest.remainingSec);
  return 0;
}

// Estado que se muestra: un descanso corriendo que ya venció figura como terminado (aunque la app haya estado cerrada)
export const restDisplayState = (rest: RestState, deviceNowMs: number, offsetMs: number): RestState['state'] =>
  rest.state === 'running' && restRemainingSec(rest, deviceNowMs, offsetMs) === 0 ? 'done' : rest.state;

// 0..1 de lo que queda del descanso (para el anillo)
export const restFraction = (rest: RestState, deviceNowMs: number, offsetMs: number): number =>
  rest.durationSec > 0 ? Math.min(1, restRemainingSec(rest, deviceNowMs, offsetMs) / rest.durationSec) : 0;

const pad = (n: number) => String(n).padStart(2, '0');

// 75 min → "1:15:00"; menos de una hora → "15:00"
export function formatClock(totalSec: number, { alwaysHours = false } = {}): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 || alwaysHours ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// Texto para lectores de pantalla: "1 hora 15 minutos"
export function spokenDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [h > 0 && `${h} ${h === 1 ? 'hora' : 'horas'}`, `${m} ${m === 1 ? 'minuto' : 'minutos'}`].filter(Boolean);
  return parts.join(' ');
}
