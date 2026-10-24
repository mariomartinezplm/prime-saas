import { describe, it, expect } from 'vitest';
import { buildPhases, totalSeconds, positionAt, normalizeConfig, elapsedSeconds, start, pause, IDLE_CLOCK, formatClock, TABATA } from '../../src/lib/intervalTimer.ts';

describe('cronómetro Tabata', () => {
  it('Tabata clásico: 10 s de cuenta previa + 8 × 20 s de trabajo + 7 × 10 s de descanso = 240 s (sin descanso tras la última ronda)', () => {
    expect(totalSeconds(TABATA)).toBe(10 + 8 * 20 + 7 * 10);
    const phases = buildPhases(TABATA);
    expect(phases).toHaveLength(1 + 8 + 7);
    expect(phases[phases.length - 1].kind).toBe('work');
  });

  it('sin cuenta previa ni descanso: solo trabajo', () => {
    const phases = buildPhases({ prepareSec: 0, workSec: 30, restSec: 0, rounds: 3 });
    expect(phases.map((p) => p.kind)).toEqual(['work', 'work', 'work']);
    expect(totalSeconds({ prepareSec: 0, workSec: 30, restSec: 0, rounds: 3 })).toBe(90);
  });

  it('ubica la fase y lo que queda según los segundos transcurridos', () => {
    expect(positionAt(TABATA, 0)).toMatchObject({ phase: { kind: 'prepare' }, phaseRemainingSec: 10, totalRemainingSec: 240 });
    expect(positionAt(TABATA, 10)).toMatchObject({ phase: { kind: 'work', round: 1 }, phaseRemainingSec: 20 });
    expect(positionAt(TABATA, 35)).toMatchObject({ phase: { kind: 'rest', round: 1 }, phaseRemainingSec: 5 });
    expect(positionAt(TABATA, 40)).toMatchObject({ phase: { kind: 'work', round: 2 } });
    expect(positionAt(TABATA, 239.5)).toMatchObject({ phase: { kind: 'work', round: 8 }, done: false });
    expect(positionAt(TABATA, 240).done).toBe(true);
    expect(positionAt(TABATA, 9999).totalRemainingSec).toBe(0);
  });

  it('el tiempo sale de la hora de inicio: pausar conserva lo acumulado y reanudar continúa (nada depende de intervalos)', () => {
    let clock = start(IDLE_CLOCK, 1000);
    expect(elapsedSeconds(clock, 4000)).toBe(3);
    clock = pause(clock, 4000);
    expect(elapsedSeconds(clock, 99000)).toBe(3); // en pausa no avanza
    clock = start(clock, 100000);
    expect(elapsedSeconds(clock, 102500)).toBe(5.5);
  });

  it('valida y acota los valores', () => {
    expect(normalizeConfig({ workSec: 0, restSec: -5, rounds: 500, prepareSec: 999 })).toEqual({ prepareSec: 60, workSec: 1, restSec: 0, rounds: 99 });
    expect(normalizeConfig(null)).toEqual(TABATA);
    expect(normalizeConfig({ workSec: NaN })).toMatchObject({ workSec: 20 });
  });

  it('formato mm:ss redondea hacia arriba', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(0.2)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });
});
