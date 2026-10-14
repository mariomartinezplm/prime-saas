import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DateBadge from '@/components/shared/DateBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { appointmentStart, parseDay, personName } from '@/lib/appointments';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';
import { BTN_OUTLINE, EYEBROW, PILL, PILL_SOLID, SURFACE, TEXT, TEXT_SOFT } from './brand';
import { nextSessionLabel } from './nextSession';

interface NextSessionCardProps {
  appointment: Appointment | null;
  // No se pudo cargar la lista de citas (distinto de «no hay citas»)
  failed: boolean;
  now: Date;
}

const NextSessionCard = ({ appointment, failed, now }: NextSessionCardProps) => {
  const label = appointment ? nextSessionLabel(appointment, now) : null;
  const professional = appointment && typeof appointment.professional === 'object' ? personName(appointment.professional, '') : '';

  return (
    <section aria-labelledby="proxima-sesion" className={cn(SURFACE, 'flex flex-col')}>
      <h2 id="proxima-sesion" className={EYEBROW}>
        Próxima sesión
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
      </h2>

      {failed ? (
        <p className={cn('mt-4 text-sm', TEXT_SOFT)}>No se pudo cargar tu próxima sesión.</p>
      ) : appointment && label ? (
        <div className="mt-4 flex flex-1 flex-col justify-between gap-5">
          <div className="flex items-center gap-4">
            <DateBadge date={parseDay(appointment.date)} className="h-[4.5rem] w-16 border-[#398ca2]/60 bg-[#398ca2]/10 text-[#fff8e4]" />
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={label.isToday ? PILL_SOLID : PILL}>{label.text}</span>
                {label.detail && <span className={cn('text-xs', TEXT_SOFT)}>{label.detail}</span>}
              </p>
              <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', TEXT)}>
                {appointment.startTime} – {appointment.endTime}
              </p>
              <p className={cn('text-sm', TEXT_SOFT)}>
                {appointmentTypeLabels[appointment.type]}
                {professional && ` · con ${professional}`}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className={cn('w-full sm:w-auto sm:self-start', BTN_OUTLINE)}>
            <Link to="/app/mis-citas">
              Ver mis citas
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-[#398ca2]/60 text-[#fff8e4]/80"
          >
            <CalendarPlus className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <p className={cn('font-medium', TEXT)}>Todavía no tienes una sesión agendada</p>
            <p className={cn('text-sm', TEXT_SOFT)}>Cuando reserves una hora, la verás aquí.</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default NextSessionCard;
