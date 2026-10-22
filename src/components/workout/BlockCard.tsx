import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Link2, Loader2, Play, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NumberStepper from '@/components/premium/NumberStepper';
import { BTN_FILL } from '@/components/dashboard/brand';
import { draftProblem, initialDraft, setText, toSetInput, type Reference, type SlotDraft } from '@/lib/workoutDraft';
import { formatClock } from '@/lib/workoutClock';
import type { SavedSet, SetInput, WorkoutBlock } from '@/services/workoutService';
import type { PendingBatch } from '@/lib/pendingSets';
import { cn } from '@/lib/utils';

const KIND_TITLE = { single: 'Ejercicio', super: 'Superserie', tri: 'Triserie' } as const;
const KIND_HINT = { single: 'Un ejercicio', super: 'Dos ejercicios seguidos', tri: 'Tres ejercicios seguidos' } as const;
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
const dateText = (iso: string) => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(iso));

interface BlockCardProps {
  block: WorkoutBlock;
  sets: SavedSet[]; // guardadas de este bloque
  pending: PendingBatch['display']; // aún sin confirmar por el servidor
  references: Record<string, (Reference & { weightUnit: 'kg' | 'lbs'; lastDate: string }) | undefined>;
  nextRestSec: number;
  onSave: (blockId: string, sets: SetInput[], display: PendingBatch['display']) => Promise<'saved' | 'pending'>;
  onEdit: (set: SavedSet) => void;
  onRest: () => void;
}

// Registro rápido de un bloque. En una superserie o triserie cada ejercicio conserva sus propias repeticiones y carga, y se puede
// omitir uno sin inventar su serie. Nada se guarda sin pulsar «Guardar».
const BlockCard = ({ block, sets, pending, references, nextRestSec, onSave, onEdit, onRest }: BlockCardProps) => {
  const multi = block.kind !== 'single';
  const lastBySlot = useMemo(() => {
    const map = new Map<string, SavedSet>();
    for (const s of sets) if (s.slot) map.set(s.slot, s);
    return map;
  }, [sets]);

  const [drafts, setDrafts] = useState<Record<string, SlotDraft>>(() => Object.fromEntries(block.slots.map((sl) => [sl.slot, initialDraft(sl, lastBySlot.get(sl.slot), references[sl.exerciseName])])));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'round' | 'pending' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const touched = useRef(new Set<string>());

  // Cuando llega la referencia de la última sesión, se usa solo en campos que la persona todavía no tocó
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const sl of block.slots) {
        if (touched.current.has(sl.slot) || lastBySlot.has(sl.slot)) continue;
        const ref = references[sl.exerciseName];
        if (ref) next[sl.slot] = { ...initialDraft(sl, undefined, ref), include: prev[sl.slot]?.include ?? true };
      }
      return next;
    });
  }, [references, block.slots, lastBySlot]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(null), 9000);
    return () => window.clearTimeout(t);
  }, [saved]);

  const patch = (slot: string, change: Partial<SlotDraft>) => {
    touched.current.add(slot);
    setTried(false);
    setDrafts((prev) => ({ ...prev, [slot]: { ...prev[slot], ...change } }));
  };

  const included = block.slots.filter((sl) => drafts[sl.slot]?.include);
  const problems = included.map((sl) => draftProblem(sl, drafts[sl.slot]));
  const canSave = included.length > 0 && problems.every((p) => p === null);
  const round = Math.max(0, ...block.slots.map((sl) => sets.filter((s) => s.slot === sl.slot).length + pending.filter((p) => p.slot === sl.slot).length)) + 1;
  const hasPrevious = block.slots.some((sl) => lastBySlot.has(sl.slot));

  const repeatPrevious = () => {
    touched.current = new Set(block.slots.map((sl) => sl.slot));
    setDrafts((prev) => Object.fromEntries(block.slots.map((sl) => {
      const last = lastBySlot.get(sl.slot);
      return [sl.slot, last ? { include: true, reps: last.reps, weight: last.weight, durationSec: last.durationSec } : prev[sl.slot]];
    })));
  };

  const submit = async () => {
    setTried(true);
    if (!canSave || saving) return;
    setSaving(true);
    const inputs = included.map((sl) => toSetInput(sl, drafts[sl.slot], newId()));
    const display = included.map((sl) => ({ slot: sl.slot, exerciseName: sl.exerciseName, reps: drafts[sl.slot].reps ?? undefined, weight: drafts[sl.slot].weight ?? undefined, durationSec: drafts[sl.slot].durationSec ?? undefined }));
    setFailed(null);
    try {
      const result = await onSave(block.blockId, inputs, display);
      // «Guardado» solo aparece cuando el servidor lo confirmó; sin conexión queda «pendiente»
      setSaved(result === 'saved' && multi && included.length === block.slots.length ? 'round' : result);
      setTried(false);
    } catch (err) {
      // El servidor rechazó el dato (no es un problema de conexión): se dice QUÉ pasó y no se muestra como guardado
      setFailed((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label={`${KIND_TITLE[block.kind]} ${block.label}`} className="overflow-hidden rounded-[24px] border border-[#62b8cf]/30 bg-[linear-gradient(165deg,rgba(57,140,162,0.2),#1f1c21_55%)] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#8fd0e0]">
            {multi && <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {KIND_TITLE[block.kind]} {block.label}
          </p>
          <p className="mt-0.5 text-[12px] text-[#a8a295]">{multi ? block.slots.map((x) => x.slot).join(' → ') + ' → descanso' : KIND_HINT[block.kind]}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full border border-[#62b8cf]/40 bg-[#398ca2]/20 px-3 py-1 text-[12px] font-semibold tabular-nums text-[#fff8e4]">{multi ? `Vuelta ${round}` : `Serie ${round}`}</span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: Math.min(8, Math.max(round, 4)) }, (_, i) => (
              <i key={i} className={cn('h-1.5 w-1.5 rounded-full', i < round - 1 ? 'bg-[#62b8cf]' : i === round - 1 ? 'bg-[#62b8cf]/45 ring-1 ring-[#62b8cf]' : 'bg-[#fff8e4]/15')} />
            ))}
          </span>
        </div>
      </div>

      <div className={cn('mt-1 px-4', !multi && 'divide-y divide-[#fff8e4]/10')}>
        {block.slots.map((sl, index) => {
          const d = drafts[sl.slot];
          const ref = references[sl.exerciseName];
          const mine = sets.filter((s) => s.slot === sl.slot);
          const mineP = pending.filter((p) => p.slot === sl.slot);
          const problem = tried && d.include ? draftProblem(sl, d) : null;
          return (
            <div key={sl.slot} className={cn('relative py-3.5 transition-opacity', multi && index < block.slots.length - 1 && 'mb-3 border-b border-[#fff8e4]/10 pb-5', !d.include && 'opacity-55')}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#62b8cf]/40 bg-[#398ca2]/15 text-sm font-extrabold text-[#8fd0e0]">{multi ? sl.slot : block.label}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 break-words text-[1.125rem] font-extrabold leading-tight tracking-tight text-[#fff8e4]">{sl.exerciseName}</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#a8a295]">
                    {ref ? `Última sesión (${dateText(ref.lastDate)}) · ${setText({ reps: ref.reps, weight: ref.weight, weightUnit: ref.weightUnit, durationSec: ref.durationSec })}` : 'Primera vez con este ejercicio'}
                    {' · '}
                    {sl.modality === 'weight' ? 'Con peso' : sl.modality === 'bodyweight' ? 'Peso corporal' : 'Por tiempo'}
                  </p>
                </div>
                {multi && (
                  <label className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-[#cdc6b6]">
                    <input type="checkbox" checked={d.include} onChange={(e) => patch(sl.slot, { include: e.target.checked })} className="peer sr-only" />
                    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#fff8e4]/30 text-transparent transition-colors peer-checked:border-[#62b8cf] peer-checked:bg-[#398ca2] peer-checked:text-[#181619] peer-focus-visible:ring-2 peer-focus-visible:ring-[#fff8e4]"><Check className="h-4 w-4" strokeWidth={3} /></span>
                    Lo hice
                  </label>
                )}
              </div>

              {d.include && (
                <div className={cn('mt-2.5 grid gap-2', sl.modality === 'weight' ? 'grid-cols-2' : 'grid-cols-1')}>
                  {sl.modality === 'time' ? (
                    <NumberStepper label="Tiempo" unit="segundos" value={d.durationSec} onChange={(v) => patch(sl.slot, { durationSec: v })} step={5} min={0} max={7200} invalid={!!problem} />
                  ) : (
                    <>
                      <NumberStepper label="Repeticiones" value={d.reps} onChange={(v) => patch(sl.slot, { reps: v })} min={0} max={999} invalid={!!problem && !d.reps} />
                      {sl.modality === 'weight' && <NumberStepper label="Carga" unit="kg" decimals step={2.5} value={d.weight} onChange={(v) => patch(sl.slot, { weight: v })} min={0} max={1000} invalid={!!problem && !d.weight} />}
                    </>
                  )}
                </div>
              )}
              {problem && <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-[#e8b4a0]">{problem} para guardar este ejercicio.</p>}

              {(mine.length > 0 || mineP.length > 0) && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={`Series de ${sl.exerciseName}`}>
                  {mine.map((s, i) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => onEdit(s)} aria-label={`Serie ${s.setNumber ?? i + 1}: ${setText(s)}. Corregir`} className="min-h-[36px] rounded-full border border-[#62b8cf]/35 bg-[#398ca2]/15 px-3 text-[12.5px] font-semibold tabular-nums text-[#fff8e4] active:bg-[#398ca2]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                        <span className="text-[#8fd0e0]">S{s.setNumber ?? i + 1}</span> {setText(s)}
                      </button>
                    </li>
                  ))}
                  {mineP.map((p, i) => (
                    <li key={`p${i}`} className="inline-flex min-h-[36px] items-center rounded-full border border-dashed border-[#e8b4a0]/60 px-3 text-[12.5px] font-semibold tabular-nums text-[#e8b4a0]">
                      Pendiente · {setText({ reps: p.reps ?? null, weight: p.weight ?? null, weightUnit: 'kg', durationSec: p.durationSec ?? null })}
                    </li>
                  ))}
                </ul>
              )}
              {multi && index < block.slots.length - 1 && (
                <div aria-hidden="true" className="absolute inset-x-0 -bottom-2.5 z-10 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8fd0e0]">
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(98,184,207,0.45))]" />
                  <Link2 className="h-3.5 w-3.5" />luego
                  <span className="h-px flex-1 bg-[linear-gradient(270deg,transparent,rgba(98,184,207,0.45))]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1 px-4 pb-4 pt-1">
        {hasPrevious && (
          <button type="button" onClick={repeatPrevious} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
            <Copy className="h-4 w-4" aria-hidden="true" />
            Repetir {multi ? 'valores de la vuelta anterior' : 'serie anterior'}
          </button>
        )}
        <Button disabled={saving} onClick={submit} className={cn('min-h-[56px] w-full rounded-2xl text-base font-extrabold shadow-[0_10px_24px_-12px_rgba(98,184,207,0.8)]', BTN_FILL)}>
          {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check aria-hidden="true" strokeWidth={3} />}
          {saving ? 'Guardando…' : multi ? (included.length === block.slots.length ? 'Guardar vuelta' : `Guardar ${included.length} de ${block.slots.length}`) : 'Guardar serie'}
        </Button>
        <div aria-live="polite" className="min-h-[24px]">
          {failed && (
            <div role="alert" className="mt-1.5 flex items-start gap-2 rounded-xl border border-[#e8b4a0]/60 bg-[#e8b4a0]/10 p-2.5 text-[13px] text-[#fff8e4]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8b4a0]" aria-hidden="true" />
              <span><span className="font-bold">No se guardó.</span> {failed}</span>
            </div>
          )}
          {(saved === 'saved' || saved === 'round') && (
            <div className="flex items-center justify-between gap-2 pt-1.5 text-[13px] text-[#cdc6b6] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
              <span className="flex items-center gap-1.5 font-semibold text-[#8fd0e0]"><Check className="h-4 w-4" aria-hidden="true" /> {saved === 'round' ? `Vuelta ${round - 1} completada` : 'Guardado'}</span>
              <button type="button" onClick={onRest} className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><Play className="h-4 w-4 text-[#8fd0e0]" aria-hidden="true" /> Descansar {formatClock(nextRestSec)}</button>
            </div>
          )}
          {tried && included.length === 0 && <p role="alert" className="pt-1.5 text-[13px] font-semibold text-[#e8b4a0]">Marca al menos un ejercicio como hecho.</p>}
          {saved === 'pending' && <p className="pt-1.5 text-[13px] font-semibold text-[#e8b4a0]">Sin conexión: quedó guardado en este dispositivo y se enviará solo.</p>}
        </div>
      </div>
    </section>
  );
};

export default BlockCard;
