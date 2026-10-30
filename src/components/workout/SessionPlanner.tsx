import { Dumbbell, Link2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BTN_FILL } from '@/components/dashboard/brand';
import { planSummary } from '@/lib/workoutPlan';
import { cn } from '@/lib/utils';

export interface PlanCounts {
  single: number;
  super: number;
  tri: number;
}

const ROWS: { kind: keyof PlanCounts; title: string; hint: string; badge: string }[] = [
  { kind: 'single', title: 'Ejercicios individuales', hint: 'Un ejercicio, varias series', badge: '1' },
  { kind: 'super', title: 'Superseries', hint: 'Dos ejercicios seguidos, luego descanso', badge: '2' },
  { kind: 'tri', title: 'Triseries', hint: 'Tres ejercicios seguidos, luego descanso', badge: '3' },
];

interface SessionPlannerProps {
  counts: PlanCounts;
  busy?: boolean;
  onChange: (counts: PlanCounts) => void;
  onCreate: () => void;
}

// Primer paso del entrenamiento: cuántos ejercicios, superseries y triseries va a hacer hoy. Después los completa todos en una sola vista.
const SessionPlanner = ({ counts, busy, onChange, onCreate }: SessionPlannerProps) => {
  const total = counts.single + counts.super + counts.tri;
  const bump = (kind: keyof PlanCounts, delta: number) => onChange({ ...counts, [kind]: Math.max(0, Math.min(10, counts[kind] + delta)) });

  return (
    <section aria-labelledby="planner-title" className="rounded-[24px] border border-[#fff8e4]/10 bg-[linear-gradient(180deg,#272329,#1f1c21)] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#62b8cf]/35 bg-[#398ca2]/15 text-[#8fd0e0]"><Dumbbell className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h2 id="planner-title" className="text-lg font-extrabold tracking-tight text-[#fff8e4]">Arma tu sesión de hoy</h2>
          <p className="text-[13px] text-[#a8a295]">Elige cuántos harás. Después los completas todos en una sola vista.</p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {ROWS.map((r) => (
          <li key={r.kind} className="flex items-center gap-3 rounded-[18px] border border-[#fff8e4]/12 bg-[#181619]/60 p-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#62b8cf]/35 bg-[#398ca2]/15 text-lg font-extrabold text-[#8fd0e0]">{r.kind === 'single' ? r.badge : <Link2 className="h-5 w-5" aria-hidden="true" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#fff8e4]">{r.title}</span>
              <span className="block text-[12px] text-[#a8a295]">{r.hint}</span>
            </span>
            <span className="flex shrink-0 items-center">
              <button type="button" disabled={counts[r.kind] <= 0} onClick={() => bump(r.kind, -1)} aria-label={`Menos ${r.title.toLowerCase()}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><Minus className="h-5 w-5" aria-hidden="true" /></button>
              <span aria-live="polite" className={cn('w-8 text-center text-[1.5rem] font-extrabold tabular-nums', counts[r.kind] > 0 ? 'text-[#fff8e4]' : 'text-[#a8a295]')}>{counts[r.kind]}</span>
              <button type="button" disabled={counts[r.kind] >= 10} onClick={() => bump(r.kind, 1)} aria-label={`Más ${r.title.toLowerCase()}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><Plus className="h-5 w-5" aria-hidden="true" /></button>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 min-h-[20px] text-center text-[13px] text-[#cdc6b6]">{total > 0 ? <>Tu sesión: <span className="font-bold text-[#fff8e4]">{planSummary(counts)}</span></> : 'Suma al menos un bloque para empezar.'}</p>
      <Button disabled={total === 0 || busy} onClick={onCreate} className={cn('mt-2 min-h-[56px] w-full rounded-2xl text-base font-extrabold', BTN_FILL)}>Crear mi sesión</Button>
      <p className="mt-2 text-center text-[12px] text-[#a8a295]">Podrás agregar más bloques cuando quieras.</p>
    </section>
  );
};

export default SessionPlanner;
