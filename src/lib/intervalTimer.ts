// Cronómetro de intervalos (Tabata): puro y sin reloj propio. Todo se calcula con los segundos transcurridos, que salen de la hora
// de inicio guardada (como el cronómetro del entrenamiento), así una pestaña en segundo plano no se desfasa.

export interface TimerConfig {
  prepareSec: number; // cuenta previa (0 = sin cuenta previa)
  workSec: number;
  restSec: number;
  rounds: number;
}

export type PhaseKind = 'prepare' | 'work' | 'rest';

export interface Phase {
  kind: PhaseKind;
  round: number; // 0 en la cuenta previa
  durationSec: number;
  startSec: number;
}

export const LIMITS = {
  prepareSec: { min: 0, max: 60 },
  workSec: { min: 1, max: 600 },
  restSec: { min: 0, max: 600 },
  rounds: { min: 1, max: 99 },
} as const;

export const TABATA: TimerConfig = { prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 };

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export function normalizeConfig(raw: Partial<TimerConfig> | null | undefined): TimerConfig {
  return {
    prepareSec: clampInt(raw?.prepareSec, LIMITS.prepareSec.min, LIMITS.prepareSec.max, TABATA.prepareSec),
    workSec: clampInt(raw?.workSec, LIMITS.workSec.min, LIMITS.workSec.max, TABATA.workSec),
    restSec: clampInt(raw?.restSec, LIMITS.restSec.min, LIMITS.restSec.max, TABATA.restSec),
    rounds: clampInt(raw?.rounds, LIMITS.rounds.min, LIMITS.rounds.max, TABATA.rounds),
  };
}

// Cuenta previa, luego por ronda: trabajo y descanso. Después de la última ronda no hay descanso (el entrenamiento termina).
export function buildPhases(config: TimerConfig): Phase[] {
  const c = normalizeConfig(config);
  const phases: Phase[] = [];
  let t = 0;
  const push = (kind: PhaseKind, round: number, durationSec: number) => {
    if (durationSec <= 0) return;
    phases.push({ kind, round, durationSec, startSec: t });
    t += durationSec;
  };
  push('prepare', 0, c.prepareSec);
  for (let r = 1; r <= c.rounds; r++) {
    push('work', r, c.workSec);
    if (r < c.rounds) push('rest', r, c.restSec);
  }
  return phases;
}

export const totalSeconds = (config: TimerConfig) => {
  const phases = buildPhases(config);
  const last = phases[phases.length - 1];
  return last ? last.startSec + last.durationSec : 0;
};

export interface Position {
  done: boolean;
  phaseIndex: number;
  phase: Phase | null;
  phaseRemainingSec: number; // con decimales
  totalRemainingSec: number;
  elapsedSec: number;
  totalSec: number;
}

export function positionAt(config: TimerConfig, elapsedSec: number): Position {
  const phases = buildPhases(config);
  const totalSec = totalSeconds(config);
  const elapsed = Math.max(0, elapsedSec);
  if (elapsed >= totalSec) {
    return { done: true, phaseIndex: phases.length - 1, phase: phases[phases.length - 1] ?? null, phaseRemainingSec: 0, totalRemainingSec: 0, elapsedSec: totalSec, totalSec };
  }
  let index = phases.findIndex((p) => elapsed < p.startSec + p.durationSec);
  if (index < 0) index = phases.length - 1;
  const phase = phases[index];
  return { done: false, phaseIndex: index, phase, phaseRemainingSec: phase.startSec + phase.durationSec - elapsed, totalRemainingSec: totalSec - elapsed, elapsedSec: elapsed, totalSec };
}

// Estado del reloj: corriendo desde `startedAt` o en pausa con lo acumulado
export interface ClockState {
  startedAt: number | null;
  accumulatedMs: number;
}

export const elapsedSeconds = (clock: ClockState, now: number) => (clock.accumulatedMs + (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt))) / 1000;

export const start = (clock: ClockState, now: number): ClockState => (clock.startedAt === null ? { ...clock, startedAt: now } : clock);

export const pause = (clock: ClockState, now: number): ClockState =>
  clock.startedAt === null ? clock : { startedAt: null, accumulatedMs: clock.accumulatedMs + Math.max(0, now - clock.startedAt) };

export const IDLE_CLOCK: ClockState = { startedAt: null, accumulatedMs: 0 };

// 75 → "1:15"
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-9));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
