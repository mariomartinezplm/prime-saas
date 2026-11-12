import { Ban, Dumbbell, Weight } from 'lucide-react';
import {
  ECCENTRIC_SEC_MAX,
  EXECUTION_LABEL,
  IMPLEMENT_LABEL,
  IMPLEMENT_SHORT,
  MINI_BANDS,
  POWER_BANDS,
  POWER_BAND_COLOR,
  coerceAttributes,
  executionOptionsFor,
  implementOptionsFor,
  isBand,
  modalityForBand,
  type Attributes,
  type Execution,
  type Implement,
  type Modality,
} from '@/lib/exerciseAttributes';
import { cn } from '@/lib/utils';

interface ExerciseAttributeFieldsProps {
  modality: Modality;
  value: Attributes;
  // Si al elegir una banda cambia también la forma de medir (con kg → sin kg), se avisa en el 2.º parámetro y quien lo usa aplica los dos cambios
  onChange: (next: Attributes, modality?: Modality) => void;
  // 'workout' = tarjetas oscuras del entrenamiento · 'form' = formularios con los colores del tema
  tone?: 'workout' | 'form';
  // Un ejercicio ya guardado no cambia de forma de medirse: solo se muestra
  disabled?: boolean;
}

const ImplementIcon = ({ implement }: { implement: Implement }) =>
  implement === 'two_dumbbells' ? (
    <span className="flex" aria-hidden="true"><Dumbbell className="h-3.5 w-3.5" /><Dumbbell className="-ml-1 h-3.5 w-3.5" /></span>
  ) : implement === 'one_dumbbell' ? (
    <Dumbbell className="h-4 w-4" aria-hidden="true" />
  ) : implement === 'barbell' ? (
    <Weight className="h-4 w-4" aria-hidden="true" />
  ) : (
    <Ban className="h-4 w-4" aria-hidden="true" />
  );

const TONES = {
  workout: {
    label: 'text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#a8a295]',
    group: 'overflow-hidden rounded-[14px] border border-[#fff8e4]/15',
    on: 'bg-[#398ca2] font-extrabold text-[#181619]',
    off: 'text-[#cdc6b6]',
    ring: 'focus-visible:ring-[#fff8e4]',
    input: 'border border-[#fff8e4]/15 bg-transparent text-[#fff8e4] placeholder:text-[#a8a295]',
    hint: 'text-[12.5px] text-[#a8a295]',
  },
  form: {
    label: 'text-sm font-medium text-foreground',
    group: 'overflow-hidden rounded-lg border border-border',
    on: 'bg-primary font-semibold text-primary-foreground',
    off: 'text-muted-foreground hover:bg-muted',
    ring: 'focus-visible:ring-ring',
    input: 'border border-input bg-background text-foreground placeholder:text-muted-foreground',
    hint: 'text-xs text-muted-foreground',
  },
} as const;

// Ejecución (normal · excéntrico · isométrico) e implemento (barra · una mancuerna · dos mancuernas · sin implemento): los mismos
// controles para el profesional y el paciente. Solo se ofrece lo que tiene sentido con la modalidad elegida.
const ExerciseAttributeFields = ({ modality, value, onChange, tone = 'form', disabled }: ExerciseAttributeFieldsProps) => {
  const t = TONES[tone];
  const executions = executionOptionsFor(modality);
  const implements_ = implementOptionsFor(modality);
  const showWeightImplements = implements_.includes('barbell'); // barra y mancuernas solo existen con carga en kg
  const set = (patch: Attributes) => onChange(coerceAttributes(modality, { ...value, ...patch }));
  // Una banda reemplaza al peso: si el ejercicio se medía con kg, pasa a medirse por repeticiones (o por tiempo)
  const pickBand = (band: Implement) => {
    if (value.implement === band) return set({ implement: null });
    const next = modalityForBand(modality);
    onChange(coerceAttributes(next, { ...value, implement: band }), next === modality ? undefined : next);
  };

  const segment = (selected: boolean, label: React.ReactNode, onClick: () => void, key: string, pressedLabel: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={selected}
      aria-label={pressedLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn('flex min-h-[44px] flex-1 items-center justify-center gap-1.5 px-0.5 text-[11.5px] leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-60', t.ring, selected ? t.on : t.off)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className={cn('mb-1', t.label)}>Ejecución</p>
        <div role="group" aria-label="Cómo se realiza el ejercicio" className={cn('flex', t.group)}>
          {executions.map((e: Execution) => segment(value.execution === e, EXECUTION_LABEL[e], () => set({ execution: value.execution === e ? null : e }), e, `${EXECUTION_LABEL[e]}${value.execution === e ? ' (elegido)' : ''}`))}
        </div>
        {value.execution === 'eccentric' && (
          <label className="mt-2 flex items-center gap-2">
            <span className={t.hint}>Fase excéntrica (opcional)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={ECCENTRIC_SEC_MAX}
              step={1}
              disabled={disabled}
              value={value.eccentricSec ?? ''}
              onChange={(e) => {
                const n = e.target.value === '' ? null : Math.max(1, Math.min(ECCENTRIC_SEC_MAX, Math.round(Number(e.target.value))));
                set({ eccentricSec: n });
              }}
              aria-label="Segundos de la fase excéntrica"
              className={cn('h-10 w-16 rounded-lg px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2', t.input, t.ring)}
            />
            <span className={t.hint}>s</span>
          </label>
        )}
      </div>

      {showWeightImplements && (
        <div>
          <p className={cn('mb-1', t.label)}>Implemento</p>
          <div role="group" aria-label="Con qué implemento se realiza" className={cn('grid grid-cols-4', t.group)}>
            {implements_.map((i: Implement) =>
              segment(
                value.implement === i,
                <span className="flex flex-col items-center gap-0.5"><ImplementIcon implement={i} /><span>{IMPLEMENT_SHORT[i]}</span></span>,
                () => set({ implement: value.implement === i ? null : i }),
                i,
                `${IMPLEMENT_SHORT[i]}${value.implement === i ? ' (elegido)' : ''}`
              )
            )}
          </div>
          {value.implement === 'two_dumbbells' && <p className={cn('mt-1', t.hint)}>Anota el peso de UNA mancuerna: no se suma.</p>}
        </div>
      )}

      <div>
        <p className={cn('mb-1', t.label)}>Banda elástica</p>
        <p className={cn('mb-1.5', t.hint)}>Power Band</p>
        <div role="group" aria-label="Power Band, por color" className={cn('grid grid-cols-5', t.group)}>
          {POWER_BANDS.map((b) =>
            segment(
              value.implement === b,
              <span className="flex flex-col items-center gap-1">
                <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-[#fff8e4]/60" style={{ backgroundColor: POWER_BAND_COLOR[b] }} />
                <span>{IMPLEMENT_SHORT[b]}</span>
              </span>,
              () => pickBand(b),
              b,
              `${IMPLEMENT_LABEL[b]}${value.implement === b ? ' (elegida)' : ''}`
            )
          )}
        </div>
        <p className={cn('mb-1.5 mt-2', t.hint)}>Mini Band</p>
        <div role="group" aria-label="Mini Band, por nivel" className={cn('grid grid-cols-4', t.group)}>
          {MINI_BANDS.map((b) => segment(value.implement === b, IMPLEMENT_SHORT[b], () => pickBand(b), b, `${IMPLEMENT_LABEL[b]}${value.implement === b ? ' (elegida)' : ''}`))}
        </div>
        {(isBand(value.implement) || modality === 'weight' || modality === 'weight_time') && (
          <p className={cn('mt-1', t.hint)}>Con banda no se anota peso en kg: se mide por repeticiones o por tiempo.</p>
        )}
      </div>
    </div>
  );
};

export default ExerciseAttributeFields;
