import { santiagoToUtc } from '../utils/timezone.js';

/**
 * Entrenamiento en curso: reglas puras (sin base de datos) para poder probarlas.
 */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

// ── Cuándo se puede iniciar ──────────────────────────────────────────────────
// Política aprobada: desde 30 minutos antes del inicio de la cita de ENTRENAMIENTO hasta 3 horas después de que termina
// la franja (los bloques a veces se alargan). La reserva no es el inicio: el entrenamiento empieza al pulsar el botón.
export const START_BEFORE_MS = 30 * MINUTE;
export const START_AFTER_END_MS = 3 * HOUR;
// Una sesión sin NINGUNA actividad durante este tiempo se considera abandonada y se cierra sola
export const AUTO_CLOSE_MS = 6 * HOUR;

const [DEFAULT_MIN, DEFAULT_MAX] = [5, 1800];
export const REST_MIN_SEC = DEFAULT_MIN;
export const REST_MAX_SEC = DEFAULT_MAX;
export const ADD_SEC = 15;

// Instante real (UTC) de una hora de la cita, que está guardada como día + "HH:mm" de Chile
export function appointmentInstant(appointment, time) {
  const day = new Date(appointment.date).toISOString().slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = String(time ?? '').split(':').map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;
  return santiagoToUtc(y, m, d, hh, mm);
}

// 'soon' = faltan hasta 30 min (todavía no es la hora) · 'live' = dentro de la franja · 'late' = pasó la franja pero sigue en gracia
export function startPhase(appointment, now = new Date()) {
  if (!appointment || appointment.type !== 'entrenamiento' || appointment.status !== 'scheduled') return null;
  const start = appointmentInstant(appointment, appointment.startTime);
  const end = appointmentInstant(appointment, appointment.endTime);
  if (!start || !end) return null;
  const t = now.getTime();
  if (t < start.getTime() - START_BEFORE_MS) return null;
  if (t > end.getTime() + START_AFTER_END_MS) return null;
  if (t < start.getTime()) return 'soon';
  return t <= end.getTime() ? 'live' : 'late';
}

// De varias citas elegibles, la más cercana a empezar (o la que está en curso)
export function pickStartable(appointments, now = new Date()) {
  const found = appointments
    .map((a) => ({ appointment: a, phase: startPhase(a, now) }))
    .filter((x) => x.phase)
    .sort((a, b) => appointmentInstant(a.appointment, a.appointment.startTime) - appointmentInstant(b.appointment, b.appointment.startTime));
  return found[0] ?? null;
}

// ── Sesión abandonada ────────────────────────────────────────────────────────
export const isStale = (session, now = new Date()) => now.getTime() - new Date(session.lastActivityAt).getTime() > AUTO_CLOSE_MS;

// ── Descanso ────────────────────────────────────────────────────────────────
// Segundos que faltan (entero hacia arriba). Siempre derivado de instantes guardados.
export function remainingSec(rest, now = new Date()) {
  if (!rest) return 0;
  if (rest.state === 'running' && rest.dueAt) return Math.max(0, Math.ceil((new Date(rest.dueAt).getTime() - now.getTime()) / 1000));
  if (rest.state === 'paused') return Math.max(0, Math.ceil(rest.remainingSec ?? 0));
  return 0;
}

// Un descanso que ya venció pasa a "done" al leerlo (no hace falta ningún proceso en segundo plano)
export function settle(rest, now = new Date()) {
  if (rest?.state === 'running' && remainingSec(rest, now) === 0) return { ...plain(rest), state: 'done', dueAt: undefined, remainingSec: 0 };
  return plain(rest);
}

const plain = (rest) => (rest?.toObject ? rest.toObject() : { ...(rest ?? {}) });
export const validSeconds = (n) => Number.isInteger(n) && n >= REST_MIN_SEC && n <= REST_MAX_SEC;

export const REST_ACTIONS = ['start', 'pause', 'resume', 'add', 'skip', 'set_next'];

// Aplica una acción al descanso. Devuelve { rest } con el nuevo estado o { error }. Siempre sube `version`.
export function applyRestAction(current, action, { seconds } = {}, now = new Date()) {
  const rest = settle(current, now);
  const base = { durationSec: rest.durationSec ?? 120, nextDurationSec: rest.nextDurationSec ?? 120, version: (rest.version ?? 0) + 1 };

  switch (action) {
    case 'start': {
      // Inicia con la duración pedida o con la del PRÓXIMO descanso. Ya hay uno en marcha o en pausa: no se reinicia.
      if (rest.state === 'running' || rest.state === 'paused') return { error: 'Ya hay un descanso en curso. Omítelo para empezar otro.', code: 'REST_ACTIVE' };
      const duration = seconds ?? base.nextDurationSec;
      if (!validSeconds(duration)) return { error: `El descanso debe durar entre ${REST_MIN_SEC} y ${REST_MAX_SEC} segundos`, code: 'INVALID_SECONDS' };
      return { rest: { ...base, state: 'running', durationSec: duration, nextDurationSec: seconds ?? base.nextDurationSec, dueAt: new Date(now.getTime() + duration * 1000), remainingSec: undefined } };
    }
    case 'pause': {
      if (rest.state !== 'running') return { error: 'No hay un descanso corriendo para pausar', code: 'NOT_RUNNING' };
      return { rest: { ...base, state: 'paused', dueAt: undefined, remainingSec: remainingSec(rest, now) } };
    }
    case 'resume': {
      if (rest.state !== 'paused') return { error: 'No hay un descanso en pausa para reanudar', code: 'NOT_PAUSED' };
      return { rest: { ...base, state: 'running', dueAt: new Date(now.getTime() + (rest.remainingSec ?? 0) * 1000), remainingSec: undefined } };
    }
    case 'add': {
      // Sumar tiempo al descanso ACTIVO (corriendo o en pausa)
      const extra = seconds ?? ADD_SEC;
      if (!validSeconds(extra) && extra !== ADD_SEC) return { error: 'Cantidad de segundos no válida', code: 'INVALID_SECONDS' };
      if (rest.state === 'running') return { rest: { ...base, state: 'running', dueAt: new Date(new Date(rest.dueAt).getTime() + extra * 1000), remainingSec: undefined } };
      if (rest.state === 'paused') return { rest: { ...base, state: 'paused', dueAt: undefined, remainingSec: (rest.remainingSec ?? 0) + extra } };
      return { error: 'No hay un descanso activo al que sumar tiempo', code: 'NO_REST' };
    }
    case 'skip': {
      if (rest.state !== 'running' && rest.state !== 'paused') return { error: 'No hay un descanso para omitir', code: 'NO_REST' };
      return { rest: { ...base, state: 'idle', dueAt: undefined, remainingSec: undefined } };
    }
    case 'set_next': {
      // Cambia SOLO el próximo descanso: uno activo conserva su duración y su vencimiento
      if (!validSeconds(seconds)) return { error: `El descanso debe durar entre ${REST_MIN_SEC} y ${REST_MAX_SEC} segundos`, code: 'INVALID_SECONDS' };
      return { rest: { ...rest, ...base, state: rest.state, dueAt: rest.dueAt, remainingSec: rest.remainingSec, durationSec: rest.durationSec ?? 120, nextDurationSec: seconds } };
    }
    default:
      return { error: 'Acción de descanso desconocida', code: 'UNKNOWN_ACTION' };
  }
}
