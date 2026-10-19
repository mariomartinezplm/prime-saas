import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SubmitButton from '@/components/forms/SubmitButton';
import GraceDaysField, { DEFAULT_GRACE_DAYS, MAX_GRACE_DAYS } from '@/components/plans/GraceDaysField';
import { clientPlanService } from '@/services/clientPlanService';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import type { ClientPlan } from '@/types';

interface EditGraceDaysDialogProps {
  plan: ClientPlan | null;
  patientName: string;
  onClose: () => void;
  onSaved: () => void;
}

// Cambia el plazo de pago de un paciente que ya tiene plan (vale también para su renovación pendiente, si la hay)
const EditGraceDaysDialog = ({ plan, patientName, onClose, onSaved }: EditGraceDaysDialogProps) => {
  const [days, setDays] = useState(DEFAULT_GRACE_DAYS);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (plan) setDays(plan.graceDays ?? DEFAULT_GRACE_DAYS);
  }, [plan]);

  const valid = Number.isInteger(days) && days >= 0 && days <= MAX_GRACE_DAYS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !valid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await clientPlanService.updateGraceDays(plan._id, days);
      notify.success('Plazo de pago actualizado');
      onSaved();
      onClose();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo actualizar el plazo de pago');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plazo de pago</DialogTitle>
          <DialogDescription>Cuánto tiempo tiene {patientName} para pagar cada renovación, desde que empieza el ciclo nuevo.</DialogDescription>
        </DialogHeader>
        <form id="grace-days-form" onSubmit={submit} className="py-2">
          {plan && <GraceDaysField id="grace-days-edit" value={days} onChange={setDays} billingCycle={plan.billingCycle ?? 'calendar'} from={new Date(plan.startDate)} />}
        </form>
        <DialogFooter>
          <SubmitButton form="grace-days-form" disabled={!valid} loading={saving} loadingLabel="Guardando…" className="w-full">
            Guardar plazo
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditGraceDaysDialog;
