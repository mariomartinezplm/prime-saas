import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Dumbbell, Info, Layers, Repeat, Timer, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BTN_FILL } from '@/components/dashboard/brand';
import { formatClock, spokenDuration } from '@/lib/workoutClock';
import type { WorkoutSummary } from '@/services/workoutService';
import { cn } from '@/lib/utils';

interface WorkoutFinishedProps {
  summary: WorkoutSummary;
  firstName?: string;
  onHome: () => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('es-CL') : n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));

const Tile = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) => (
  <div className={cn('rounded-[20px] border p-3.5', accent ? 'border-[#62b8cf]/40 bg-[linear-gradient(160deg,rgba(57,140,162,0.3),#1f1c21_70%)]' : 'border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)]')}>
    <div className="flex items-center gap-2 text-[#8fd0e0]">{icon}<span className="text-[12.5px] text-[#cdc6b6]">{label}</span></div>
    <p className="mt-2 text-[2rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#fff8e4]">{value}</p>
  </div>
);

// Pantalla final: reconoce el esfuerzo con personalidad, destaca la duración real y muestra SOLO lo guardado: ejercicios, series,
// repeticiones, tiempo y las marcas personales logradas. Sin tonelaje ni cifras inventadas.
const WorkoutFinished = ({ summary, firstName, onHome }: WorkoutFinishedProps) => {
  const reduce = useReducedMotion();
  const { totals, exercises, records } = summary;
  const hasSets = totals.sets > 0;
  const maxSets = Math.max(1, ...exercises.map((e) => e.sets));
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: reduce ? { duration: 0 } : { duration: 0.45, delay, ease: 'easeOut' as const } });
  const circumference = 2 * Math.PI * 52;
  const name = firstName ? `, ${firstName}` : '';

  return (
    <div className="mx-auto w-full max-w-md pb-6">
      <div className="relative overflow-hidden rounded-[28px] border border-[#62b8cf]/35 bg-[linear-gradient(170deg,rgba(57,140,162,0.36),#1f1c21_64%)] px-5 pb-6 pt-8 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-[#62b8cf]/30 blur-3xl" />
        <motion.div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center" initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0 } : { duration: 0.55, ease: 'easeOut' }}>
          <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,248,228,0.08)" strokeWidth="7" />
            <motion.circle cx="60" cy="60" r="52" fill="none" stroke="#62b8cf" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} initial={reduce ? { strokeDashoffset: 0 } : { strokeDashoffset: circumference }} animate={{ strokeDashoffset: 0 }} transition={reduce ? { duration: 0 } : { duration: 1.1, delay: 0.15, ease: 'easeInOut' }} />
          </svg>
          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[linear-gradient(160deg,#62b8cf,#2b6f82)] text-[#181619]"><Check className="h-10 w-10" strokeWidth={3} aria-hidden="true" /></span>
        </motion.div>

        <motion.h1 className="mt-5 font-serif text-[2.1rem] font-medium leading-[1.1] text-[#fff8e4]" {...rise(0.25)}>¡Entrenamiento completado!</motion.h1>
        <motion.p className="mt-2 text-[15px] leading-snug text-[#cdc6b6]" {...rise(0.32)}>
          {records.length > 0
            ? `Superaste tu marca${records.length > 1 ? ` en ${records.length} ejercicios` : ''}${name}. Eso es constancia hecha fuerza.`
            : hasSets
              ? `Buen trabajo${name}. Cada serie que registras construye tu evolución.`
              : `Gracias${name}. Terminaste tu sesión; esta vez no registraste series.`}
        </motion.p>

        <motion.div className="mt-6" {...rise(0.4)}>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-[#8fd0e0]">Duración real</p>
          <p className="mt-1.5 text-[3.9rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-[#fff8e4]" aria-label={spokenDuration(summary.durationSec)}>{formatClock(summary.durationSec, { alwaysHours: true })}</p>
        </motion.div>
      </div>

      {records.length > 0 && (
        <motion.section aria-labelledby="marcas" className="mt-3 space-y-2" {...rise(0.5)}>
          <h2 id="marcas" className="flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.14em] text-[#8fd0e0]"><Trophy className="h-4 w-4" aria-hidden="true" /> Nueva marca personal</h2>
          {records.map((r, i) => (
            <motion.div key={r.name} className="relative overflow-hidden rounded-[20px] border border-[#62b8cf]/45 bg-[linear-gradient(160deg,rgba(57,140,162,0.32),#1f1c21_72%)] p-4" initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.6 + i * 0.12 }}>
              <p className="text-[17px] font-extrabold tracking-tight text-[#fff8e4]">{r.name}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="flex items-center gap-3 text-[#cdc6b6]">
                  <div><p className="text-[11.5px]">Anterior</p><p className="text-[1.25rem] font-bold tabular-nums">{fmt(r.previous)} kg</p></div>
                  <ArrowRight className="h-4 w-4 text-[#8fd0e0]" aria-hidden="true" />
                  <div><p className="text-[11.5px] text-[#8fd0e0]">Nueva marca</p><p className="text-[1.75rem] font-extrabold leading-none tabular-nums text-[#fff8e4]">{fmt(r.current)} kg</p></div>
                </div>
                <span className="rounded-full border border-[#8fd0e0]/50 bg-[#398ca2]/30 px-2.5 py-1 text-[13px] font-extrabold tabular-nums text-[#fff8e4]">+{fmt(r.improvement)} kg</span>
              </div>
            </motion.div>
          ))}
        </motion.section>
      )}

      {hasSets ? (
        <>
          <motion.div className="mt-3 grid grid-cols-2 gap-2.5" {...rise(0.56)}>
            <Tile icon={<Dumbbell className="h-4 w-4" aria-hidden="true" />} label="Ejercicios" value={fmt(totals.exercises)} />
            <Tile icon={<Layers className="h-4 w-4" aria-hidden="true" />} label="Series" value={fmt(totals.sets)} />
            {totals.reps > 0 && <Tile icon={<Repeat className="h-4 w-4" aria-hidden="true" />} label="Repeticiones" value={fmt(totals.reps)} />}
            {totals.timeSec > 0 && <Tile icon={<Timer className="h-4 w-4" aria-hidden="true" />} label="Tiempo de trabajo" value={formatClock(totals.timeSec)} />}
            {records.length > 0 && <Tile accent icon={<Trophy className="h-4 w-4" aria-hidden="true" />} label="Marcas personales" value={fmt(records.length)} />}
          </motion.div>

          <motion.section aria-label="Por ejercicio" className="mt-3 overflow-hidden rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03]" {...rise(0.64)}>
            <ul className="divide-y divide-[#fff8e4]/10">
              {exercises.map((e) => (
                <li key={e.name} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 break-words text-[15.5px] font-bold leading-tight text-[#fff8e4]">{e.name}</p>
                    <p className="shrink-0 text-[13px] tabular-nums text-[#cdc6b6]">
                      {e.sets} {e.sets === 1 ? 'serie' : 'series'}
                      {e.bestWeight ? ` · hasta ${String(e.bestWeight).replace('.', ',')} ${e.unit}` : e.timeSec ? ` · ${e.timeSec} s` : ''}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#fff8e4]/10" aria-hidden="true">
                    <motion.div className="h-full rounded-full bg-[#62b8cf]" initial={reduce ? false : { width: 0 }} animate={{ width: `${(e.sets / maxSets) * 100}%` }} transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.75, ease: 'easeOut' }} />
                  </div>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      ) : (
        <motion.div className="mt-3 rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03] p-5 text-center" {...rise(0.5)}>
          <p className="font-bold text-[#fff8e4]">No hay series guardadas en esta sesión</p>
          <p className="mt-1 text-sm text-[#a8a295]">La próxima vez puedes buscar tus ejercicios y registrar cada serie para ver tu evolución.</p>
        </motion.div>
      )}

      <motion.div className="mt-4 space-y-2" {...rise(0.72)}>
        <Button asChild className={cn('min-h-[56px] w-full rounded-2xl text-base font-extrabold shadow-[0_10px_24px_-12px_rgba(98,184,207,0.8)]', BTN_FILL)}>
          <Link to="/app/ejercicios">Ver mi progreso</Link>
        </Button>
        <Button variant="outline" onClick={onHome} className="min-h-[50px] w-full rounded-2xl border-[#fff8e4]/25 bg-transparent text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
          Volver al inicio
        </Button>
        <p className="flex items-start gap-2 px-1 pt-2 text-[12px] leading-snug text-[#a8a295]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Es tu registro personal. La asistencia y el descuento de tu sesión los gestiona el centro.
        </p>
      </motion.div>
    </div>
  );
};

export default WorkoutFinished;
