import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Dumbbell, History, Plus, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomSheet from '@/components/premium/BottomSheet';
import { BTN_FILL } from '@/components/dashboard/brand';
import { workoutService, type BlockKind, type ExerciseSearch, type ExerciseSuggestion, type Modality } from '@/services/workoutService';
import { cn } from '@/lib/utils';

const KINDS: { kind: BlockKind; title: string; hint: string; count: number }[] = [
  { kind: 'single', title: 'Ejercicio individual', hint: 'Un ejercicio, varias series', count: 1 },
  { kind: 'super', title: 'Superserie', hint: 'Dos ejercicios seguidos, luego descanso', count: 2 },
  { kind: 'tri', title: 'Triserie', hint: 'Tres ejercicios seguidos, luego descanso', count: 3 },
];
const MODALITIES: { value: Modality; label: string }[] = [
  { value: 'weight', label: 'Con peso' },
  { value: 'bodyweight', label: 'Peso corporal' },
  { value: 'time', label: 'Por tiempo' },
];

interface Chosen {
  name: string;
  modality: Modality;
  existing: boolean;
}

interface BlockBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextLabel: string; // A, B, C… (solo para mostrar «A1»)
  initialKind?: BlockKind | null; // si se eligió un formato desde el estado vacío, se salta ese paso
  busy: boolean;
  onCreate: (kind: BlockKind, slots: { exerciseName: string; modality: Modality }[]) => Promise<void>;
}

const lastText = (last: ExerciseSuggestion['last']) => {
  if (last.durationSec) return `${last.durationSec} s`;
  if (last.reps && last.weight) return `${last.reps} rep · ${String(last.weight).replace('.', ',')} ${last.weightUnit}`;
  if (last.reps) return `${last.reps} rep`;
  return '';
};

// Agregar un bloque en 3 pasos dentro de una sola hoja: formato → ejercicios (buscar o crear) → modalidad y listo.
const BlockBuilder = ({ open, onOpenChange, nextLabel, initialKind, busy, onCreate }: BlockBuilderProps) => {
  const [step, setStep] = useState<'format' | 'slots' | 'pick'>('format');
  const [kind, setKind] = useState<BlockKind>('single');
  const [chosen, setChosen] = useState<(Chosen | null)[]>([]);
  const [picking, setPicking] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExerciseSearch | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    if (initialKind) {
      setKind(initialKind);
      setChosen(Array.from({ length: KINDS.find((k) => k.kind === initialKind)!.count }, () => null));
      setStep('slots');
    } else {
      setStep('format');
      setChosen([]);
    }
  }, [open, initialKind]);

  // Búsqueda en el historial propio (con una breve espera mientras se escribe)
  useEffect(() => {
    if (step !== 'pick') return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    const timer = window.setTimeout(() => {
      workoutService
        .searchExercises(query)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setError(true))
        .finally(() => !cancelled && setLoading(false));
    }, query ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, query]);

  const count = KINDS.find((k) => k.kind === kind)!.count;
  const takenKeys = new Set(chosen.filter(Boolean).map((c, i) => (i === picking ? '' : c!.name.toLowerCase())));

  const pickKind = (k: BlockKind) => {
    setKind(k);
    setChosen(Array.from({ length: KINDS.find((x) => x.kind === k)!.count }, () => null));
    setStep('slots');
  };
  const startPick = (index: number) => {
    setPicking(index);
    setQuery('');
    setResults(null);
    setStep('pick');
    window.setTimeout(() => input.current?.focus(), 80);
  };
  const choose = (value: Chosen) => {
    setChosen((prev) => prev.map((c, i) => (i === picking ? value : c)));
    setStep('slots');
  };
  const fromSuggestion = (s: ExerciseSuggestion): Chosen => ({ name: s.name, modality: s.last.modality ?? 'weight', existing: true });
  const clean = query.replace(/\s+/g, ' ').trim();
  const canCreate = clean.length >= 2 && clean.length <= 60 && !results?.exact;
  const ready = chosen.length === count && chosen.every(Boolean);

  const list = (title: string, icon: React.ReactNode, items: ExerciseSuggestion[]) =>
    items.length > 0 && (
      <div className="mt-4">
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#a8a295]">{icon}{title}</p>
        <ul>
          {items.map((s) => {
            const taken = takenKeys.has(s.name.toLowerCase());
            return (
              <li key={s.name} className="border-t border-[#fff8e4]/10 first:border-t-0">
                <button type="button" disabled={taken} onClick={() => choose(fromSuggestion(s))} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors active:bg-[#62b8cf]/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#62b8cf]/35 bg-[#398ca2]/15 text-[#8fd0e0]"><Dumbbell className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15.5px] font-semibold text-[#fff8e4]">{s.name}</span>
                    <span className="block truncate text-[12.5px] text-[#a8a295]">{[s.refDate && lastText(s.last) && `Última vez · ${lastText(s.last)}`, `${s.days} ${s.days === 1 ? 'día' : 'días'}`].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={step === 'format' ? 'Agregar bloque' : step === 'slots' ? `${KINDS.find((k) => k.kind === kind)!.title} ${nextLabel}` : `Elegir ejercicio ${nextLabel}${picking + 1}`}
      description={step === 'format' ? 'Elige según lo que te indique tu profesional.' : step === 'slots' ? 'Busca ejercicios de tu historial o crea uno nuevo.' : 'Escribe el nombre completo. Los ejercicios distintos nunca se mezclan.'}
    >
      {step === 'format' && (
        <div className="grid gap-2.5 pb-2 pt-2">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" onClick={() => pickKind(k.kind)} className="flex min-h-[72px] items-center gap-4 rounded-[18px] border border-[#fff8e4]/15 bg-[#181619]/60 p-3.5 text-left transition-colors active:border-[#62b8cf] active:bg-[#398ca2]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[#62b8cf]/35 bg-[#398ca2]/15 text-xl font-extrabold text-[#8fd0e0]">{k.count}</span>
              <span>
                <span className="block text-base font-bold text-[#fff8e4]">{k.title}</span>
                <span className="block text-[13px] text-[#a8a295]">{k.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'slots' && (
        <div className="space-y-3 pb-2 pt-2">
          {chosen.map((c, i) => (
            <div key={i} className="rounded-[18px] border border-[#fff8e4]/15 bg-[#181619]/60 p-3">
              <button type="button" onClick={() => startPick(i)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#62b8cf]/40 bg-[#398ca2]/15 text-sm font-extrabold text-[#8fd0e0]">{kind === 'single' ? nextLabel : `${nextLabel}${i + 1}`}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[15.5px] font-bold', c ? 'text-[#fff8e4]' : 'text-[#8fd0e0]')}>{c ? c.name : 'Elegir ejercicio'}</span>
                  <span className="block text-[12.5px] text-[#a8a295]">{c ? (c.existing ? 'De tu historial' : 'Ejercicio nuevo') : 'Buscar o crear'}</span>
                </span>
                <Search className="h-4 w-4 shrink-0 text-[#a8a295]" aria-hidden="true" />
              </button>
              {c && (
                <div role="group" aria-label={`Cómo se mide ${c.name}`} className="mt-2 flex overflow-hidden rounded-[14px] border border-[#fff8e4]/15">
                  {MODALITIES.map((m) => (
                    <button key={m.value} type="button" aria-pressed={c.modality === m.value} onClick={() => setChosen((prev) => prev.map((x, j) => (j === i && x ? { ...x, modality: m.value } : x)))} className={cn('min-h-[44px] flex-1 px-1 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]', c.modality === m.value ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
            <Button variant="outline" onClick={() => setStep('format')} aria-label="Cambiar formato" className="h-[52px] w-[52px] rounded-2xl border-[#fff8e4]/20 bg-transparent p-0 text-[#cdc6b6] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
              <ArrowLeft aria-hidden="true" />
            </Button>
            <Button disabled={!ready || busy} onClick={() => onCreate(kind, chosen.map((c) => ({ exerciseName: c!.name, modality: c!.modality })))} className={cn('min-h-[52px] rounded-2xl text-base font-bold', BTN_FILL)}>
              <Check aria-hidden="true" />
              Empezar {KINDS.find((k) => k.kind === kind)!.title.toLowerCase()}
            </Button>
          </div>
        </div>
      )}

      {step === 'pick' && (
        <div className="pb-2 pt-1">
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#62b8cf] bg-[#181619] px-3.5">
            <Search className="h-5 w-5 shrink-0 text-[#8fd0e0]" aria-hidden="true" />
            <input ref={input} value={query} onChange={(e) => setQuery(e.target.value.slice(0, 60))} placeholder="Buscar o escribir un ejercicio" aria-label="Buscar ejercicio" autoComplete="off" enterKeyHint="search" className="h-[52px] w-full bg-transparent text-[17px] text-[#fff8e4] placeholder:text-[#a8a295] focus-visible:outline-none" />
          </div>

          {canCreate && (
            <button type="button" onClick={() => choose({ name: clean.charAt(0).toUpperCase() + clean.slice(1), modality: 'weight', existing: false })} className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-dashed border-[#62b8cf]/70 px-3.5 text-left text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
              <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate font-bold">Crear «{clean}»</span>
            </button>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-[#e8b4a0]/50 bg-[#e8b4a0]/10 p-3 text-sm text-[#fff8e4]">
              No pudimos buscar en tu historial. Aun así puedes crear el ejercicio escribiendo su nombre.
              <button type="button" onClick={() => setQuery((q) => q + ' ')} className="ml-2 min-h-[44px] underline underline-offset-4">Reintentar</button>
            </div>
          )}
          {loading && !results && <p className="mt-4 text-sm text-[#a8a295]">Buscando en tu historial…</p>}

          {results && !error && (
            <>
              {clean ? (
                <>
                  {list('Coincidencias', <Search className="h-3.5 w-3.5" aria-hidden="true" />, results.matches)}
                  {results.matches.length === 0 && !loading && <p className="mt-4 text-sm text-[#a8a295]">No hay ejercicios con ese nombre en tu historial. Puedes crearlo arriba.</p>}
                </>
              ) : (
                <>
                  {list('Recientes', <History className="h-3.5 w-3.5" aria-hidden="true" />, results.recent)}
                  {list('Frecuentes', <Star className="h-3.5 w-3.5" aria-hidden="true" />, results.frequent.filter((f) => !results.recent.some((r) => r.name === f.name)))}
                  {results.recent.length === 0 && (
                    <div className="mt-6 rounded-2xl border border-[#fff8e4]/10 bg-[#181619]/60 p-4 text-center">
                      <p className="font-bold text-[#fff8e4]">Aún no tienes ejercicios guardados</p>
                      <p className="mt-1 text-sm text-[#a8a295]">Escribe el nombre del ejercicio que te indicaron y créalo. Quedará disponible para tus próximas sesiones.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <p className="mt-4 text-[12px] text-[#a8a295]">Solo ves ejercicios de tu propio historial. Los nombres parecidos (por ejemplo «sentadilla trasera» y «sentadilla búlgara») son ejercicios distintos.</p>
        </div>
      )}
    </BottomSheet>
  );
};

export default BlockBuilder;
