import { useRef, useState } from 'react';
import BottomSheet from '@/components/premium/BottomSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import { goalService, type GoalView, type IndicatorProgress } from '@/services/goalService';
import { DECIMAL_HELP, INVALID_NUMBER, parseDecimal } from '@/lib/decimal';
import { BTN_FILL } from '@/components/dashboard/brand';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { indicatorDefOf, paramsText } from '@/lib/goals';
import { todayLocal } from '@/lib/evolutionDate';
import type { CatalogCategory } from '@/services/goalService';

interface CheckinSheetProps {
  goal: GoalView;
  indicator: IndicatorProgress;
  category?: CatalogCategory;
  onClose: () => void;
  onSaved: (goal: GoalView) => void;
  staff?: boolean;
}

// Registro manual de un indicador que el centro todavía no mide por otro lado. Queda guardado como AUTORREPORTE.
const CheckinSheet = ({ goal, indicator, category, onClose, onSaved, staff }: CheckinSheetProps) => {
  const def = indicatorDefOf(category, indicator.indicatorId);
  const [text, setText] = useState('');
  const [day, setDay] = useState(todayLocal());
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const clientId = useRef(`ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`); // el mismo envío reintentado no se duplica
  const detail = paramsText(indicator, category);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsed = parseDecimal(text);
    if (parsed === null) return setError('Escribe el valor');
    if (parsed === INVALID_NUMBER) return setError(DECIMAL_HELP);
    if (def && (parsed < def.range.min || parsed > def.range.max)) return setError(`El valor debe estar entre ${def.range.min} y ${def.range.max}`);
    if (!day) return setError('Elige la fecha');
    if (day > todayLocal()) return setError('La fecha no puede ser futura');
    setSaving(true);
    try {
      const updated = await goalService.checkin(goal.id, { seriesKey: indicator.seriesKey, value: parsed, day, clientId: clientId.current });
      notify.success('Registro guardado');
      onSaved(updated);
      onClose();
    } catch (err) {
      showApiError(err, 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open onOpenChange={(open) => !open && onClose()} title="Registrar un valor" description={`${indicator.label}${detail ? ` · ${detail}` : ''}`}>
      <form onSubmit={submit} noValidate className="space-y-4 pb-2">
        <FormField label={`Valor (${indicator.unit === '/10' && def ? `de ${def.range.min} a ${def.range.max}` : indicator.unit})`} required error={error} hint={def?.scaleHint}>
          {(c) => (
            <Input {...c} type="text" inputMode="decimal" autoComplete="off" value={text} onChange={(e) => { setText(e.target.value); setError(undefined); }} className="h-12 border-[#fff8e4]/40 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]" />
          )}
        </FormField>
        <FormField label={def?.datedEntry ? 'Fecha en que te tomaste el examen' : 'Fecha del registro'} required>
          {(c) => <Input {...c} type="date" max={todayLocal()} value={day} onChange={(e) => setDay(e.target.value)} className="h-12 border-[#fff8e4]/40 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]" />}
        </FormField>
        <p className="text-[12.5px] text-[#a8a295]">
          {staff ? 'Queda guardado con esa fecha como registro del profesional.' : indicator.origin === 'autorreporte' ? 'Lo que registres aquí queda marcado como autorreporte: es tu declaración, no una medición validada.' : 'Queda guardado con esa fecha.'}
        </p>
        <Button type="submit" disabled={saving} className={`min-h-[48px] w-full rounded-2xl text-base font-bold ${BTN_FILL}`}>
          {saving ? 'Guardando…' : 'Guardar registro'}
        </Button>
      </form>
    </BottomSheet>
  );
};

export default CheckinSheet;
