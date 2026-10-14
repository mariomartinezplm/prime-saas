import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus, CircleAlert, HeartPulse, Hourglass, Play, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { TodayAction, TodayActionId, TodayResult, TodayTarget } from './todayActions';

// Identidad de PRIME: negro #181619, turquesa #398ca2 y crema #fff8e4 (con transparencias). Los valores van exactos,
// no los aproximados del tema. El estado nunca se distingue solo por color: cada acción lleva icono y texto, y lo
// importante además lleva la etiqueta «Importante» y un borde más marcado.
const ICONS: Record<TodayActionId, LucideIcon> = {
  'plan-expired': CircleAlert,
  'session-live': Play,
  'session-today': CalendarClock,
  readiness: HeartPulse,
  'plan-used-up': Hourglass,
  'book-next': CalendarPlus,
};

// Botón principal: relleno turquesa con texto negro (contraste 4,7:1). Los demás: borde turquesa con texto crema.
const CTA_PRIMARY = 'border-[#398ca2] bg-[#398ca2] text-[#181619] hover:bg-[#398ca2]/90 hover:text-[#181619]';
const CTA_OUTLINE = 'border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]';

interface TodayCardProps {
  result: TodayResult;
  onGoTo: (target: TodayTarget) => void;
}

const ActionRow = ({ action, first, onGoTo }: { action: TodayAction; first: boolean; onGoTo: (target: TodayTarget) => void }) => {
  const Icon = ICONS[action.id];
  const ctaClass = cn('w-full sm:w-auto', first ? CTA_PRIMARY : CTA_OUTLINE);

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-[#181619]/60 p-3 sm:flex-row sm:items-center sm:justify-between',
        action.urgent ? 'border-[#fff8e4]/60 border-l-4 border-l-[#fff8e4]' : 'border-[#398ca2]/40 border-l-4 border-l-[#398ca2]'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#398ca2]/60 bg-[#398ca2]/10 text-[#fff8e4]"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-[#fff8e4]">
            {action.title}
            {action.urgent && (
              <span className="rounded-full border border-[#fff8e4]/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#fff8e4]">
                Importante
              </span>
            )}
          </p>
          <p className="text-sm text-[#fff8e4]/75">{action.detail}</p>
        </div>
      </div>

      {action.cta.to ? (
        <Button asChild variant="outline" className={ctaClass}>
          <Link to={action.cta.to}>{action.cta.label}</Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" className={ctaClass} onClick={() => action.cta.target && onGoTo(action.cta.target)}>
          {action.cta.label}
        </Button>
      )}
    </li>
  );
};

// «Para hoy»: como máximo 3 acciones, en orden de prioridad fija (ver todayActions.ts).
const TodayCard = ({ result, onGoTo }: TodayCardProps) => {
  // Sin datos suficientes no se afirma nada: el bloque no aparece
  if (result.status === 'unknown') return null;

  return (
    <section aria-labelledby="para-hoy" className="space-y-3 rounded-xl border border-[#398ca2]/40 bg-[#398ca2]/5 p-4">
      <h2 id="para-hoy" className="text-lg font-semibold tracking-tight text-[#fff8e4]">
        Para hoy
      </h2>

      {result.status === 'empty' && <p className="text-sm text-[#fff8e4]/75">No tienes otras tareas para hoy.</p>}

      {result.status === 'loading' && (
        <div role="status" aria-label="Revisando tus tareas de hoy">
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {result.status === 'actions' && (
        <ul className="space-y-2">
          {result.actions.map((action, index) => (
            <ActionRow key={action.id} action={action} first={index === 0} onGoTo={onGoTo} />
          ))}
          {result.loadingMore && (
            <li aria-hidden="true">
              <Skeleton className="h-16 w-full rounded-lg" />
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

export default TodayCard;
