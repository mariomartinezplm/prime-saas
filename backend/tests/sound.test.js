/**
 * PRUEBAS — pitidos de los cronómetros (src/lib/sound.ts): fin del descanso, fin de cada fase del Tabata y vibración.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const starts = [];
class FakeContext {
  constructor() { this.state = 'suspended'; this.currentTime = 10; this.destination = {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createOscillator() { const o = { frequency: {}, connect: (n) => n, start: (t) => starts.push({ freq: o.frequency.value, t }), stop() {} }; return o; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n }; }
}
const vibrate = vi.fn();
globalThis.window = { AudioContext: FakeContext };
Object.defineProperty(globalThis, 'navigator', { value: { vibrate }, configurable: true });

const { REST_DONE_TONES, phaseTones, FINISH_TONES, unlockAudio, playTones } = await import('../../src/lib/sound.ts');

describe('pitidos de los cronómetros', () => {
  beforeEach(() => { starts.length = 0; vibrate.mockClear(); });

  it('fin del descanso: tres pitidos, el último más agudo, y vibra', () => {
    unlockAudio();
    playTones(REST_DONE_TONES);
    expect(starts.map((s) => s.freq)).toEqual([880, 880, 1175]);
    expect(starts.map((s) => Math.round((s.t - 10) * 100) / 100)).toEqual([0, 0.32, 0.64]);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('cada fin de fase del Tabata suena dos veces; trabajo más agudo que descanso', () => {
    expect(phaseTones('work').map((t) => t.freq)).toEqual([1175, 1175]);
    expect(phaseTones('rest').map((t) => t.freq)).toEqual([660, 660]);
    expect(FINISH_TONES).toHaveLength(3);
  });

  it('sin vibración si se pide apagarla, y sin audio no falla', () => {
    unlockAudio();
    playTones(REST_DONE_TONES, { vibrate: false });
    expect(vibrate).not.toHaveBeenCalled();
    expect(() => playTones([])).not.toThrow();
  });
});
