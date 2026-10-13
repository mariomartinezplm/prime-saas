import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MIN_BOOKING_AHEAD_HOURS } from '@/config/bookingRules';
import type { AvailableSlots } from '@/types';

interface SlotGridProps {
  slots: AvailableSlots;
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
  // Horarios que en principio tienen cupo, pero caen dentro de las 4h de
  // anticipación mínima (Paso 17 de BLUEPRINT.md) — se muestran aparte de
  // "Ocupado" para no confundir "sin cupo" con "muy pronto para reservar".
  tooSoonSlots?: string[];
}

// Los horarios se agrupan por momento del día para que la lista larga se lea de un vistazo
const PERIODS = [
  { key: 'morning', label: 'Mañana', includes: (hour: number) => hour < 12 },
  { key: 'afternoon', label: 'Tarde', includes: (hour: number) => hour >= 12 && hour < 19 },
  { key: 'evening', label: 'Noche', includes: (hour: number) => hour >= 19 },
] as const;

const hourOf = (slot: string) => parseInt(slot.split(':')[0], 10);

// Un estado nunca se distingue solo por color: cada uno tiene además forma (borde/relleno/tachado) y texto.
const STYLES = {
  available: 'border-primary/40 bg-primary/10 text-foreground hover:border-primary hover:bg-primary/20',
  selected: 'border-primary bg-primary text-primary-foreground shadow-sm',
  booked: 'border-transparent bg-muted text-muted-foreground',
  blocked: 'border-dashed border-border bg-transparent text-muted-foreground',
  tooSoon: 'border-dashed border-border bg-muted/40 text-muted-foreground',
} as const;

const Swatch = ({ className, children }: { className: string; children?: React.ReactNode }) => (
  <span aria-hidden="true" className={cn('inline-flex h-5 w-8 items-center justify-center rounded border text-[10px]', className)}>
    {children}
  </span>
);

const SlotGrid = ({ slots, selectedSlot, onSelect, tooSoonSlots = [] }: SlotGridProps) => {
  const allSlots = [
    ...slots.availableSlots,
    ...slots.bookedSlots,
    ...(slots.blockedSlots || []),
    ...tooSoonSlots,
  ].sort();

  if (allSlots.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        No hay horarios configurados para este día
      </p>
    );
  }

  const renderSlot = (slot: string) => {
    const isAvailable = slots.availableSlots.includes(slot);
    const isBooked = slots.bookedSlots.includes(slot);
    const isBlocked = slots.blockedSlots?.includes(slot);
    const isTooSoon = tooSoonSlots.includes(slot);
    const isSelected = selectedSlot === slot;

    return (
      <button
        key={slot}
        disabled={!isAvailable}
        type="button"
        aria-pressed={isSelected}
        aria-label={`${slot}, ${isSelected ? 'seleccionado' : isAvailable ? 'disponible' : isBooked ? 'ocupado' : isBlocked ? 'bloqueado' : 'muy pronto'}`}
        title={isTooSoon ? `Debes reservar con al menos ${MIN_BOOKING_AHEAD_HOURS} horas de anticipación` : undefined}
        onClick={() => isAvailable && onSelect(slot)}
        className={cn(
          'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isAvailable && !isSelected && cn(STYLES.available, 'cursor-pointer'),
          isBooked && cn(STYLES.booked, 'cursor-not-allowed'),
          isBlocked && cn(STYLES.blocked, 'cursor-not-allowed'),
          isTooSoon && cn(STYLES.tooSoon, 'cursor-not-allowed'),
          isSelected && STYLES.selected
        )}
      >
        <span className={cn('text-base font-semibold tabular-nums leading-none', isBooked && 'line-through decoration-1')}>{slot}</span>
        {isSelected && (
          <span className="flex items-center gap-1 text-[11px] leading-none">
            <Check className="h-3 w-3" aria-hidden="true" />
            Elegido
          </span>
        )}
        {isBooked && <span className="text-[11px] leading-none">Ocupado</span>}
        {isBlocked && <span className="text-[11px] leading-none">Bloqueado</span>}
        {isTooSoon && (
          <span className="flex items-center gap-1 text-[11px] leading-none">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Muy pronto
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Leyenda de horarios">
        <li className="flex items-center gap-1.5">
          <Swatch className="border-primary/40 bg-primary/10" />
          Disponible
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="border-primary bg-primary" />
          Elegido
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="border-transparent bg-muted text-muted-foreground line-through">12</Swatch>
          Ocupado
        </li>
        {(slots.blockedSlots?.length ?? 0) > 0 && (
          <li className="flex items-center gap-1.5">
            <Swatch className="border-dashed border-border" />
            Bloqueado
          </li>
        )}
        {tooSoonSlots.length > 0 && (
          <li className="flex items-center gap-1.5">
            <Swatch className="border-dashed border-border bg-muted/40">
              <Clock className="h-3 w-3" />
            </Swatch>
            Muy pronto
          </li>
        )}
      </ul>

      <div className="space-y-4" role="group" aria-label="Horarios del día">
        {PERIODS.map((period) => {
          const periodSlots = allSlots.filter((slot) => period.includes(hourOf(slot)));
          if (periodSlots.length === 0) return null;
          return (
            <div key={period.key} role="group" aria-label={period.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden="true">
                {period.label}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{periodSlots.map(renderSlot)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SlotGrid;
