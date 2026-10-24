import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  BILLING_CYCLE_LABELS,
  PLAN_TERMS,
  TERM_LABELS,
  previewPlanEnd,
  type BillingCycle,
  type PlanTerm,
} from '@/config/planCatalog';

interface PlanTermFieldsProps {
  term: PlanTerm;
  billingCycle: BillingCycle;
  onTermChange: (term: PlanTerm) => void;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  // Versión corta para filas de listas: sin la explicación de abajo
  compact?: boolean;
  // El plan anual (Miembro Fundador) lo deja solo el administrador
  allowAnnual?: boolean;
}

const PlanTermFields = ({ term, billingCycle, onTermChange, onBillingCycleChange, compact, allowAnnual = true }: PlanTermFieldsProps) => {
  const baseId = useId();
  const termId = `${baseId}-term`;
  const cycleId = `${baseId}-cycle`;
  return (
  <div className="space-y-3">
    <div className={compact ? 'flex flex-col sm:flex-row gap-2' : 'grid grid-cols-1 gap-3'}>
      <div className="space-y-1.5">
        {!compact && <Label htmlFor={termId}>Duración</Label>}
        <Select value={term} onValueChange={(v) => onTermChange(v as PlanTerm)}>
          <SelectTrigger id={termId} aria-label={compact ? 'Duración del plan' : undefined} className={compact ? 'sm:w-44' : undefined}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLAN_TERMS.filter((t) => allowAnnual || t !== 'anual').map((t) => (
              <SelectItem key={t} value={t}>{TERM_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        {!compact && <Label htmlFor={cycleId}>Ciclo</Label>}
        <Select value={billingCycle} onValueChange={(v) => onBillingCycleChange(v as BillingCycle)}>
          <SelectTrigger id={cycleId} aria-label={compact ? 'Ciclo de cobro' : undefined} className={compact ? 'sm:w-56' : undefined}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(BILLING_CYCLE_LABELS) as BillingCycle[]).map((c) => (
              <SelectItem key={c} value={c}>{BILLING_CYCLE_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    {!compact && (
      <p className="text-xs text-muted-foreground">
        Si se registra hoy, el plan dura hasta el {format(previewPlanEnd(term, billingCycle), 'dd/MM/yyyy')}.
        {term !== 'mensual' && ' Las sesiones se renuevan cada mes.'}
        {' '}El paciente tiene 5 días para pagar la renovación.
      </p>
    )}
  </div>
  );
};

export default PlanTermFields;
