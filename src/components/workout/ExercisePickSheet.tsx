import { useEffect, useRef, useState } from 'react';
import { Dumbbell, History, Plus, Search, Star } from 'lucide-react';
import BottomSheet from '@/components/premium/BottomSheet';
import { workoutService, type ExerciseSearch, type ExerciseSuggestion, type Modality } from '@/services/workoutService';
import type { Reference } from '@/lib/workoutPlan';

export interface PickedExercise {
  name: string;
  modality: Modality;
  existing: boolean;
  // Lo último que la persona anotó en este ejercicio (para partir de ahí); null si es nuevo
  reference: (Reference & { date: string }) | null;
}

interface ExercisePickSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // Ejercicios que ya están en el mismo bloque (un bloque no repite el mismo ejercicio)
  taken: string[];
  onPick: (picked: PickedExercise) => void;
}

const lastText = (last: ExerciseSuggestion['last']) => {
  const parts: string[] = [];
  if (last.reps) parts.push(`${last.reps} rep`);
  if (last.durationSec) parts.push(`${last.durationSec} s`);
  if (last.weight) parts.push(`${String(last.weight).replace('.', ',')} ${last.weightUnit}`);
  return parts.join(' · ');
};

// Buscar un ejercicio del propio historial o crear uno nuevo (los nombres distintos nunca se mezclan)
const ExercisePickSheet = ({ open, onOpenChange, title, taken, onPick }: ExercisePickSheetProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExerciseSearch | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults(null);
    const t = window.setTimeout(() => input.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  // Búsqueda en el historial propio (con una breve espera mientras se escribe)
  useEffect(() => {
    if (!open) return;
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
  }, [open, query]);

  const takenKeys = new Set(taken.map((n) => n.toLowerCase()));
  const clean = query.replace(/\s+/g, ' ').trim();
  const canCreate = clean.length >= 2 && clean.length <= 60 && !results?.exact;

  const fromSuggestion = (s: ExerciseSuggestion): PickedExercise => ({
    name: s.name,
    modality: s.last.modality ?? 'weight',
    existing: true,
    reference: s.refDate ? { reps: s.last.reps, weight: s.last.weight, durationSec: s.last.durationSec, weightUnit: s.last.weightUnit, date: s.refDate } : null,
  });

  const list = (heading: string, icon: React.ReactNode, items: ExerciseSuggestion[]) =>
    items.length > 0 && (
      <div className="mt-4">
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#a8a295]">{icon}{heading}</p>
        <ul>
          {items.map((s) => {
            const isTaken = takenKeys.has(s.name.toLowerCase());
            return (
              <li key={s.name} className="border-t border-[#fff8e4]/10 first:border-t-0">
                <button type="button" disabled={isTaken} onClick={() => onPick(fromSuggestion(s))} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors active:bg-[#62b8cf]/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
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
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description="Busca en tu historial o escribe uno nuevo. Los ejercicios distintos nunca se mezclan.">
      <div className="pb-2 pt-1">
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#62b8cf] bg-[#181619] px-3.5">
          <Search className="h-5 w-5 shrink-0 text-[#8fd0e0]" aria-hidden="true" />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value.slice(0, 60))} placeholder="Buscar o escribir un ejercicio" aria-label="Buscar ejercicio" autoComplete="off" enterKeyHint="search" className="h-[52px] w-full bg-transparent text-[17px] text-[#fff8e4] placeholder:text-[#a8a295] focus-visible:outline-none" />
        </div>

        {canCreate && (
          <button type="button" onClick={() => onPick({ name: clean.charAt(0).toUpperCase() + clean.slice(1), modality: 'weight', existing: false, reference: null })} className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-dashed border-[#62b8cf]/70 px-3.5 text-left text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
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
          clean ? (
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
          )
        )}
      </div>
    </BottomSheet>
  );
};

export default ExercisePickSheet;
