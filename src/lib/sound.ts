// Pitidos de los cronómetros (descanso del entrenamiento y Tabata). Se generan en el dispositivo con Web Audio: sin archivos de sonido.
// Los navegadores del teléfono solo dejan sonar el audio después de que la persona toca la pantalla: por eso `unlockAudio()` se llama
// con el primer toque (y en cada toque, por si el teléfono lo suspendió al bloquear la pantalla).

export interface Tone {
  freq: number;
  ms: number;
  at: number; // segundos desde que se pide el sonido
}

// Fin de un descanso: tres pitidos claros y ascendentes
export const REST_DONE_TONES: Tone[] = [
  { freq: 880, ms: 220, at: 0 },
  { freq: 880, ms: 220, at: 0.32 },
  { freq: 1175, ms: 520, at: 0.64 },
];
// Cada fin de fase del Tabata (trabajo ↔ descanso): dos pitidos; el de trabajo es más agudo para distinguirlo sin mirar
export const phaseTones = (next: 'work' | 'rest' | 'prepare'): Tone[] => {
  const freq = next === 'work' ? 1175 : 660;
  return [{ freq, ms: 220, at: 0 }, { freq, ms: 380, at: 0.3 }];
};
export const COUNTDOWN_TONES: Tone[] = [{ freq: 784, ms: 120, at: 0 }];
// Fin del Tabata completo
export const FINISH_TONES: Tone[] = [
  { freq: 880, ms: 200, at: 0 },
  { freq: 880, ms: 200, at: 0.3 },
  { freq: 1175, ms: 600, at: 0.6 },
];

let context: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!context) context = new Ctx();
    if (context.state !== 'running') context.resume().catch(() => undefined);
  } catch {
    /* sin audio: los cronómetros siguen funcionando */
  }
}

export function playTones(tones: Tone[], { vibrate = true }: { vibrate?: boolean } = {}): void {
  try {
    if (context && context.state !== 'running') context.resume().catch(() => undefined);
    if (context) {
      const ctx = context;
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // se oye más fuerte y clara que una onda pura en el parlante del teléfono
        osc.frequency.value = tone.freq;
        const t0 = ctx.currentTime + tone.at;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.8, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.ms / 1000);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + tone.ms / 1000 + 0.05);
      }
    }
    if (vibrate) navigator.vibrate?.(tones.length > 1 ? [180, 90, 180] : 120);
  } catch {
    /* sin audio */
  }
}
