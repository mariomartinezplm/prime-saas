import { useMemo, useRef, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import { BTN_FILL, CARD } from '@/components/dashboard/brand';
import { goalService, type GoalCatalog, type GoalView } from '@/services/goalService';
import { DECIMAL_HELP, INVALID_NUMBER, parseDecimal } from '@/lib/decimal';
import { todayLocal } from '@/lib/evolutionDate';
import { pendingCheckins } from '@/lib/goals';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

const skipKey = (userId: string) => `prime.goals-checkin-skip.${userId}`;
const readSkip = (userId: string): string | null => {
  try {
    return localStorage.getItem(skipKey(userId));
  } catch {
    return null;
  }
};

interface WeeklyCheckinProps {
  userId: string;
  goals: GoalView[];
  catalog: GoalCatalog | null;
  onSaved: (goal: GoalView) => void;
  className?: string;
}

// Check-in semanal OPCIONAL: una o dos preguntas breves, solo de lo que todavía no tenemos por otro camino y que no se
// registró esta semana. «Ahora no» lo oculta por hoy. Lo que se responde queda como autorreporte.
const WeeklyCheckin = ({ userId, goals, catalog, onSaved, className }: WeeklyCheckinProps) => {
  const [skippedToday, setSkippedToday] = useState(() => readSkip(userId) === todayLocal());
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const ids = useRef<Record<string, string>>({});
  const pending = useMemo(() => pendingCheckins(goals, catalog, todayLocal()), [goals, catalog]);
  if (skippedToday || pending.length === 0) return null;

  const save = async (p: (typeof pending)[number]) => {
    const parsed = parseDecimal(values[p.seriesKey]);
    if (parsed === null) return setErrors((e) => ({ ...e, [p.seriesKey]: 'Escribe el valor' }));
    if (parsed === INVALID_NUMBER) return setErrors((e) => ({ ...e, [p.seriesKey]: DECIMAL_HELP }));
    setSaving(p.seriesKey);
    try {
      ids.current[p.seriesKey] ??= `wc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // un reintento no duplica el registro
      onSaved(await goalService.checkin(p.goalId, { seriesKey: p.seriesKey, value: parsed, clientId: ids.current[p.seriesKey] }));
      notify.success('Registro guardado');
      setValues((v) => ({ ...v, [p.seriesKey]: '' }));
    } catch (err) {
      showApiError(err, 'No se pudo guardar el registro');
    } finally {
      setSaving(null);
    }
  };

  const skip = () => {
    try {
      localStorage.setItem(skipKey(userId), todayLocal());
    } catch {
      // sin almacenamiento: vuelve a aparecer al recargar, sin consecuencias
    }
    setSkippedToday(true);
  };

  return (
    <section aria-label="Check-in semanal" className={cn(CARD, 'space-y-3 p-4', className)}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#8fd0e0]"><ClipboardCheck className="h-5 w-5" /></span>
        <div>
          <h2 className="text-[15.5px] font-bold text-[#fff8e4]">Tu check-in de la semana</h2>
          <p className="text-[12.5px] text-[#a8a295]">Opcional y breve. Lo que respondas queda como autorreporte.</p>
        </div>
      </div>
      {pending.map((p) => (
        <form key={p.seriesKey} noValidate onSubmit={(e) => { e.preventDefault(); save(p); }} className="space-y-2 rounded-xl border border-[#fff8e4]/10 p-3">
          <FormField label={p.question} error={errors[p.seriesKey]}>
            {(c) => (
              <div className="flex gap-2">
                <Input {...c} type="text" inputMode="decimal" autoComplete="off" value={values[p.seriesKey] ?? ''} onChange={(e) => { setValues({ ...values, [p.seriesKey]: e.target.value }); setErrors({ ...errors, [p.seriesKey]: '' }); }} className="h-12 flex-1 border-[#fff8e4]/40 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]" placeholder={p.unit === '/10' ? `${p.range.min} a ${p.range.max}` : p.unit} />
                <Button type="submit" disabled={saving === p.seriesKey} className={cn('min-h-[48px] rounded-xl px-5 font-bold', BTN_FILL)}>{saving === p.seriesKey ? '…' : 'Guardar'}</Button>
              </div>
            )}
          </FormField>
          {p.scaleHint && <p className="text-[12.5px] font-medium text-[#cdc6b6]">{p.scaleHint}</p>}
          <p className="text-[12px] text-[#a8a295]">Objetivo: {p.goalName}</p>
        </form>
      ))}
      <Button type="button" variant="ghost" onClick={skip} className="min-h-[44px] w-full text-[#a8a295] hover:bg-transparent hover:text-[#cdc6b6]">Ahora no</Button>
    </section>
  );
};

export default WeeklyCheckin;
