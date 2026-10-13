import { Calendar } from '@/components/ui/calendar';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  selectedDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabledDate?: (date: Date) => boolean;
  numberOfMonths?: number;
}

// Muestras de la leyenda: usan las mismas clases que los días reales para que nunca se desfasen
const Swatch = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <span
    aria-hidden="true"
    className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-medium tabular-nums', className)}
  >
    {children}
  </span>
);

const CalendarView = ({ selectedDate, onSelect, disabledDate, numberOfMonths = 1 }: CalendarViewProps) => {
  return (
    <div className="space-y-3">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        numberOfMonths={numberOfMonths}
        locale={es}
        showOutsideDays={false}
        disabled={(date) => {
          // Disable past dates
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (date < today) return true;
          // Disable weekends
          const day = date.getDay();
          if (day === 0 || day === 6) return true;
          // Custom disabled check
          if (disabledDate) return disabledDate(date);
          return false;
        }}
        className="rounded-xl border border-border bg-card/40 p-3 sm:p-4"
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground" aria-label="Leyenda del calendario">
        <li className="flex items-center gap-1.5">
          <Swatch className="bg-primary/10 text-foreground">12</Swatch>
          Disponible para reservar
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="bg-primary text-primary-foreground">12</Swatch>
          Día elegido
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="text-foreground ring-1 ring-inset ring-primary/70">12</Swatch>
          Hoy
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="text-muted-foreground/50">12</Swatch>
          No disponible
        </li>
      </ul>
    </div>
  );
};

export default CalendarView;
