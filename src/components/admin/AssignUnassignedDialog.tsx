import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SubmitButton from '@/components/forms/SubmitButton';
import { userService } from '@/services/userService';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';

interface AssignUnassignedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  defaultProfessionalId?: string;
  onAssigned: () => void;
}

// Asigna un profesional a TODOS los pacientes que hoy no tienen uno. No cambia a quienes ya tienen profesional.
const AssignUnassignedDialog = ({ open, onOpenChange, count, defaultProfessionalId, onAssigned }: AssignUnassignedDialogProps) => {
  const { staff } = useActiveStaff(open);
  const [professionalId, setProfessionalId] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) setProfessionalId(defaultProfessionalId ?? '');
  }, [open, defaultProfessionalId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professionalId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const modified = await userService.assignUnassigned(professionalId);
      notify.success(modified === 1 ? 'Se asignó 1 paciente' : `Se asignaron ${modified} pacientes`);
      onAssigned();
      onOpenChange(false);
    } catch (err: unknown) {
      showApiError(err, 'No se pudo asignar el profesional');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const selected = staff.find((s) => s.id === professionalId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar profesional</DialogTitle>
          <DialogDescription>
            {count === 1 ? 'Hay 1 paciente' : `Hay ${count} pacientes`} sin profesional asignado. Elige quién los atiende: solo cambia a quienes hoy no tienen profesional.
          </DialogDescription>
        </DialogHeader>
        <form id="assign-unassigned-form" onSubmit={submit} className="space-y-2 py-2">
          <Label htmlFor="assign-professional">Profesional que los atiende</Label>
          <Select value={professionalId} onValueChange={setProfessionalId}>
            <SelectTrigger id="assign-professional">
              <SelectValue placeholder="Elige un profesional" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <p className="text-sm text-muted-foreground">
              {count === 1 ? 'Ese paciente quedará' : `Esos ${count} pacientes quedarán`} con {selected.firstName} {selected.lastName}. Después puedes cambiar a uno por uno desde su ficha.
            </p>
          )}
        </form>
        <DialogFooter>
          <SubmitButton form="assign-unassigned-form" disabled={!professionalId} loading={saving} loadingLabel="Asignando…" className="w-full">
            Asignar {count === 1 ? 'a 1 paciente' : `a ${count} pacientes`}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignUnassignedDialog;
