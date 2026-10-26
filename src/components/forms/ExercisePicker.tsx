import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { filterExercises, lastRecordText } from '@/lib/exercisePicker';
import { cn } from '@/lib/utils';
import type { ExerciseSummary } from '@/services/exerciseService';

const CATEGORY_LABEL: Record<string, string> = { fuerza: 'Fuerza', cardio: 'Cardio', flexibilidad: 'Flexibilidad', funcional: 'Funcional', rehabilitacion: 'Rehabilitación', otro: 'Otro' };

interface ExercisePickerProps {
  // Atributos de accesibilidad que entrega FormField (id, aria-invalid, aria-describedby…)
  control: React.ComponentProps<typeof Input>;
  value: string;
  onChange: (text: string) => void;
  // Ejercicios que la persona ya tiene registrados
  options: ExerciseSummary[];
  onPick: (option: ExerciseSummary) => void;
}

// Campo «Ejercicio» con la lista de los ejercicios ya registrados: al tocarlo aparece la lista (se filtra mientras se escribe) y se
// elige uno sin escribirlo de nuevo. También se puede escribir un ejercicio nuevo. Funciona con dedo, mouse y teclado.
const ExercisePicker = ({ control, value, onChange, options, onPick }: ExercisePickerProps) => {
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = filterExercises(options, value);
  const hasList = options.length > 0;
  const expanded = open && hasList && shown.length > 0;

  // En el teléfono la lista queda debajo del campo: al abrirla se desplaza la pantalla lo justo para verla completa
  useEffect(() => {
    if (expanded) listRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [expanded]);

  const pick = (o: ExerciseSummary) => {
    setOpen(false);
    setActive(-1);
    onPick(o);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && expanded && active >= 0) {
      e.preventDefault(); // elegir de la lista no envía el formulario
      pick(shown[active]);
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault();
      e.stopPropagation(); // cierra la lista, no el diálogo que la contiene
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapper}
      className="relative"
      onBlur={(e) => {
        if (!wrapper.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Input
        {...control}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={hasList ? 'Toca para elegir uno ya registrado o escribe uno nuevo' : 'Ej: Sentadilla'}
        value={value}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        className={cn(control.className, hasList && 'pr-10')}
      />
      {hasList && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={expanded ? 'Cerrar la lista de ejercicios' : 'Ver los ejercicios ya registrados'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
      {expanded && (
        <ul ref={listRef} id={listId} role="listbox" aria-label="Ejercicios ya registrados" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <li role="presentation" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Ya registrados ({options.length})</li>
          {shown.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mouseDown (no click) para elegir antes de que el campo pierda el foco
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-2', i === active && 'bg-accent text-accent-foreground')}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{o.name}</span>
                <span className="block text-xs text-muted-foreground">{CATEGORY_LABEL[o.category] ?? 'Otro'} · Último: {lastRecordText(o)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{o.count} {o.count === 1 ? 'registro' : 'registros'}</span>
            </li>
          ))}
        </ul>
      )}
      {!expanded && hasList && value.trim() !== '' && shown.length === 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3" aria-hidden="true" />Ejercicio nuevo: no está entre los ya registrados.</p>
      )}
    </div>
  );
};

export default ExercisePicker;
