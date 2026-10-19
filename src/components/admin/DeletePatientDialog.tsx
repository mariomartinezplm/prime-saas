import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/services/userService';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';

interface DeletePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  onDeleted: () => void;
}

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

// Borra al paciente y TODO lo suyo (citas, planes, evolución, archivos). No se puede deshacer.
const DeletePatientDialog = ({ open, onOpenChange, patientId, patientName, onDeleted }: DeletePatientDialogProps) => {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const matches = normalize(typed) === normalize(patientName);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await userService.permanentDelete(patientId, typed);
      notify.success('Paciente eliminado');
      onOpenChange(false);
      onDeleted();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar al paciente');
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar paciente definitivamente</DialogTitle>
          <DialogDescription>
            Se borrarán {patientName} y todo lo suyo: citas, planes, sesiones, evolución, archivos y fotos. No se puede deshacer. Úsalo solo con pacientes de prueba; si solo quieres que deje de usar la app, desactívalo.
          </DialogDescription>
        </DialogHeader>
        <form id="delete-patient-form" onSubmit={submit} className="space-y-2 py-2">
          <Label htmlFor="delete-patient-name">Para confirmar, escribe: <strong>{patientName}</strong></Label>
          <Input
            id="delete-patient-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="submit" form="delete-patient-form" variant="destructive" disabled={!matches || deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeletePatientDialog;
