import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';

interface RecordRowActionsProps {
  // Lo que se va a borrar, para el texto de confirmación: "esta medición"
  itemLabel: string;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

const RecordRowActions = ({ itemLabel, onEdit, onDelete }: RecordRowActionsProps) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await onDelete();
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Eliminar" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {itemLabel}?</AlertDialogTitle>
            <AlertDialogDescription>Se borra definitivamente y no se puede recuperar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RecordRowActions;
