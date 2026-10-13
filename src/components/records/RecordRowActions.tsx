import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface RecordRowActionsProps {
  // Lo que se va a borrar, para el texto de confirmación: "esta medición"
  itemLabel: string;
  onEdit: () => void;
  // Si lanza un error, el diálogo se queda abierto (quien llama ya mostró el aviso)
  onDelete: () => Promise<void>;
}

const RecordRowActions = ({ itemLabel, onEdit, onDelete }: RecordRowActionsProps) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${itemLabel}`} onClick={onEdit}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Eliminar ${itemLabel}`} onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Eliminar ${itemLabel}?`}
        description="Se borra definitivamente y no se puede recuperar."
        confirmLabel="Eliminar"
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
};

export default RecordRowActions;
