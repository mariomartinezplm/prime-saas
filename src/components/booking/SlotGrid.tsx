import { cn } from '@/lib/utils';
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

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Ocupado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-500" />
          <span>Bloqueado</span>
        </div>
        {tooSoonSlots.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Muy pronto</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {allSlots.map((slot) => {
          const isAvailable = slots.availableSlots.includes(slot);
          const isBooked = slots.bookedSlots.includes(slot);
          const isBlocked = slots.blockedSlots?.includes(slot);
          const isTooSoon = tooSoonSlots.includes(slot);
          const isSelected = selectedSlot === slot;

          return (
            <button
              key={slot}
              disabled={!isAvailable}
              title={isTooSoon ? 'Debes reservar con al menos 4 horas de anticipación' : undefined}
              onClick={() => isAvailable && onSelect(slot)}
              className={cn(
                'py-3 px-2 rounded-md text-sm font-medium transition-all text-center',
                isAvailable && !isSelected && 'bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer',
                isBooked && 'bg-red-500/20 text-red-400 cursor-not-allowed',
                isBlocked && 'bg-gray-500/20 text-gray-400 cursor-not-allowed',
                isTooSoon && 'bg-yellow-500/20 text-yellow-600 cursor-not-allowed',
                isSelected && 'bg-secondary text-white ring-2 ring-secondary'
              )}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SlotGrid;
