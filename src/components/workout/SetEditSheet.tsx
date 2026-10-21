import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomSheet from '@/components/premium/BottomSheet';
import NumberStepper from '@/components/premium/NumberStepper';
import { BTN_FILL } from '@/components/dashboard/brand';
import type { SavedSet } from '@/services/workoutService';
import { cn } from '@/lib/utils';

interface SetEditSheetProps {
  set: SavedSet | null;
  busy: boolean;
  onClose: () => void;
  onSave: (set: SavedSet, values: { reps?: number; weight?: number; durationSec?: number }) => Promise<void>;
  onDelete: (set: SavedSet) => Promise<void>;
}

// Corregir o eliminar una serie ya guardada (solo mientras el entrenamiento sigue en curso)
const SetEditSheet = ({ set, busy, onClose, onSave, onDelete }: SetEditSheetProps) => {
  const [reps, setReps] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setReps(set?.reps ?? null);
    setWeight(set?.weight ?? null);
    setSeconds(set?.durationSec ?? null);
    setConfirmDelete(false);
  }, [set]);

  const time = set?.modality === 'time';
  const withLoad = set?.modality === 'weight';
  const valid = time ? !!seconds && seconds >= 1 : !!reps && reps >= 1 && (!withLoad || (!!weight && weight > 0));

  return (
    <BottomSheet open={!!set} onOpenChange={(open) => !open && onClose()} title={set ? `Corregir ${set.exerciseName}` : 'Corregir serie'} description={set ? `Serie ${set.setNumber ?? ''}${set.slot ? ` · ${set.slot}` : ''}` : undefined}>
      {set && (
        <div className="space-y-3 pb-2 pt-2">
          <div className={cn('grid gap-2', withLoad ? 'grid-cols-2' : 'grid-cols-1')}>
            {time ? (
              <NumberStepper label="Tiempo" unit="segundos" value={seconds} onChange={setSeconds} step={5} max={7200} />
            ) : (
              <>
                <NumberStepper label="Repeticiones" value={reps} onChange={setReps} max={999} />
                {withLoad && <NumberStepper label="Carga" unit={set.weightUnit} decimals step={2.5} value={weight} onChange={setWeight} max={1000} />}
              </>
            )}
          </div>
          <Button
            disabled={!valid || busy}
            onClick={() => onSave(set, time ? { durationSec: seconds ?? undefined } : { reps: reps ?? undefined, ...(withLoad ? { weight: weight ?? undefined } : {}) })}
            className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}
          >
            <Check aria-hidden="true" strokeWidth={3} />
            Guardar cambios
          </Button>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-[#e8b4a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Eliminar esta serie
            </button>
          ) : (
            <div className="rounded-2xl border border-[#e8b4a0]/50 bg-[#e8b4a0]/10 p-3 text-center">
              <p className="text-sm text-[#fff8e4]">¿Eliminar esta serie de tu historial?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(false)} className="min-h-[48px] rounded-xl border-[#fff8e4]/25 bg-transparent text-[#fff8e4] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">Conservar</Button>
                <Button disabled={busy} onClick={() => onDelete(set)} className="min-h-[48px] rounded-xl border-[#e8b4a0] bg-[#e8b4a0] font-bold text-[#181619] hover:bg-[#e8b4a0]/90">Eliminar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
};

export default SetEditSheet;
