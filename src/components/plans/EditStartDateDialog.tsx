import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SubmitButton from '@/components/forms/SubmitButton';
import { clientPlanService } from '@/services/clientPlanService';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import type { ClientPlan } from '@/types';

interface EditStartDateDialogProps {
  plan: ClientPlan | null;
  patientName: string;
  onClose: () => void;
  onSaved: () => void;
}

// Cambia la fecha de inicio de un plan (si el pago cubre varios meses, mueve todos sus ciclos). Las sesiones ya usadas no cambian.
const EditStartDateDialog = ({ plan, patientName, onClose, onSaved }: EditStartDateDialogProps) => {
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (plan) setDate(format(new Date(plan.startDate), 'yyyy-MM-dd'));
  }, [plan]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !date || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await clientPlanService.updateStartDate(plan._id, date);
      notify.success('Fecha de inicio actualizada');
      onSaved();
      onClose();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo cambiar la fecha de inicio');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar fecha de inicio</DialogTitle>
          <DialogDescription>
            Plan de {patientName}. Si el pago cubre varios meses, todos sus ciclos se mueven con esta fecha. Las sesiones que ya usó se mantienen.
          </DialogDescription>
        </DialogHeader>
        <form id="start-date-form" onSubmit={submit} className="space-y-1.5 py-2">
          <Label htmlFor="plan-start-date">Nueva fecha de inicio</Label>
          <Input id="plan-start-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </form>
        <DialogFooter>
          <SubmitButton form="start-date-form" disabled={!date} loading={saving} loadingLabel="Guardando…" className="w-full">
            Guardar fecha
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditStartDateDialog;
