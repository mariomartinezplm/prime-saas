import { cn } from '@/lib/utils';
import type { AvailableSlots } from '@/types';

interface SlotGridProps {
  slots: AvailableSlots;
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
}

const SlotGrid = ({ slots, selectedSlot, onSelect }: SlotGridProps) => {
  const allSlots = [
    ...slots.availableSlots,
    ...slots.bookedSlots,
    ...(slots.blockedSlots || []),
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
      <div className="flex gap-3 mb-4 text-xs">
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
      </div>

      <div className="grid grid-cols-3 gap-2">
        {allSlots.map((slot) => {
          const isAvailable = slots.availableSlots.includes(slot);
          const isBooked = slots.bookedSlots.includes(slot);
          const isBlocked = slots.blockedSlots?.includes(slot);
          const isSelected = selectedSlot === slot;

          return (
            <button
              key={slot}
              disabled={!isAvailable}
              onClick={() => isAvailable && onSelect(slot)}
              className={cn(
                'py-3 px-2 rounded-md text-sm font-medium transition-all text-center',
                isAvailable && !isSelected && 'bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer',
                isBooked && 'bg-red-500/20 text-red-400 cursor-not-allowed',
                isBlocked && 'bg-gray-500/20 text-gray-400 cursor-not-allowed',
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
