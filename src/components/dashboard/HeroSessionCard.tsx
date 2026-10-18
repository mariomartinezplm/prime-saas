import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, CircleAlert, CircleCheck, Hourglass, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DateBadge from '@/components/shared/DateBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { parseDay, personName } from '@/lib/appointments';
import { cn } from '@/lib/utils';
import { BTN_FILL, PILL, PILL_SOLID, TEXT, TEXT_SOFT } from './brand';
import { SkeletonBones } from './CardSkeleton';
import { useContentFade } from './useContentFade';
import WhatsAppButton from './WhatsAppButton';
import type { BlockedReason, HeroView } from './heroView';
import type { PlanView } from './planView';

const BLOCKED: Record<BlockedReason, { title: string; detail: string; cta?: { label: string; message: string } }> = {
  expired: { title: 'Tu plan venció', detail: 'Renuévalo con Prime F&H para volver a reservar.', cta: { label: 'Renovar por WhatsApp', message: 'Hola, quiero renovar mi plan en Prime F&H' } },
  none: { title: 'Aún no tienes un plan activo', detail: 'Consulta con Prime F&H para activarlo y reservar.', cta: { label: 'Consultar por WhatsApp', message: 'Hola, quiero consultar por mi plan en Prime F&H' } },
  upcoming: { title: 'Tu plan todavía no empieza', detail: 'Cuando comience podrás reservar tus sesiones.' },
  unknown: { title: 'No tienes un plan vigente', detail: 'Consulta con Prime F&H para activarlo o renovarlo.', cta: { label: 'Consultar por WhatsApp', message: 'Hola, quiero consultar por mi plan en Prime F&H' } },
  'used-up': { title: 'Usaste todas las sesiones de tu plan', detail: 'Renuévalo con Prime F&H para seguir reservando.', cta: { label: 'Renovar por WhatsApp', message: 'Hola, quiero renovar mi plan en Prime F&H' } },
};

const SHELL = 'flex min-h-[12.5rem] flex-col rounded-2xl border p-4 min-[360px]:p-5 sm:p-6';
const BRAND_SHELL = 'border-[#398ca2]/55 bg-[#398ca2]/10';
const PLAIN_SHELL = 'border-[#fff8e4]/10 bg-[#fff8e4]/[0.04]';

interface HeroSessionCardProps {
  view: HeroView;
  planView: PlanView;
  onRetry: () => void;
  retrying?: boolean;
}

// Tarjeta protagonista: la pieza más importante de la pantalla. Cambia según el estado real (reglas en heroView.ts).
const HeroSessionCard = ({ view, planView, onRetry, retrying = false }: HeroSessionCardProps) => {
  const fade = useContentFade(view.kind === 'loading');

  if (view.kind === 'loading') {
    return (
      <section aria-label="Tu próxima sesión" className={cn(SHELL, PLAIN_SHELL)}>
        <SkeletonBones label="Cargando tu próxima sesión" lines={[35, 100, 55]} />
      </section>
    );
  }

  if (view.kind === 'error') {
    return (
      <section aria-labelledby="hero-titulo" className={cn(SHELL, PLAIN_SHELL, 'justify-center gap-3', fade)}>
        <span className={cn(PILL, 'w-fit')}>
          <TriangleAlert className="h-3 w-3" aria-hidden="true" />
          Sin conexión
        </span>
        <h2 id="hero-titulo" className={cn('text-lg font-semibold', TEXT)}>
          {view.what === 'session' ? 'No pudimos cargar tu próxima sesión' : 'No pudimos comprobar tu plan'}
        </h2>
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="w-full border-[#398ca2] text-[#fff8e4] hover:bg-[#398ca2]/15 sm:w-auto">
          Reintentar
        </Button>
      </section>
    );
  }

  if (view.kind === 'session') {
    const { appointment, phase, label, when } = view;
    const professional = typeof appointment.professional === 'object' ? personName(appointment.professional, '') : '';
    return (
      <section aria-labelledby="hero-titulo" className={cn(SHELL, BRAND_SHELL, 'justify-between gap-5', fade)}>
        <div className="flex items-start gap-3 min-[360px]:gap-4">
          <DateBadge date={parseDay(appointment.date)} className="h-[4.5rem] w-[3.75rem] rounded-2xl border-[#398ca2]/70 bg-[#181619]/60 min-[360px]:h-[4.75rem] min-[360px]:w-[4.25rem] text-[#fff8e4] [&>span:last-child]:text-[28px]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={phase === 'future' ? PILL : PILL_SOLID}>{when}</span>
              {phase === 'future' && label.detail && <span className={cn('text-xs', TEXT_SOFT)}>{label.detail}</span>}
            </p>
            <h2 id="hero-titulo" className={cn('text-[1.375rem] font-semibold leading-none min-[360px]:text-2xl sm:text-[1.75rem] tabular-nums tracking-tight', TEXT)}>
              {appointment.startTime} – {appointment.endTime}
            </h2>
            <p className={cn('text-sm', TEXT_SOFT)}>
              {appointmentTypeLabels[appointment.type]}
              {professional && ` · con ${professional}`}
            </p>
            <p className={cn('flex items-center gap-1.5 text-xs', TEXT_SOFT)}>
              <CircleCheck className="h-3.5 w-3.5 text-[#398ca2]" aria-hidden="true" />
              {phase === 'live' ? 'Sesión en curso' : 'Programada'}
            </p>
          </div>
        </div>
        <Button asChild className={cn('w-full', BTN_FILL)}>
          <Link to="/app/mis-citas">
            Ver mis citas
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    );
  }

  if (view.kind === 'blocked') {
    const text = BLOCKED[view.reason];
    const date = view.reason === 'upcoming' ? planView.upcomingStart : view.reason === 'expired' ? planView.endedOn : undefined;
    const next = view.nextSession;
    return (
      <section aria-labelledby="hero-titulo" className={cn(SHELL, PLAIN_SHELL, 'justify-between gap-4', fade)}>
        <div className="space-y-2">
          <span className={cn(PILL, 'w-fit')}>
            {view.reason === 'used-up' ? <Hourglass className="h-3 w-3" aria-hidden="true" /> : <CircleAlert className="h-3 w-3" aria-hidden="true" />}
            Importante
          </span>
          <h2 id="hero-titulo" className={cn('text-xl font-semibold tracking-tight', TEXT)}>
            {text.title}
          </h2>
          <p className={cn('text-sm', TEXT_SOFT)}>
            {text.detail}
            {date && view.reason === 'upcoming' && ` Empieza el ${date}.`}
            {date && view.reason === 'expired' && ` Venció el ${date}.`}
          </p>
          {next && (
            <p className={cn('text-sm', TEXT)}>
              Tienes una sesión agendada: {next.startTime} · {appointmentTypeLabels[next.type]}.{' '}
              <Link to="/app/mis-citas" className="font-medium underline underline-offset-4">
                Ver mis citas
              </Link>
            </p>
          )}
        </div>
        {text.cta && <WhatsAppButton label={text.cta.label} message={text.cta.message} />}
      </section>
    );
  }

  // Plan vigente y nada agendado
  return (
    <section aria-labelledby="hero-titulo" className={cn(SHELL, BRAND_SHELL, 'justify-between gap-5', fade)}>
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="flex h-[4.75rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#398ca2]/70 text-[#fff8e4]/85">
          <CalendarPlus className="h-7 w-7" />
        </span>
        <div className="space-y-1.5">
          <h2 id="hero-titulo" className={cn('text-xl font-semibold tracking-tight', TEXT)}>
            Reserva tu próxima sesión
          </h2>
          <p className={cn('text-sm', TEXT_SOFT)}>
            No tienes sesiones agendadas. {view.detail}
          </p>
        </div>
      </div>
      <Button asChild className={cn('w-full', BTN_FILL)}>
        <Link to="/app/reservar">
          Reservar hora
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
};

export default HeroSessionCard;
