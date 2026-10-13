import { Calendar as BigCalendar, dateFnsLocalizer, Views, type Formats, type ToolbarProps, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { personName } from '@/lib/appointments';
import { capitalizeFirst } from '@/lib/utils';
import { statusClass, visibleHours, type CalendarEvent } from './calendarUtils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { es } });

const formats: Formats = {
  timeGutterFormat: (date, culture, loc) => loc?.format(date, 'HH:mm', culture) ?? '',
  eventTimeRangeFormat: ({ start, end }, culture, loc) =>
    `${loc?.format(start, 'HH:mm', culture)} – ${loc?.format(end, 'HH:mm', culture)}`,
  dayFormat: (date, culture, loc) => capitalizeFirst(loc?.format(date, 'EEE d', culture) ?? ''),
  weekdayFormat: (date, culture, loc) => capitalizeFirst(loc?.format(date, 'EEE', culture) ?? ''),
  dayHeaderFormat: (date, culture, loc) => capitalizeFirst(loc?.format(date, "EEEE d 'de' MMMM", culture) ?? ''),
  dayRangeHeaderFormat: ({ start, end }, culture, loc) =>
    `${loc?.format(start, 'd MMM', culture)} – ${loc?.format(end, 'd MMM yyyy', culture)}`,
  monthHeaderFormat: (date, culture, loc) => capitalizeFirst(loc?.format(date, 'MMMM yyyy', culture) ?? ''),
};

const messages = {
  today: 'Hoy',
  previous: 'Anterior',
  next: 'Siguiente',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  noEventsInRange: 'No hay citas en este rango',
  showMore: (total: number) => `+${total} más`,
};

const Toolbar = ({ label, onNavigate, onView, view }: ToolbarProps<CalendarEvent>) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Anterior" onClick={() => onNavigate('PREV')}>
        <ChevronLeft />
      </Button>
      <Button variant="outline" onClick={() => onNavigate('TODAY')}>
        Hoy
      </Button>
      <Button variant="outline" size="icon" aria-label="Siguiente" onClick={() => onNavigate('NEXT')}>
        <ChevronRight />
      </Button>
    </div>
    <p className="order-last w-full text-center text-sm font-semibold sm:order-none sm:w-auto sm:text-base" aria-live="polite">
      {label}
    </p>
    <ToggleGroup type="single" value={view} onValueChange={(next) => next && onView(next as View)} variant="outline" aria-label="Vista del calendario">
      <ToggleGroupItem value={Views.WEEK}>Semana</ToggleGroupItem>
      <ToggleGroupItem value={Views.DAY}>Día</ToggleGroupItem>
      <ToggleGroupItem value={Views.MONTH}>Mes</ToggleGroupItem>
    </ToggleGroup>
  </div>
);

// Nombre corto ("Camila R."): con 3-4 citas a la misma hora cada una queda muy angosta.
// El nombre completo está en el detalle y en el tooltip.
const shortName = (patient: CalendarEvent['resource']['patient']) => {
  if (typeof patient !== 'object' || !patient) return 'Paciente';
  return `${patient.firstName} ${patient.lastName.charAt(0)}.`;
};

const initials = (patient: CalendarEvent['resource']['patient']) =>
  typeof patient === 'object' && patient ? `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}` : 'P';

// Si la cita queda muy angosta (3-4 a la misma hora), calendar.css oculta el nombre y el tipo y deja las iniciales.
const EventCell = ({ event }: { event: CalendarEvent }) => (
  <div className="flex flex-col overflow-hidden leading-tight" title={personName(event.resource.patient, 'Paciente')}>
    <span className="apt-event-name truncate font-medium">{shortName(event.resource.patient)}</span>
    <span className="apt-event-initials hidden font-semibold">{initials(event.resource.patient)}</span>
    <span className="apt-event-type truncate opacity-80">{appointmentTypeLabels[event.resource.type]}</span>
  </div>
);

interface AppointmentCalendarProps {
  events: CalendarEvent[];
  date: Date;
  view: View;
  onNavigate: (date: Date) => void;
  onView: (view: View) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const AppointmentCalendar = ({ events, date, view, onNavigate, onView, onSelectEvent }: AppointmentCalendarProps) => {
  const { minHour, maxHour } = visibleHours(events);

  return (
    <div className="apt-calendar h-[calc(100vh-20rem)] min-h-[520px]">
      <BigCalendar
        localizer={localizer}
        culture="es"
        events={events}
        date={date}
        view={view}
        views={[Views.WEEK, Views.DAY, Views.MONTH]}
        onNavigate={onNavigate}
        onView={onView}
        onSelectEvent={onSelectEvent}
        // Con teclado: Enter o Espacio sobre una cita abre su detalle (antes solo se podía con el ratón o el dedo)
        onKeyPressEvent={(event, e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectEvent(event);
          }
        }}
        min={new Date(1970, 0, 1, minHour, 0)}
        max={new Date(1970, 0, 1, maxHour, 0)}
        scrollToTime={new Date(1970, 0, 1, 8, 0)}
        formats={formats}
        dayLayoutAlgorithm="no-overlap"
        messages={messages}
        eventPropGetter={(event) => ({ className: statusClass(event.resource.status) })}
        components={{ toolbar: Toolbar, event: EventCell }}
        tooltipAccessor={(event) => event.title}
      />
    </div>
  );
};

export default AppointmentCalendar;
