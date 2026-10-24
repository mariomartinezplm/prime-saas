import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, Save, Square, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  IDLE_CLOCK, LIMITS, TABATA, elapsedSeconds, formatClock, normalizeConfig, pause, positionAt, start, totalSeconds,
  type ClockState, type PhaseKind, type TimerConfig,
} from '@/lib/intervalTimer';

interface Routine { id: string; name: string; config: TimerConfig }

const PRESETS: Routine[] = [
  { id: 'tabata', name: 'Tabata clásico · 20/10 × 8', config: TABATA },
  { id: '40-20', name: 'Intervalos 40/20 × 10', config: { prepareSec: 10, workSec: 40, restSec: 20, rounds: 10 } },
  { id: '45-15', name: 'Circuito 45/15 × 8', config: { prepareSec: 10, workSec: 45, restSec: 15, rounds: 8 } },
];

const FIELDS: { key: keyof TimerConfig; label: string; unit: string; step: number }[] = [
  { key: 'workSec', label: 'Trabajo', unit: 's', step: 5 },
  { key: 'restSec', label: 'Descanso', unit: 's', step: 5 },
  { key: 'rounds', label: 'Rondas', unit: '', step: 1 },
  { key: 'prepareSec', label: 'Cuenta previa', unit: 's', step: 5 },
];

const PHASE_UI: Record<PhaseKind | 'done', { label: string; shell: string; text: string }> = {
  prepare: { label: 'Prepárate', shell: 'border-[#fff8e4]/20 bg-[linear-gradient(180deg,#2a262c,#1f1c21)]', text: 'text-[#fff8e4]' },
  work: { label: 'Trabajo', shell: 'border-[#62b8cf]/60 bg-[linear-gradient(180deg,#2b7487,#1c4552)]', text: 'text-[#fff8e4]' },
  rest: { label: 'Descanso', shell: 'border-[#fff8e4]/15 bg-[linear-gradient(180deg,#232025,#181619)]', text: 'text-[#8fd0e0]' },
  done: { label: 'Listo', shell: 'border-[#62b8cf]/50 bg-[linear-gradient(180deg,#26303a,#181619)]', text: 'text-[#fff8e4]' },
};

const readRoutines = (key: string): Routine[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.name === 'string').map((r) => ({ id: String(r.id), name: r.name.slice(0, 40), config: normalizeConfig(r.config) })) : [];
  } catch {
    return [];
  }
};

const Timer = () => {
  const { user } = useAuth();
  const storageKey = `prime.cronometro.${(user as { id?: string; _id?: string } | null)?.id ?? (user as { _id?: string } | null)?._id ?? 'anon'}`;
  const [config, setConfig] = useState<TimerConfig>(TABATA);
  const [clock, setClock] = useState<ClockState>(IDLE_CLOCK);
  const [running, setRunning] = useState(false);
  const [began, setBegan] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const [routines, setRoutines] = useState<Routine[]>(() => readRoutines(storageKey));
  const [routineName, setRoutineName] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const lastCue = useRef<{ phase: number; sec: number; done: boolean } | null>(null);

  const total = useMemo(() => totalSeconds(config), [config]);
  const pos = positionAt(config, began ? elapsedSeconds(clock, now) : 0);
  const ui = began ? (pos.done ? PHASE_UI.done : PHASE_UI[pos.phase?.kind ?? 'work']) : PHASE_UI.prepare;

  // Se redibuja a 10 veces por segundo, pero el tiempo sale de la hora de inicio: si la pestaña se duerme, al volver sigue correcto.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [running]);

  const beep = useCallback((freq: number, ms: number, delay = 0) => {
    const ctx = audioRef.current;
    if (!sound || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + ms / 1000 + 0.05);
    } catch { /* sin audio: el cronómetro sigue funcionando */ }
  }, [sound]);

  // Avisos: pitido corto en los últimos 3 s de cada fase, uno largo al cambiar de fase, tres al terminar
  useEffect(() => {
    if (!began || !running) return;
    const sec = Math.ceil(pos.phaseRemainingSec);
    const prev = lastCue.current;
    lastCue.current = { phase: pos.phaseIndex, sec, done: pos.done };
    if (!prev) return;
    if (pos.done && !prev.done) { beep(880, 200); beep(880, 200, 0.3); beep(1175, 500, 0.6); return; }
    if (pos.phaseIndex !== prev.phase) { beep(pos.phase?.kind === 'work' ? 1175 : 660, 450); return; }
    if (sec !== prev.sec && sec >= 1 && sec <= 3) beep(784, 120);
  }, [began, running, pos.phaseIndex, pos.phaseRemainingSec, pos.done, pos.phase?.kind, beep]);

  useEffect(() => {
    if (pos.done && running) setRunning(false);
  }, [pos.done, running]);

  // Mantener la pantalla encendida mientras corre (si el navegador lo permite)
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const take = () => nav.wakeLock?.request('screen').then((l) => { wakeRef.current = l; }).catch(() => undefined);
    if (running) {
      take();
      const onVisible = () => { if (document.visibilityState === 'visible') take(); };
      document.addEventListener('visibilitychange', onVisible);
      return () => { document.removeEventListener('visibilitychange', onVisible); wakeRef.current?.release().catch(() => undefined); wakeRef.current = null; };
    }
    return undefined;
  }, [running]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => { setRoutines(readRoutines(storageKey)); }, [storageKey]);

  const persist = (next: Routine[]) => {
    setRoutines(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* sin almacenamiento: no se guardan rutinas */ }
  };

  const unlockAudio = () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !audioRef.current) audioRef.current = new Ctx();
      audioRef.current?.resume().catch(() => undefined);
    } catch { /* ignorar */ }
  };

  const begin = () => {
    unlockAudio();
    lastCue.current = null;
    const t = Date.now();
    setNow(t);
    setClock(start(IDLE_CLOCK, t));
    setBegan(true);
    setRunning(true);
  };
  const toggle = () => {
    unlockAudio();
    const t = Date.now();
    setNow(t);
    setClock((c) => (running ? pause(c, t) : start(c, t)));
    setRunning((r) => !r);
  };
  const reset = () => { setClock(IDLE_CLOCK); setBegan(false); setRunning(false); lastCue.current = null; };
  const restart = () => { reset(); window.setTimeout(begin, 0); };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else stageRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const change = (key: keyof TimerConfig, delta: number) => {
    const lim = LIMITS[key];
    setConfig((c) => ({ ...c, [key]: Math.min(lim.max, Math.max(lim.min, c[key] + delta)) }));
  };

  const saveRoutine = () => {
    const name = routineName.trim().slice(0, 40);
    if (!name) return;
    persist([...routines.filter((r) => r.name !== name), { id: `r${Date.now()}`, name, config }]);
    setRoutineName('');
  };

  const bigDigits = began ? formatClock(pos.done ? 0 : pos.phaseRemainingSec) : formatClock(config.prepareSec || config.workSec);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
      <header className="space-y-1 pt-1">
        <h1 className="font-serif text-[2rem] font-medium leading-[1.1] text-[#fff8e4] sm:text-[2.5rem]">Cronómetro</h1>
        <p className="text-[14px] text-[#cdc6b6]">Intervalos de trabajo y descanso con tiempo total. Ideal para Tabata y circuitos, también en una tablet o pantalla del centro.</p>
      </header>

      <div ref={stageRef} className={cn(fullscreen && 'flex min-h-svh flex-col justify-center bg-[#181619] p-4')}>
        {began ? (
          <section aria-label="Cronómetro en marcha" className={cn('rounded-[26px] border p-5 text-center shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] sm:p-8', ui.shell)}>
            <p className={cn('text-[1.1rem] font-extrabold uppercase tracking-[0.3em]', ui.text)} aria-live="polite">{ui.label}</p>
            <p className="mt-1 text-[14px] text-[#cdc6b6]">{pos.done ? `${config.rounds} rondas completadas` : pos.phase && pos.phase.round > 0 ? `Ronda ${pos.phase.round} de ${config.rounds}` : 'Comienza en…'}</p>
            <p role="timer" aria-label={`${bigDigits} restantes en esta fase`} className={cn('my-2 font-extrabold leading-none tracking-[-0.05em] tabular-nums', ui.text, fullscreen ? 'text-[clamp(7rem,30vw,22rem)]' : 'text-[clamp(5.5rem,24vw,11rem)]')}>{bigDigits}</p>
            <div className="mx-auto max-w-md space-y-1.5">
              <div className="h-2.5 overflow-hidden rounded-full bg-[#fff8e4]/12" role="progressbar" aria-label="Avance total" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((pos.elapsedSec / Math.max(1, pos.totalSec)) * 100)}>
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#398ca2,#8fd0e0)]" style={{ width: `${(pos.elapsedSec / Math.max(1, pos.totalSec)) * 100}%` }} />
              </div>
              <p className="flex justify-between text-[13px] tabular-nums text-[#cdc6b6]"><span>Total {formatClock(pos.totalSec)}</span><span>Quedan <b className="text-[#fff8e4]">{formatClock(pos.totalRemainingSec)}</b></span></p>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {!pos.done && (
                <button type="button" onClick={toggle} className="flex min-h-[52px] min-w-[9.5rem] items-center justify-center gap-2 rounded-2xl bg-[#398ca2] px-6 text-[16px] font-bold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] active:scale-[0.98]">
                  {running ? <><Pause className="h-5 w-5" aria-hidden="true" /> Pausar</> : <><Play className="h-5 w-5" aria-hidden="true" /> Reanudar</>}
                </button>
              )}
              <button type="button" onClick={restart} className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-[#fff8e4]/25 px-4 text-[15px] font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Reiniciar</button>
              <button type="button" onClick={reset} className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-[#fff8e4]/25 px-4 text-[15px] font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><Square className="h-4 w-4" aria-hidden="true" /> Detener</button>
              <button type="button" onClick={() => setSound((s) => !s)} aria-pressed={sound} aria-label={sound ? 'Silenciar avisos' : 'Activar avisos de sonido'} className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border border-[#fff8e4]/25 text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">{sound ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}</button>
              <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border border-[#fff8e4]/25 text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">{fullscreen ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}</button>
            </div>
          </section>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <section aria-label="Configurar intervalos" className="rounded-[22px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-4 sm:p-5 lg:col-span-3">
              <h2 className="text-[16px] font-bold text-[#fff8e4]">Configura tu intervalo</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="rounded-2xl border border-[#fff8e4]/10 bg-[#181619]/60 p-3">
                    <p className="text-[12.5px] text-[#a8a295]">{f.label}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <button type="button" aria-label={`Menos ${f.label.toLowerCase()}`} onClick={() => change(f.key, -f.step)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#62b8cf]/35 text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] active:bg-[#62b8cf]/15"><Minus className="h-5 w-5" aria-hidden="true" /></button>
                      <p className="min-w-[3.2rem] text-center text-[1.6rem] font-extrabold tabular-nums leading-none text-[#fff8e4]" aria-live="polite">{config[f.key]}<span className="ml-0.5 text-[13px] font-semibold text-[#a8a295]">{f.unit}</span></p>
                      <button type="button" aria-label={`Más ${f.label.toLowerCase()}`} onClick={() => change(f.key, f.step)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#62b8cf]/35 text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] active:bg-[#62b8cf]/15"><Plus className="h-5 w-5" aria-hidden="true" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-2xl border border-[#62b8cf]/30 bg-[#398ca2]/15 px-4 py-3 text-[14px] text-[#cdc6b6]">Tiempo total: <b className="text-[1.15rem] tabular-nums text-[#fff8e4]">{formatClock(total)}</b> · {config.rounds} {config.rounds === 1 ? 'ronda' : 'rondas'} de {config.workSec} s de trabajo{config.restSec > 0 ? ` y ${config.restSec} s de descanso` : ''}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={begin} className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#398ca2] px-6 text-[16px] font-bold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] active:scale-[0.98] sm:flex-none"><Play className="h-5 w-5" aria-hidden="true" /> Iniciar</button>
                <button type="button" onClick={() => setSound((s) => !s)} aria-pressed={sound} className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-[#fff8e4]/25 px-4 text-[14px] font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">{sound ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />} Sonido {sound ? 'activado' : 'apagado'}</button>
              </div>
            </section>

            <section aria-label="Rutinas" className="rounded-[22px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-4 sm:p-5 lg:col-span-2">
              <h2 className="text-[16px] font-bold text-[#fff8e4]">Rutinas</h2>
              <ul className="mt-3 space-y-2">
                {[...PRESETS, ...routines].map((r) => {
                  const saved = routines.some((x) => x.id === r.id);
                  return (
                    <li key={r.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => setConfig(r.config)} className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-[#fff8e4]/12 bg-[#181619]/50 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4] active:bg-[#62b8cf]/12">
                        <span className="block truncate text-[14px] font-semibold text-[#fff8e4]">{r.name}</span>
                        <span className="block text-[12px] text-[#a8a295]">{r.config.workSec}/{r.config.restSec} s · {r.config.rounds} rondas · {formatClock(totalSeconds(r.config))}</span>
                      </button>
                      {saved && <button type="button" aria-label={`Borrar rutina ${r.name}`} onClick={() => persist(routines.filter((x) => x.id !== r.id))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#e8b4a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
                    </li>
                  );
                })}
              </ul>
              <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); saveRoutine(); }}>
                <label className="sr-only" htmlFor="routine-name">Nombre de la rutina</label>
                <input id="routine-name" value={routineName} onChange={(e) => setRoutineName(e.target.value)} maxLength={40} placeholder="Guardar esta como…" className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-[#fff8e4]/20 bg-[#181619] px-3 text-[14px] text-[#fff8e4] placeholder:text-[#a8a295] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]" />
                <button type="submit" disabled={!routineName.trim()} className="flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#62b8cf]/45 px-3 text-[14px] font-semibold text-[#fff8e4] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><Save className="h-4 w-4" aria-hidden="true" /> Guardar</button>
              </form>
              <p className="mt-2 text-[12px] text-[#a8a295]">Tus rutinas se guardan solo en este dispositivo.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timer;
