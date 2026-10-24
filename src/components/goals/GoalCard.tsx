import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Clock, Pause, Play, Plus, ShieldCheck, Star, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Meter, CARD, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import GoalIcon from '@/components/goals/GoalIcon';
import GoalTrend from '@/components/goals/GoalTrend';
import { changeText, dayLabel, directionText, evolutionLink, formatValue, paramsText, statusLabel } from '@/lib/goals';
import { cn } from '@/lib/utils';
import type { CatalogCategory, GoalSources, GoalView, IndicatorProgress } from '@/services/goalService';

interface GoalCardProps {
  goal: GoalView;
  category?: CatalogCategory;
  sources?: GoalSources | null;
  variant: 'primary' | 'secondary';
  // Solo el paciente dueño registra valores y cambia el estado; la vista del profesional los ve sin esas acciones
  canAct?: boolean;
  onCheckin?: (goal: GoalView, indicator: IndicatorProgress) => void;
  onPause?: (goal: GoalView) => void;
  onResume?: (goal: GoalView) => void;
}

const TONE: Record<string, string> = {
  validated: 'border-[#62b8cf]/50 bg-[#398ca2]/20 text-[#fff8e4]',
  pending: 'border-[#fff8e4]/35 bg-[#fff8e4]/[0.06] text-[#fff8e4]',
  own: 'border-[#fff8e4]/25 text-[#cdc6b6]',
  paused: 'border-[#fff8e4]/25 text-[#cdc6b6]',
  done: 'border-[#62b8cf]/60 bg-[#398ca2]/25 text-[#fff8e4]',
};

export const StatusPill = ({ goal }: { goal: GoalView }) => {
  const s = statusLabel(goal);
  const Icon = s.tone === 'validated' ? ShieldCheck : s.tone === 'pending' ? Clock : s.tone === 'done' ? Star : UserRound;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', TONE[s.tone])}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {s.text}
    </span>
  );
};

const Stat = ({ label, value, big }: { label: string; value: string; big?: boolean }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a8a295]">{label}</p>
    <p className={cn('mt-0.5 font-extrabold leading-tight tracking-tight tabular-nums text-[#fff8e4]', big ? 'whitespace-nowrap text-[1.5rem]' : 'text-[1.05rem]')}>{value}</p>
  </div>
);

// Un indicador del objetivo: de dónde partió, dónde está, su meta y cuánto falta
const IndicatorBlock = ({ goal, ind, category, sources, canAct, onCheckin, hero }: { goal: GoalView; ind: IndicatorProgress; category?: CatalogCategory; sources?: GoalSources | null; canAct?: boolean; onCheckin?: GoalCardProps['onCheckin']; hero: boolean }) => {
  const detail = paramsText(ind, category, sources);
  const link = evolutionLink(ind);
  const ratio = (ind.percent ?? 0) / 100;
  const change = changeText(ind);
  const awaiting = ind.state === 'needs_target' ? 'Tu kinesiólogo definirá la meta.' : ind.state === 'needs_baseline' ? (ind.manual ? 'Registra tu primer valor para fijar tu punto de partida.' : 'Primero necesitamos registrar tu punto de partida.') : null;
  return (
    <div className="space-y-3">
      <div>
        <h3 className={cn('font-extrabold leading-tight tracking-tight text-[#fff8e4]', hero ? 'text-[1.35rem]' : 'text-[1.05rem]')}>{detail || ind.label}</h3>
        <p className="mt-0.5 text-[12.5px] text-[#a8a295]">
          {detail ? `${ind.label} · ` : ''}{directionText(ind.direction)}{ind.origin === 'autorreporte' ? ' · Autorreporte' : ind.origin === 'profesional' ? ' · Evaluación de tu kinesiólogo' : ''}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Inicio" value={ind.baseline ? formatValue(ind.baseline.value, ind.unit) : '—'} />
        <Stat label="Actual" value={ind.current ? formatValue(ind.current.value, ind.unit) : '—'} big={hero} />
        <Stat label="Meta" value={ind.target ? formatValue(ind.target.value, ind.unit) : '—'} />
      </dl>
      {ind.percent !== null ? (
        <div className="space-y-1.5">
          <Meter ratio={ratio} label={`Avance de ${detail || ind.label}: ${ind.percent} %`} />
          <p className="text-[13px] text-[#cdc6b6]">
            <b className="text-[#fff8e4]">{ind.percent} %</b>
            {ind.remaining !== null && ind.remaining > 0 ? ` · te faltan ${formatValue(ind.remaining, ind.unit)}` : ind.reached ? ' · llegaste a tu meta' : ''}
          </p>
        </div>
      ) : (
        awaiting && <p className="rounded-xl border border-dashed border-[#fff8e4]/20 p-3 text-[13px] text-[#cdc6b6]">{awaiting}</p>
      )}
      {hero && ind.points.length > 0 && <GoalTrend progress={ind} />}
      {change && <p className="text-[13px] text-[#cdc6b6]">{change}.</p>}
      {ind.indirect && ind.note && <p className="text-[12.5px] text-[#a8a295]">{ind.note}</p>}
      <p className="text-[12.5px] text-[#a8a295]">
        {ind.lastDay ? `Último registro: ${dayLabel(ind.lastDay)}` : 'Aún sin registros'}
      </p>
      <div className="flex flex-wrap gap-2">
        {link && (
          <Button asChild variant="outline" className="min-h-[44px] rounded-xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">
            <Link to={link}>Ver evolución<ChevronRight aria-hidden="true" /></Link>
          </Button>
        )}
        {canAct && ind.manual && !ind.professionalEntryOnly && goal.status === 'active' && (
          <Button type="button" onClick={() => onCheckin?.(goal, ind)} variant="outline" className="min-h-[44px] rounded-xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">
            <Plus aria-hidden="true" />Registrar valor
          </Button>
        )}
      </div>
      {ind.professionalEntryOnly && <p className="text-[12.5px] text-[#a8a295]">Este valor lo registra tu kinesiólogo.</p>}
    </div>
  );
};

const GoalCard = ({ goal, category, sources, variant, canAct = true, onCheckin, onPause, onResume }: GoalCardProps) => {
  const [open, setOpen] = useState(variant === 'primary');
  const hero = variant === 'primary';
  const inds = goal.progress.indicators;
  const first = inds[0];
  const summary = first ? paramsText(first, category, sources) || first.label : goal.categoryName;
  const panelId = `goal-${goal.id}`;

  return (
    <article aria-label={`Objetivo: ${goal.categoryName}`} className={cn(hero ? cn('rounded-[24px] border p-5', HERO_SURFACE) : cn(CARD, 'p-4'))}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#8fd0e0]">
          <GoalIcon name={goal.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className={EYEBROW_SOFT}>{hero ? 'Objetivo principal' : 'Objetivo secundario'}</p>
          <p className="text-[15.5px] font-bold leading-snug text-[#fff8e4]">{goal.categoryName}</p>
        </div>
      </div>
      <div className="mt-2.5"><StatusPill goal={goal} /></div>

      {!hero && (
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)} className="mt-3 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-[#fff8e4]">{summary}</span>
            <span className="block text-[12.5px] text-[#a8a295]">
              {first?.current ? `${formatValue(first.current.value, first.unit)}${first.target ? ` de ${formatValue(first.target.value, first.unit)}` : ''}` : 'Aún sin registros'}
              {goal.progress.percent !== null ? ` · ${goal.progress.percent} %` : ''}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className={cn('h-5 w-5 shrink-0 text-[#a8a295] transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      )}

      {goal.status === 'pending_validation' && (
        <p className="mt-3 rounded-xl border border-[#fff8e4]/20 bg-[#fff8e4]/[0.05] p-3 text-[13px] text-[#cdc6b6]">
          Tu kinesiólogo revisará este objetivo y definirá o validará la meta antes de activarlo.
        </p>
      )}

      <div id={panelId} hidden={!open} className={cn('mt-4 space-y-5', !hero && 'border-t border-[#fff8e4]/10 pt-4')}>
        {inds.map((ind) => (
          <IndicatorBlock key={ind.seriesKey} goal={goal} ind={ind} category={category} sources={sources} canAct={canAct} onCheckin={onCheckin} hero={hero && inds.length === 1} />
        ))}
        {goal.targetDay && <p className="text-[12.5px] text-[#a8a295]">Fecha que te pusiste: {dayLabel(goal.targetDay)}</p>}
        {canAct && (
          <div className="flex flex-wrap gap-2 border-t border-[#fff8e4]/10 pt-3">
            {goal.status === 'paused' ? (
              <Button type="button" variant="ghost" onClick={() => onResume?.(goal)} className="min-h-[44px] text-[#8fd0e0] hover:bg-[#fff8e4]/[0.06] hover:text-[#8fd0e0]"><Play aria-hidden="true" />Reanudar</Button>
            ) : goal.status === 'active' || goal.status === 'pending_validation' ? (
              <Button type="button" variant="ghost" onClick={() => onPause?.(goal)} className="min-h-[44px] text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]"><Pause aria-hidden="true" />Pausar</Button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
};

export default GoalCard;
