import { CalendarCheck } from 'lucide-react';
import { CARD, EYEBROW_SOFT, Meter } from '@/components/dashboard/brand';
import { cn } from '@/lib/utils';
import type { WeeklyGoal } from '@/services/achievementService';

const DAY_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDay = (iso: string) => `${Number(iso.slice(8, 10))} ${DAY_NAMES[Number(iso.slice(5, 7)) - 1]}`;

// Objetivo de la semana: calculado con el plan (sesiones del mes ÷ 4). Sin objetivo o en pausa autorizada no se muestra nada:
// no se pide ni se castiga. Solo cuentan las sesiones completadas; las agendadas se informan aparte.
const WeeklyGoalCard = ({ weekly }: { weekly?: WeeklyGoal }) => {
  if (!weekly || weekly.state !== 'active') return null;
  const { target, completed, scheduled, met } = weekly;
  const shown = Math.min(completed, target);
  const remaining = Math.max(0, target - completed);
  const label = `${shown} de ${target} ${target === 1 ? 'sesión' : 'sesiones'} esta semana`;

  return (
    <section aria-labelledby="objetivo-semanal" className={cn(CARD, 'space-y-3 p-5')}>
      <div className="flex items-center justify-between gap-3">
        <p id="objetivo-semanal" className={EYEBROW_SOFT}>Objetivo de esta semana</p>
        <span className="text-xs text-[#a8a295] tabular-nums">{shortDay(weekly.weekStart)} – {shortDay(weekly.weekEnd)}</span>
      </div>
      <p className="flex items-baseline gap-2 text-[#fff8e4]">
        <span className="text-[3rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{shown}</span>
        <span className="text-base font-semibold text-[#cdc6b6]">de {target} {target === 1 ? 'sesión' : 'sesiones'}</span>
      </p>
      <Meter ratio={target > 0 ? shown / target : 0} label={label} animateKey={`semana:${weekly.weekStart}`} />
      <p className="flex items-start gap-2 text-sm text-[#cdc6b6]">
        <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#62b8cf]" aria-hidden="true" />
        <span>
          {met
            ? 'Cumpliste el objetivo de esta semana. Gracias por tu constancia.'
            : `${remaining === 1 ? 'Te falta 1 sesión' : `Te faltan ${remaining} sesiones`}${scheduled > 0 ? ` · ya tienes ${scheduled} agendada${scheduled === 1 ? '' : 's'}` : ''}. Si hoy toca descansar, descansar también cuenta.`}
        </span>
      </p>
    </section>
  );
};

export default WeeklyGoalCard;
