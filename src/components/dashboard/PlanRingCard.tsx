import { CircleAlert, Hourglass, Infinity as InfinityIcon } from 'lucide-react';
import { SERVICE_TYPE_LABELS } from '@/config/planCatalog';
import { cn } from '@/lib/utils';
import { PILL, TEXT, TEXT_SOFT } from './brand';
import { sessionsWord } from './nextSession';
import ProgressRing from './ProgressRing';
import type { PlanView } from './planView';
import { SkeletonBones } from './CardSkeleton';
import { useContentFade } from './useContentFade';

export const RING_CARD = 'rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-4 min-h-[15.5rem]';

const INACTIVE_LABEL: Record<NonNullable<PlanView['inactiveReason']>, string> = {
  expired: 'Plan vencido',
  none: 'Sin plan activo',
  upcoming: 'Plan por comenzar',
  unknown: 'Sin plan vigente',
};

interface PlanRingCardProps {
  view: PlanView;
  loading?: boolean;
  // Ocupa todo el ancho (cuando no hay tarjeta de constancia al lado): anillo a la izquierda, texto a la derecha
  wide?: boolean;
}

// «Mi plan»: sesiones usadas respecto del total REAL del plan. Un plan ilimitado no tiene total: no se dibuja porcentaje.
const PlanRingCard = ({ view, loading = false, wide = false }: PlanRingCardProps) => {
  const fade = useContentFade(loading);
  const hasPlan = view.kind === 'active' || view.kind === 'used-up' || view.kind === 'unlimited';
  const unlimited = view.kind === 'unlimited';
  const total = view.total;
  const ratio = view.kind === 'used-up' && total === undefined ? undefined : view.ratio;

  const ring = hasPlan && (
    <ProgressRing
      ratio={unlimited ? undefined : ratio}
      value={view.used ?? 0}
      caption={unlimited ? 'usadas' : total !== undefined ? `de ${total}` : 'usadas'}
      label={
        unlimited
          ? `${view.used} ${view.used === 1 ? 'sesión usada' : 'sesiones usadas'}, plan ilimitado`
          : total !== undefined
            ? `${view.used} de ${total} sesiones usadas`
            : `${view.used} sesiones usadas`
      }
      animateKey="plan-ring"
    />
  );

  return (
    <section aria-labelledby="mi-plan" className={cn(RING_CARD, wide && 'col-span-2 min-h-0', 'flex flex-col')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="mi-plan" className={cn('text-sm font-medium', TEXT_SOFT)}>
            Mi plan
          </h2>
          {hasPlan && view.serviceType && <p className={cn('truncate text-xs', TEXT_SOFT)}>{SERVICE_TYPE_LABELS[view.serviceType]}</p>}
        </div>
        {hasPlan && view.paymentPending && <span className={cn(PILL, 'shrink-0')}>Pago pendiente</span>}
      </div>

      {loading ? (
        <SkeletonBones label="Cargando tu plan" className="mt-4" lines={[50, 100, 40]} />
      ) : view.kind === 'error' ? (
        <p className={cn('mt-4 text-sm', TEXT_SOFT, fade)}>No se pudo cargar tu plan.</p>
      ) : view.kind === 'inactive' ? (
        <div className={cn('mt-4 space-y-2', fade)}>
          <span className={PILL}>
            <CircleAlert className="h-3 w-3" aria-hidden="true" />
            {INACTIVE_LABEL[view.inactiveReason ?? 'unknown']}
          </span>
          {view.inactiveReason === 'expired' && view.endedOn && <p className={cn('text-sm', TEXT_SOFT)}>Venció el {view.endedOn}</p>}
          {view.inactiveReason === 'upcoming' && view.upcomingStart && <p className={cn('text-sm', TEXT_SOFT)}>Empieza el {view.upcomingStart}</p>}
        </div>
      ) : (
        <div className={cn('mt-3 flex flex-1 items-center gap-4', wide ? 'flex-row' : 'flex-col justify-start pt-1 text-center', fade)}>
          {ring}
          <div className={cn('min-w-0 space-y-1 text-sm', TEXT_SOFT)}>
            {unlimited ? (
              <p className={cn('flex items-center gap-1.5', wide ? '' : 'justify-center', TEXT)}>
                <InfinityIcon className="h-4 w-4" aria-hidden="true" />
                Plan ilimitado
              </p>
            ) : view.kind === 'used-up' ? (
              <p className={cn('flex items-center gap-1.5', wide ? '' : 'justify-center', TEXT)}>
                <Hourglass className="h-4 w-4" aria-hidden="true" />
                Sin sesiones disponibles
              </p>
            ) : (
              view.available !== undefined && (
                <p className={TEXT}>
                  Quedan {sessionsWord(view.available)}
                  {view.extra ? ` (con ${view.extra} extra)` : ''}
                </p>
              )
            )}
            <p className="text-xs">{view.openEnded ? 'Hasta completar tus sesiones' : `Hasta ${view.validUntil}`}</p>
            {/* Los días restantes solo importan cerca del vencimiento */}
            {view.daysLeftText && (view.daysLeftText.startsWith('vence') || parseInt(view.daysLeftText, 10) <= 7) && <p className="text-xs">{view.daysLeftText}</p>}
          </div>
        </div>
      )}
    </section>
  );
};

export default PlanRingCard;
