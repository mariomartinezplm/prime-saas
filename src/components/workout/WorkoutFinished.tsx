import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Dumbbell, Info, Layers, Repeat, Timer, Weight } from 'lucide-react';
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

const fmt = (n: number, d = 0) => n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

const Tile = ({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) => (
  <div className="rounded-[20px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-3.5">
    <div className="flex items-center gap-2 text-[#8fd0e0]">{icon}<span className="text-[12.5px] text-[#cdc6b6]">{label}</span></div>
    <p className="mt-2 text-[2rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#fff8e4]">
      {value}
      {unit && <span className="ml-1 text-sm font-bold text-[#cdc6b6]">{unit}</span>}
    </p>
  </div>
);

// Pantalla final: reconoce el esfuerzo, muestra la duración real y SOLO lo que quedó guardado (nada inventado).
const WorkoutFinished = ({ summary, firstName, onHome }: WorkoutFinishedProps) => {
  const reduce = useReducedMotion();
  const { totals, exercises } = summary;
  const hasSets = totals.sets > 0;
  const maxSets = Math.max(1, ...exercises.map((e) => e.sets));
  const rise = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: reduce ? { duration: 0 } : { duration: 0.45, delay, ease: 'easeOut' as const } });
  const circumference = 2 * Math.PI * 52;

  return (
    <div className="mx-auto w-full max-w-md pb-6">
      <div className="relative overflow-hidden rounded-[28px] border border-[#62b8cf]/30 bg-[linear-gradient(170deg,rgba(57,140,162,0.32),#1f1c21_62%)] px-5 pb-6 pt-8 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#62b8cf]/25 blur-3xl" />
        <motion.div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center" initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? { duration: 0 } : { duration: 0.55, ease: 'easeOut' }}>
          <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,248,228,0.08)" strokeWidth="7" />
            <motion.circle cx="60" cy="60" r="52" fill="none" stroke="#62b8cf" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} initial={reduce ? { strokeDashoffset: 0 } : { strokeDashoffset: circumference }} animate={{ strokeDashoffset: 0 }} transition={reduce ? { duration: 0 } : { duration: 1.1, delay: 0.15, ease: 'easeInOut' }} />
          </svg>
          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[linear-gradient(160deg,#62b8cf,#2b6f82)] text-[#181619]"><Check className="h-10 w-10" strokeWidth={3} aria-hidden="true" /></span>
        </motion.div>

        <motion.h1 className="mt-5 font-serif text-[2rem] font-medium leading-tight text-[#fff8e4]" {...rise(0.25)}>¡Entrenamiento completado!</motion.h1>
        <motion.p className="mt-1.5 text-[15px] text-[#cdc6b6]" {...rise(0.32)}>{hasSets ? `Buen trabajo${firstName ? `, ${firstName}` : ''}. Tu sesión quedó registrada en tu historial.` : `Gracias${firstName ? `, ${firstName}` : ''}. Terminaste tu sesión; no registraste series esta vez.`}</motion.p>

        <motion.div className="mt-6" {...rise(0.4)}>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]">Duración real</p>
          <p className="mt-1.5 text-[3.6rem] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-[#fff8e4]" aria-label={spokenDuration(summary.durationSec)}>{formatClock(summary.durationSec, { alwaysHours: true })}</p>
        </motion.div>
      </div>

      {hasSets ? (
        <>
          <motion.div className="mt-3 grid grid-cols-2 gap-2.5" {...rise(0.5)}>
            <Tile icon={<Dumbbell className="h-4 w-4" aria-hidden="true" />} label="Ejercicios" value={fmt(totals.exercises)} />
            <Tile icon={<Layers className="h-4 w-4" aria-hidden="true" />} label="Series" value={fmt(totals.sets)} />
            {totals.reps > 0 && <Tile icon={<Repeat className="h-4 w-4" aria-hidden="true" />} label="Repeticiones" value={fmt(totals.reps)} />}
            {totals.volumeTons !== null && <Tile icon={<Weight className="h-4 w-4" aria-hidden="true" />} label="Volumen con carga" value={fmt(totals.volumeTons, 2)} unit="ton" />}
            {totals.timeSec > 0 && <Tile icon={<Timer className="h-4 w-4" aria-hidden="true" />} label="Tiempo de trabajo" value={formatClock(totals.timeSec)} />}
          </motion.div>
          {totals.volumeExcludesLbs && <p className="mt-1.5 px-1 text-[12px] text-[#a8a295]">El volumen no incluye las series en libras: no se convierten.</p>}

          <motion.section aria-label="Por ejercicio" className="mt-3 overflow-hidden rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.03]" {...rise(0.58)}>
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
                    <motion.div className="h-full rounded-full bg-[#62b8cf]" initial={reduce ? false : { width: 0 }} animate={{ width: `${(e.sets / maxSets) * 100}%` }} transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.7, ease: 'easeOut' }} />
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

      <motion.div className="mt-4 space-y-2" {...rise(0.66)}>
        <Button asChild className={cn('min-h-[56px] w-full rounded-2xl text-base font-extrabold', BTN_FILL)}>
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
