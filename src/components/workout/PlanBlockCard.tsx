import { useState } from 'react';
import { Check, CloudOff, Link2, Loader2, Pencil, Play, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BTN_FILL } from '@/components/dashboard/brand';
import SlotEditor from './SlotEditor';
import { KIND_TITLE, blockProblem, groupText, hasUnsaved, isSaved, type DraftBlock, type DraftSlot } from '@/lib/workoutPlan';
import { formatClock } from '@/lib/workoutClock';
import { cn } from '@/lib/utils';

interface PlanBlockCardProps {
  block: DraftBlock;
  index: number; // 1, 2, 3… en el orden de la sesión
  pending: boolean; // guardado en este dispositivo, aún sin confirmar por el servidor
  saving: boolean;
  disabled: boolean;
  error: string | null;
  restSec: number;
  hints: Record<string, string | undefined>; // «Última vez…» por nombre de ejercicio
  onServer: boolean; // el bloque ya existe en el servidor: su ejercicio no se puede cambiar, solo quitar el bloque
  onChange: (block: DraftBlock) => void;
  onPick: (slotIndex: number) => void;
  onSave: () => void;
  onRest: () => void;
  onRemove: () => void;
}

// Un bloque (ejercicio individual, superserie o triserie) dentro de la vista única. Se llena entero y se guarda UNA vez; un bloque
// guardado se pliega a un resumen y se puede volver a abrir para corregirlo.
const PlanBlockCard = ({ block, index, pending, saving, disabled, error, restSec, hints, onServer, onChange, onPick, onSave, onRest, onRemove }: PlanBlockCardProps) => {
  const saved = isSaved(block);
  const dirty = hasUnsaved(block);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [tried, setTried] = useState(false);
  const open = openOverride ?? !saved;
  const multi = block.kind !== 'single';
  const title = `${KIND_TITLE[block.kind]} ${index}`;
  const problem = blockProblem(block);

  const setSlot = (i: number, slot: DraftSlot) => {
    setTried(false);
    onChange({ ...block, slots: block.slots.map((s, j) => (j === i ? slot : s)) });
  };

  const save = () => {
    setTried(true);
    if (problem || saving) return;
    onSave();
    setOpenOverride(null);
  };

  const status = pending ? 'pending' : saved ? 'saved' : dirty && block.savedSig !== null ? 'changed' : 'draft';

  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-[24px] border shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]', saved && !open ? 'border-[#fff8e4]/12 bg-[#1f1c21]' : 'border-[#62b8cf]/30 bg-[linear-gradient(165deg,rgba(57,140,162,0.2),#1f1c21_55%)]')}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]">
            {multi && <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {title}
          </p>
          {multi && <p className="mt-0.5 text-[12px] text-[#a8a295]">{block.slots.length === 2 ? 'Dos ejercicios seguidos' : 'Tres ejercicios seguidos'}, luego descanso</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {status === 'saved' && <span className="flex items-center gap-1 rounded-full border border-[#62b8cf]/40 bg-[#398ca2]/20 px-2.5 py-1 text-[12px] font-semibold text-[#fff8e4]"><Check className="h-3.5 w-3.5 text-[#8fd0e0]" strokeWidth={3} aria-hidden="true" />Guardado</span>}
          {status === 'pending' && <span className="flex items-center gap-1 rounded-full border border-dashed border-[#e8b4a0]/60 px-2.5 py-1 text-[12px] font-semibold text-[#e8b4a0]"><CloudOff className="h-3.5 w-3.5" aria-hidden="true" />Por enviar</span>}
          {status === 'changed' && <span className="rounded-full border border-[#e8b4a0]/55 px-2.5 py-1 text-[12px] font-semibold text-[#e8b4a0]">Cambios sin guardar</span>}
          {saved && (
            <button type="button" onClick={() => setOpenOverride(!open)} aria-expanded={open} aria-label={open ? `Plegar ${title}` : `Editar ${title}`} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#8fd0e0] active:bg-[#62b8cf]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {(!saved || open) && (
            <button type="button" onClick={onRemove} aria-label={`Quitar ${title}`} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#a8a295] active:bg-[#e8b4a0]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {saved && !open ? (
        <div className="px-4 pb-3.5 pt-2">
          <ul className="space-y-1.5">
            {block.slots.map((s, i) => (
              <li key={i} className="text-[14px]">
                <span className="font-bold text-[#fff8e4]">{s.name}</span>
                <span className="block text-[12.5px] tabular-nums text-[#a8a295]">{s.groups.map((g) => groupText(s.modality, g)).join('  +  ')}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onRest} className="mt-1.5 flex min-h-[44px] items-center gap-1.5 rounded-xl text-[13.5px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
            <Play className="h-4 w-4" aria-hidden="true" /> Descansar {formatClock(restSec)}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3.5 px-4 pb-1 pt-3">
            {block.slots.map((slot, i) => (
              <div key={i} className={cn(multi && i < block.slots.length - 1 && 'border-b border-[#fff8e4]/10 pb-4')}>
                <SlotEditor slot={slot} badge={multi ? `${index}.${i + 1}` : String(index)} showErrors={tried} hint={slot.name ? hints[slot.name] ?? null : null} locked={onServer} onChange={(s) => setSlot(i, s)} onPick={() => onPick(i)} />
              </div>
            ))}
          </div>

          <div className="space-y-1 px-4 pb-4 pt-2">
            <Button disabled={saving || disabled} onClick={save} className={cn('min-h-[56px] w-full rounded-2xl text-base font-extrabold shadow-[0_10px_24px_-12px_rgba(98,184,207,0.8)]', BTN_FILL)}>
              {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check aria-hidden="true" strokeWidth={3} />}
              {saving ? 'Guardando…' : saved ? 'Guardado' : block.savedSig !== null ? 'Guardar cambios' : `Guardar ${multi ? 'bloque' : 'ejercicio'}`}
            </Button>
            <div aria-live="polite" className="min-h-[20px]">
              {tried && problem && <p role="alert" className="pt-1 text-[13px] font-semibold text-[#e8b4a0]">{problem.charAt(0).toUpperCase() + problem.slice(1)}.</p>}
              {error && (
                <div role="alert" className="mt-1.5 flex items-start gap-2 rounded-xl border border-[#e8b4a0]/60 bg-[#e8b4a0]/10 p-2.5 text-[13px] text-[#fff8e4]">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8b4a0]" aria-hidden="true" />
                  <span><span className="font-bold">No se guardó.</span> {error}</span>
                </div>
              )}
              {pending && <p className="pt-1 text-[13px] font-semibold text-[#e8b4a0]">Sin conexión: quedó guardado en este dispositivo y se enviará solo.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default PlanBlockCard;
