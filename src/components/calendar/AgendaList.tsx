import { addDays, endOfWeek, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { AppointmentStatusBadge } from '@/components/shared/StatusBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { appointmentStart, parseDay, personName } from '@/lib/appointments';
import { capitalizeFirst, cn } from '@/lib/utils';
import { dayAvailabilityText, type Coverage } from './availabilityCoverage';
import type { Appointment } from '@/types';

const WEEK = { weekStartsOn: 1 as const };

const barClass: Record<Appointment['status'], string> = {
  scheduled: 'border-l-primary',
  completed: 'border-l-success',
  'no-show': 'border-l-warning',
  cancelled: 'border-l-destructive/50',
};

interface AgendaListProps {
  appointments: Appointment[];
  date: Date;
  onNavigate: (date: Date) => void;
  onSelect: (appointment: Appointment) => void;
  // Horario de atención del profesional: cada día muestra las horas en que atiende (o que está bloqueado)
  coverage?: Coverage | null;
}

// Vista de calendario para móvil: la semana en 7 columnas no cabe en 375 px, así que se muestra
// como lista por día. Mismos datos, mismos estados y el mismo detalle al tocar una cita.
const AgendaList = ({ appointments, date, onNavigate, onSelect, coverage = null }: AgendaListProps) => {
  const weekStart = startOfWeek(date, WEEK);
  const weekEnd = endOfWeek(date, WEEK);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byDay = days
    .map((day) => ({
      day,
      items: appointments
        .filter((apt) => isSameDay(parseDay(apt.date), day))
        .sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime()),
    }))
    // Con horario configurado también se muestran los días en que atiende aunque no tengan citas
    .filter((group) => group.items.length > 0 || (!!coverage && dayAvailabilityText(coverage, group.day) !== null));

  const rangeLabel = `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => onNavigate(addDays(date, -7))}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold" aria-live="polite">
            {rangeLabel}
          </p>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onNavigate(new Date())}>
            Ir a hoy
          </Button>
        </div>
        <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => onNavigate(addDays(date, 7))}>
          <ChevronRight />
        </Button>
      </div>

      {byDay.length === 0 ? (
        <EmptyState icon={CalendarX} title="No hay citas esta semana" description="Usa las flechas para ver otras semanas." />
      ) : (
        byDay.map(({ day, items }) => (
          <section key={day.toISOString()} aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })} className="space-y-2">
            <h2 className={cn('flex items-center gap-2 text-sm font-semibold', isToday(day) && 'text-secondary')}>
              {capitalizeFirst(format(day, "EEEE d 'de' MMMM", { locale: es }))}
              {isToday(day) && <Badge variant="info">Hoy</Badge>}
            </h2>
            {coverage && dayAvailabilityText(coverage, day) && (
              <p className="text-xs text-muted-foreground">
                {dayAvailabilityText(coverage, day) === 'Día bloqueado' ? 'Día bloqueado' : `Atiendes: ${dayAvailabilityText(coverage, day)}`}
              </p>
            )}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Sin citas este día</p>}
            <ul className="space-y-2">
              {items.map((apt) => (
                <li key={apt._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(apt)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border border-l-4 border-border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      barClass[apt.status]
                    )}
                  >
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums">
                      {apt.startTime}
                      <span className="block text-xs font-normal text-muted-foreground">{apt.endTime}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm font-medium', apt.status === 'cancelled' && 'line-through opacity-70')}>
                        {personName(apt.patient, 'Paciente')}
                      </span>
                      <span className="block text-xs text-muted-foreground">{appointmentTypeLabels[apt.type]}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {apt.status !== 'scheduled' && <AppointmentStatusBadge status={apt.status} />}
                      {apt.outsideCapacity && <Badge variant="accent">Sobre cupo</Badge>}
                      {apt.overbooked && <Badge variant="warning">Sobrecupo</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

export default AgendaList;
