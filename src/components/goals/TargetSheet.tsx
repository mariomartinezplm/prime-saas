import { useState } from 'react';
import BottomSheet from '@/components/premium/BottomSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/forms/FormField';
import { BTN_FILL } from '@/components/dashboard/brand';
import { goalService, type CatalogCategory, type GoalView } from '@/services/goalService';
import { INVALID_NUMBER, parseDecimal, formatDecimalInput, DECIMAL_HELP } from '@/lib/decimal';
import { formatValue, paramsText } from '@/lib/goals';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

interface TargetSheetProps {
  goal: GoalView;
  category?: CatalogCategory;
  mode: 'validate' | 'update_target';
  onClose: () => void;
  onSaved: (goal: GoalView) => void;
}

// El profesional define o cambia la meta de cada indicador. Validar activa el objetivo; cambiar una meta deja constancia
// del valor anterior en el historial.
const TargetSheet = ({ goal, category, mode, onClose, onSaved }: TargetSheetProps) => {
  const inds = goal.progress.indicators;
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(inds.map((i) => [i.seriesKey, formatDecimalInput(i.target?.value)])));
  const [tolerances, setTolerances] = useState<Record<string, string>>(Object.fromEntries(inds.map((i) => [i.seriesKey, formatDecimalInput(i.target?.tolerance)])));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const next: Record<string, string> = {};
    const targets: { seriesKey: string; value: number; tolerance?: number }[] = [];
    for (const i of inds) {
      const v = parseDecimal(values[i.seriesKey]);
      if (v === INVALID_NUMBER) next[i.seriesKey] = DECIMAL_HELP;
      else if (v === null) next[i.seriesKey] = 'Define la meta';
      else {
        const tol = parseDecimal(tolerances[i.seriesKey]);
        if (i.direction === 'maintain' && (tol === null || tol === INVALID_NUMBER || tol <= 0)) next[i.seriesKey] = 'Indica el margen (mayor que 0)';
        else targets.push({ seriesKey: i.seriesKey, value: v, ...(i.direction === 'maintain' && tol !== null && tol !== INVALID_NUMBER ? { tolerance: tol } : {}) });
      }
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const updated = await goalService.act(goal.id, { action: mode, targets, note: note.trim() || undefined });
      notify.success(mode === 'validate' ? 'Objetivo validado y activado' : 'Meta actualizada');
      onSaved(updated);
      onClose();
    } catch (err) {
      showApiError(err, 'No se pudo guardar la meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open onOpenChange={(open) => !open && onClose()} title={mode === 'validate' ? 'Validar objetivo' : 'Cambiar la meta'} description={goal.categoryName}>
      <form onSubmit={submit} noValidate className="space-y-4 pb-2">
        {inds.map((i) => (
          <div key={i.seriesKey} className="space-y-2 rounded-xl border border-[#fff8e4]/10 p-3">
            <p className="text-[14.5px] font-bold text-[#fff8e4]">{paramsText(i, category) || i.label}</p>
            <p className="text-[12.5px] text-[#a8a295]">{i.label} · inicio {i.baseline ? formatValue(i.baseline.value, i.unit) : 'sin registro todavía'}{i.target ? ` · meta actual ${formatValue(i.target.value, i.unit)}` : ''}</p>
            <FormField label={`Meta (${i.unit})`} required error={errors[i.seriesKey]}>
              {(c) => <Input {...c} type="text" inputMode="decimal" value={values[i.seriesKey]} onChange={(e) => setValues({ ...values, [i.seriesKey]: e.target.value })} className="h-12 border-[#fff8e4]/20 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]" />}
            </FormField>
            {i.direction === 'maintain' && (
              <FormField label={`Margen (± ${i.unit})`} required>
                {(c) => <Input {...c} type="text" inputMode="decimal" value={tolerances[i.seriesKey]} onChange={(e) => setTolerances({ ...tolerances, [i.seriesKey]: e.target.value })} className="h-12 border-[#fff8e4]/20 bg-[#fff8e4]/[0.05] text-base text-[#fff8e4]" />}
              </FormField>
            )}
          </div>
        ))}
        <FormField label={mode === 'validate' ? 'Nota (opcional)' : 'Motivo del cambio (queda en el historial)'}>
          {(c) => <Textarea {...c} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="border-[#fff8e4]/20 bg-[#fff8e4]/[0.05] text-[#fff8e4]" />}
        </FormField>
        <Button type="submit" disabled={saving} className={cn('min-h-[48px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>{saving ? 'Guardando…' : mode === 'validate' ? 'Validar y activar' : 'Guardar meta'}</Button>
      </form>
    </BottomSheet>
  );
};

export default TargetSheet;
