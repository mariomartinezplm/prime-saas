import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkout } from '@/hooks/useWorkout';
import { BTN_FILL, HERO_SURFACE } from '@/components/dashboard/brand';
import { elapsedSec, formatClock, restDisplayState, restRemainingSec, spokenDuration } from '@/lib/workoutClock';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

const newClientId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Solo un indicador de forma («había tarjeta la última vez»): sirve para reservar el espacio y que Inicio no dé saltos al cargar.
// No contiene ningún dato de salud.
const FLAG = 'prime-workout-card';
const readFlag = (): 'active' | 'start' | null => {
  try {
    const v = sessionStorage.getItem(FLAG);
    return v === 'active' || v === 'start' ? v : null;
  } catch {
    return null;
  }
};
const writeFlag = (v: 'active' | 'start' | null) => {
  try {
    if (v) sessionStorage.setItem(FLAG, v);
    else sessionStorage.removeItem(FLAG);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

// Entrada al entrenamiento desde Inicio.
//  · Con una sesión ACTIVA: tarjeta protagonista «Entrenamiento en curso» (tiempo, descanso y «Continuar entrenamiento»). Nunca ofrece
//    «Iniciar» ni crea otra sesión.
//  · Sin sesión pero con una cita de entrenamiento en la ventana permitida: «Iniciar entrenamiento». Estar dentro del horario no
//    inicia nada: empieza al pulsar.
const WorkoutEntryCard = () => {
  const w = useWorkout();
  const navigate = useNavigate();
  const [key] = useState(newClientId);
  const [flag] = useState(readFlag);

  const state: 'active' | 'start' | null = w.status !== 'ready' ? null : w.session ? 'active' : w.startable ? 'start' : null;
  useEffect(() => {
    if (w.status === 'ready') writeFlag(state);
  }, [w.status, state]);

  // Cargando: si la última vez había tarjeta, se reserva su espacio (sin parpadeos); si no, no se muestra nada
  if (w.status !== 'ready') {
    if (flag === 'active') return <div aria-hidden="true" className="h-[224px] animate-pulse rounded-[24px] border border-[#398ca2]/20 bg-[#398ca2]/[0.06] motion-reduce:animate-none" />;
    if (flag === 'start') return <div aria-hidden="true" className="h-[168px] animate-pulse rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] motion-reduce:animate-none" />;
    return null;
  }

  if (w.session) {
    const { session } = w;
    const elapsed = elapsedSec(session.startedAt, w.now, w.offsetMs);
    const rest = restDisplayState(session.rest, w.now, w.offsetMs);
    const remaining = restRemainingSec(session.rest, w.now, w.offsetMs);
    const sets = session.sets.length;
    const exercises = new Set(session.sets.map((s) => s.exerciseName.toLowerCase())).size;
    return (
      <section aria-labelledby="entreno-titulo" className={cn('relative overflow-hidden rounded-[24px] border p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300', HERO_SURFACE)}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#62b8cf]/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]">
            <span className="h-2 w-2 rounded-full bg-[#62b8cf] shadow-[0_0_0_4px_rgba(98,184,207,0.2)] motion-safe:animate-pulse" aria-hidden="true" />
            En curso
          </p>
          {(rest === 'running' || rest === 'paused') && (
            <span className="flex items-center gap-1.5 rounded-full border border-[#62b8cf]/40 bg-[#181619]/50 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[#fff8e4]">
              <Timer className="h-3.5 w-3.5 text-[#8fd0e0]" aria-hidden="true" />
              {rest === 'paused' ? 'Descanso en pausa' : 'Descanso'} {formatClock(remaining)}
            </span>
          )}
          {rest === 'done' && <span className="rounded-full border border-[#8fd0e0]/50 bg-[#398ca2]/25 px-2.5 py-1 text-[12px] font-semibold text-[#fff8e4]">Descanso terminado</span>}
        </div>
        <h2 id="entreno-titulo" className="relative mt-2 text-lg font-bold tracking-tight text-[#fff8e4]">Tu entrenamiento está en curso</h2>
        <p className="relative mt-1 text-[3.25rem] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-[#fff8e4]" role="timer" aria-label={`Tiempo de entrenamiento: ${spokenDuration(elapsed)}`}>{formatClock(elapsed, { alwaysHours: true })}</p>
        <p className="relative mt-1.5 text-[13px] text-[#cdc6b6]">{sets > 0 ? `${exercises} ${exercises === 1 ? 'ejercicio' : 'ejercicios'} · ${sets} ${sets === 1 ? 'serie guardada' : 'series guardadas'}` : 'Todavía no registras ejercicios'}</p>
        <Button asChild className={cn('relative mt-3.5 min-h-[56px] w-full rounded-2xl text-base font-extrabold shadow-[0_10px_24px_-12px_rgba(98,184,207,0.8)]', BTN_FILL)}>
          <Link to="/app/entrenamiento">
            Continuar entrenamiento
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    );
  }

  if (!w.startable) return null;
  const soon = w.startable.phase === 'soon';
  return (
    <section aria-labelledby="entreno-titulo" className="space-y-3 rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <h2 id="entreno-titulo" className="text-xl font-bold tracking-tight text-[#fff8e4]">{soon ? 'Tu sesión está por comenzar' : 'Tu sesión está en curso'}</h2>
      <p className="text-sm text-[#cdc6b6]">Tu cronómetro empieza cuando tú lo inicias.</p>
      <Button
        disabled={w.busy}
        onClick={async () => {
          try {
            await w.start(w.startable!.appointmentId, key);
            navigate('/app/entrenamiento');
          } catch (err) {
            if ((err as Error)?.message !== 'busy') showApiError(err, 'No se pudo iniciar tu entrenamiento');
          }
        }}
        className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}
      >
        <Play aria-hidden="true" />
        Iniciar entrenamiento
      </Button>
    </section>
  );
};

export default WorkoutEntryCard;
