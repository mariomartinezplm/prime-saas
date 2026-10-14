import { forwardRef } from 'react';
import { CircleAlert, FileText, Hourglass, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWhatsAppUrl } from '@/config/contact';
import { SERVICE_TYPE_LABELS } from '@/config/planCatalog';
import { cn } from '@/lib/utils';
import { BTN_OUTLINE, EYEBROW, Meter, PILL, SURFACE, TEXT, TEXT_SOFT } from './brand';
import { sessionsWord } from './nextSession';
import type { PlanView } from './planView';

// El estado va en la etiqueta (texto + icono) y la línea de abajo agrega un dato distinto (la fecha), sin repetir el mensaje de «Para hoy»
const INACTIVE_LABEL: Record<NonNullable<PlanView['inactiveReason']>, string> = {
  expired: 'Plan vencido',
  none: 'Sin plan activo',
  upcoming: 'Plan por comenzar',
  unknown: 'Sin plan vigente',
};

// El verde de WhatsApp solo en su icono: el resto del botón es de la marca
const WhatsAppButton = ({ label, message }: { label: string; message: string }) => (
  <Button asChild variant="outline" className={cn('w-full sm:w-auto sm:self-start', BTN_OUTLINE)}>
    <a href={getWhatsAppUrl(message)} target="_blank" rel="noreferrer">
      <MessageCircle className="text-[#25D366]" aria-hidden="true" />
      {label}
    </a>
  </Button>
);

interface PlanCardProps {
  view: PlanView;
}

// «Mi plan». Se puede enfocar desde «Para hoy» (por eso lleva ref, tabIndex -1 y es una región con nombre).
const PlanCard = forwardRef<HTMLElement, PlanCardProps>(({ view }, ref) => {
  const isInactive = view.kind === 'inactive';
  const usedUp = view.kind === 'used-up';

  return (
    <section ref={ref} aria-labelledby="mi-plan" tabIndex={-1} className={cn(SURFACE, 'flex scroll-mt-20 flex-col gap-4 focus:outline-none')}>
      <h2 id="mi-plan" className={EYEBROW}>
        Mi plan
        <FileText className="h-4 w-4" aria-hidden="true" />
      </h2>

      {view.kind === 'error' && <p className={cn('text-sm', TEXT_SOFT)}>No se pudo cargar tu plan.</p>}

      {isInactive && (
        <>
          <div className="space-y-2">
            <span className={PILL}>
              <CircleAlert className="h-3 w-3" aria-hidden="true" />
              {INACTIVE_LABEL[view.inactiveReason ?? 'unknown']}
            </span>
            {view.inactiveReason === 'upcoming' && view.upcomingStart && <p className={cn('text-lg font-medium', TEXT)}>Empieza el {view.upcomingStart}</p>}
            {view.inactiveReason === 'expired' && view.endedOn && <p className={cn('text-lg font-medium', TEXT)}>Venció el {view.endedOn}</p>}
          </div>
          {view.inactiveReason !== 'upcoming' && (
            <WhatsAppButton
              label={view.inactiveReason === 'expired' ? 'Renovar por WhatsApp' : 'Consultar por WhatsApp'}
              message={view.inactiveReason === 'expired' ? 'Hola, quiero renovar mi plan en Prime F&H' : 'Hola, quiero consultar por mi plan en Prime F&H'}
            />
          )}
        </>
      )}

      {(view.kind === 'active' || usedUp || view.kind === 'unlimited') && view.serviceType && (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn('text-xl font-semibold tracking-tight', TEXT)}>{SERVICE_TYPE_LABELS[view.serviceType]}</p>
              {view.kind === 'unlimited' && <span className={PILL}>Ilimitado</span>}
              {usedUp && (
                <span className={PILL}>
                  <Hourglass className="h-3 w-3" aria-hidden="true" />
                  Sin sesiones disponibles
                </span>
              )}
              {view.paymentPending && <span className={PILL}>Pago pendiente</span>}
            </div>
            {view.cycleText && <p className={cn('text-xs', TEXT_SOFT)}>{view.cycleText}</p>}
          </div>

          <div className="space-y-2">
            {view.kind === 'unlimited' ? (
              <p className={TEXT}>
                <span className="text-4xl font-semibold tabular-nums">{view.used}</span>{' '}
                <span className={cn('text-sm', TEXT_SOFT)}>{view.used === 1 ? 'sesión usada' : 'sesiones usadas'} · sin límite</span>
              </p>
            ) : view.total !== undefined ? (
              <>
                <p className={TEXT}>
                  <span className="text-4xl font-semibold tabular-nums">{view.used}</span>{' '}
                  <span className={cn('text-sm', TEXT_SOFT)}>de {view.total} sesiones usadas</span>
                </p>
                {view.ratio !== undefined && <Meter ratio={view.ratio} label={`${view.used} de ${view.total} sesiones usadas`} />}
              </>
            ) : (
              <p className={TEXT}>
                <span className="text-4xl font-semibold tabular-nums">{view.used}</span>{' '}
                <span className={cn('text-sm', TEXT_SOFT)}>{view.used === 1 ? 'sesión usada' : 'sesiones usadas'}</span>
              </p>
            )}
            {view.kind === 'active' && view.available !== undefined && (
              <p className={cn('text-sm', TEXT_SOFT)}>
                Te quedan {sessionsWord(view.available)}
                {view.extra ? ` (incluye ${view.extra} extra)` : ''}
              </p>
            )}
          </div>

          {usedUp && <WhatsAppButton label="Renovar por WhatsApp" message="Hola, quiero renovar mi plan en Prime F&H" />}

          <p className={cn('mt-auto border-t border-[#fff8e4]/10 pt-3 text-xs', TEXT_SOFT)}>
            Vigente hasta {view.validUntil} · {view.daysLeftText}
          </p>
        </>
      )}
    </section>
  );
});
PlanCard.displayName = 'PlanCard';

export default PlanCard;
