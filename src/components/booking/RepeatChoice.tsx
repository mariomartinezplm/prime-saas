import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { recurringSlotService } from '@/services/recurringSlotService';
import type { RecurringSlot } from '@/types';

export type RepeatMode = 'once' | 'weekly';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// ¿Se puede ofrecer «todas las semanas»? Solo sesiones que descuentan (kinesiología o entrenamiento) y de lunes a sábado.
export const canRepeatWeekly = (type: string, dayOfWeek: number) =>
  (type === 'kinesiologia' || type === 'entrenamiento') && dayOfWeek >= 1 && dayOfWeek <= 6;

interface RepeatChoiceProps {
  value: RepeatMode;
  onChange: (mode: RepeatMode) => void;
  dayOfWeek: number;
  time: string;
  disabled?: boolean;
  disabledReason?: string;
}

// «Solo esta fecha» o «todas las semanas a la misma hora»
const RepeatChoice = ({ value, onChange, dayOfWeek, time, disabled = false, disabledReason }: RepeatChoiceProps) => {
  const day = DAY_NAMES[dayOfWeek];
  const options: Array<{ mode: RepeatMode; title: string; hint: string }> = [
    { mode: 'once', title: 'Solo esta fecha', hint: 'Una única sesión.' },
    {
      mode: 'weekly',
      title: `Todos los ${day} a las ${time}`,
      hint: 'Agendamos las demás semanas del plan y se mantiene cuando el plan se renueva. Se puede quitar cuando quieras.',
    },
  ];

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">¿Cuántas veces?</legend>
      <div className="grid gap-2" role="radiogroup" aria-label="Repetición de la cita">
        {options.map((o) => {
          const selected = value === o.mode && !(disabled && o.mode === 'weekly');
          const off = disabled && o.mode === 'weekly';
          return (
            <button
              key={o.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={off}
              onClick={() => onChange(o.mode)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-secondary bg-secondary/10' : 'border-border hover:bg-accent/40',
                off && 'cursor-not-allowed opacity-50'
              )}
            >
              <span className="block text-sm font-medium text-foreground">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{off && disabledReason ? disabledReason : o.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default RepeatChoice;

// Deja el horario fijo después de haber agendado la primera cita. Si falla, la cita ya agendada se conserva y se avisa.
export async function saveWeeklyAfterBooking(args: {
  dayOfWeek: number;
  startTime: string;
  type: RecurringSlot['type'];
  patient?: string;
}): Promise<void> {
  try {
    const result = await recurringSlotService.create(args);
    const n = result.created.length;
    const label = `los ${DAY_NAMES[args.dayOfWeek]} a las ${args.startTime}`;
    notify.success(
      n > 0
        ? `Horario fijo guardado (${label}). Agendamos ${n} ${n === 1 ? 'sesión más' : 'sesiones más'}.`
        : `Horario fijo guardado (${label}).`
    );
    if (result.skipped.length > 0) {
      notify.warning(`No se pudo agendar: ${result.skipped.map((s) => s.label).join(', ')}.`, { duration: 9000 });
    }
  } catch (err: unknown) {
    notify.warning('La cita quedó agendada, pero no se pudo dejar el horario fijo.', { duration: 9000 });
    showApiError(err, 'No se pudo guardar el horario fijo');
  }
}
