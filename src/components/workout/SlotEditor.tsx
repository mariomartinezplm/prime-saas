import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import ValueTile from './ValueTile';
import ExerciseAttributeFields from '@/components/exercises/ExerciseAttributeFields';
import { attributeChips, loadTile } from '@/lib/exerciseAttributes';
import { MAX_GROUPS, MODALITY_LABEL, changeModality, groupProblem, newGroup, usesReps, usesTime, usesWeight, type DraftSlot, type Group } from '@/lib/workoutPlan';
import type { Modality } from '@/services/workoutService';
import { cn } from '@/lib/utils';

const MODALITIES: Modality[] = ['weight', 'bodyweight', 'time', 'weight_time'];

interface SlotEditorProps {
  slot: DraftSlot;
  badge: string; // «1», «2», «3» dentro del bloque
  showErrors: boolean;
  // Última vez que la persona hizo este ejercicio (si se conoce)
  hint?: string | null;
  // Un ejercicio ya guardado no cambia de nombre ni de forma de medirse (para eso se quita el bloque y se crea otro)
  locked?: boolean;
  onChange: (slot: DraftSlot) => void;
  onPick: () => void;
  // Preparar entrenamiento (portal del profesional): el nombre se elige con otro control, la carga puede quedar por definir y
  // cada ejercicio admite una indicación para el paciente
  nameControl?: React.ReactNode;
  weightOptional?: boolean;
  allowNote?: boolean;
}

// Un ejercicio dentro de un bloque: nombre, cómo se mide y sus cuadros de «series × repeticiones × carga». Si en alguna serie los
// valores cambiaron, se agrega otro cuadro (por ejemplo 3 series de 10 y 1 serie de 8).
const SlotEditor = ({ slot, badge, showErrors, hint, locked, onChange, onPick, nameControl, weightOptional = false, allowNote = false }: SlotEditorProps) => {
  const updateGroup = (id: string, patch: Partial<Group>) => onChange({ ...slot, groups: slot.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const addGroup = () => {
    const last = slot.groups[slot.groups.length - 1];
    // El cuadro nuevo parte de los valores del anterior (solo cambia lo que varió) y con 1 serie
    onChange({ ...slot, groups: [...slot.groups, { ...newGroup(slot.modality), ...(last ? { reps: last.reps, weight: last.weight, durationSec: last.durationSec } : {}), sets: 1 }] });
  };
  const removeGroup = (id: string) => onChange({ ...slot, groups: slot.groups.filter((g) => g.id !== id) });
  const multiple = slot.groups.length > 1;
  const columns = 1 + Number(usesReps(slot.modality)) + Number(usesTime(slot.modality)) + Number(usesWeight(slot.modality));

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#62b8cf]/40 bg-[#398ca2]/15 text-sm font-extrabold text-[#8fd0e0]">{badge}</span>
        {nameControl ? (
          <div className="min-w-0 flex-1">{nameControl}</div>
        ) : (
        <button type="button" onClick={onPick} disabled={locked} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <span className="min-w-0 flex-1">
            <span className={cn('line-clamp-2 break-words text-[1.0625rem] font-extrabold leading-tight tracking-tight', slot.name ? 'text-[#fff8e4]' : 'text-[#8fd0e0]')}>{slot.name ?? 'Elegir ejercicio'}</span>
            {hint && <span className="mt-0.5 block text-[12px] text-[#a8a295]">{hint}</span>}
            {!slot.name && showErrors && <span role="alert" className="mt-0.5 block text-[12.5px] font-semibold text-[#e8b4a0]">Elige el ejercicio</span>}
          </span>
          {!locked && <ChevronDown className="h-4 w-4 shrink-0 text-[#a8a295]" aria-hidden="true" />}
        </button>
        )}
      </div>

      {slot.name && (
        <>
          {locked ? (
            <p className="mt-1.5 text-[12.5px] text-[#a8a295]">{[MODALITY_LABEL[slot.modality], ...attributeChips(slot)].join(' · ')}</p>
          ) : (
          <div role="group" aria-label={`Cómo se mide ${slot.name}`} className="mt-2.5 grid grid-cols-4 overflow-hidden rounded-[14px] border border-[#fff8e4]/15">
            {MODALITIES.map((m) => (
              <button key={m} type="button" aria-pressed={slot.modality === m} onClick={() => onChange(changeModality(slot, m))} className={cn('min-h-[44px] px-0.5 text-[12px] font-semibold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]', slot.modality === m ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}>
                {MODALITY_LABEL[m]}
              </button>
            ))}
          </div>
          )}

          {!locked && (
            <div className="mt-3">
              <ExerciseAttributeFields tone="workout" modality={slot.modality} value={slot} onChange={(a) => onChange({ ...slot, execution: a.execution ?? undefined, eccentricSec: a.eccentricSec ?? undefined, implement: a.implement ?? undefined })} />
            </div>
          )}

          <div className="mt-2.5 space-y-2">
            {slot.groups.map((g, i) => {
              const problem = showErrors ? groupProblem(slot.modality, g, { weightOptional }) : null;
              return (
                <div key={g.id}>
                  {multiple && (
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#a8a295]">{i === 0 ? 'Series con estos valores' : `Otro cuadro · ${i + 1}`}</p>
                      <button type="button" onClick={() => removeGroup(g.id)} aria-label={`Quitar el cuadro ${i + 1}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#a8a295] active:bg-[#e8b4a0]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <div className={cn('grid gap-2', columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                    <ValueTile label="Series" value={g.sets} onChange={(v) => updateGroup(g.id, { sets: v })} min={0} max={20} invalid={!!problem && !g.sets} />
                    {usesReps(slot.modality) && <ValueTile label="Repeticiones" value={g.reps} onChange={(v) => updateGroup(g.id, { reps: v })} min={0} max={999} invalid={!!problem && !g.reps} />}
                    {usesTime(slot.modality) && <ValueTile label="Tiempo" unit="s" value={g.durationSec} onChange={(v) => updateGroup(g.id, { durationSec: v })} step={5} min={0} max={7200} invalid={!!problem && !g.durationSec} />}
                    {usesWeight(slot.modality) && <ValueTile label={loadTile(slot.implement).label} unit={loadTile(slot.implement).unit} decimals step={2.5} value={g.weight} onChange={(v) => updateGroup(g.id, { weight: v })} min={0} max={1000} invalid={!!problem && !g.weight && !weightOptional} />}
                  </div>
                  {problem && <p role="alert" className="mt-1 text-[12.5px] font-semibold text-[#e8b4a0]">{problem}.</p>}
                </div>
              );
            })}
          </div>

          {allowNote && (
            <label className="mt-2 block">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#a8a295]">Indicación para el paciente (opcional)</span>
              <input type="text" maxLength={200} value={slot.note ?? ''} onChange={(e) => onChange({ ...slot, note: e.target.value })} placeholder="Ej: bajar en 3 segundos" className="mt-1 h-11 w-full rounded-xl border border-[#fff8e4]/15 bg-transparent px-3 text-[14px] text-[#fff8e4] placeholder:text-[#a8a295] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]" />
            </label>
          )}

          {slot.groups.length < MAX_GROUPS && (
            <button type="button" onClick={addGroup} className="mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#62b8cf]/50 text-[13.5px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Otro cuadro (si alguna serie cambió)
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default SlotEditor;
