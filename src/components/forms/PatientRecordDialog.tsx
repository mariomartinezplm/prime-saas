import { useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Lock, MessageCircle, Plus } from 'lucide-react';
import { getWhatsAppUrl } from '@/config/contact';

interface PatientRecordDialogProps {
  label: string;
  title: string;
  description?: string;
  // El personal puede registrar aunque el plan del paciente esté vencido
  requirePlan?: boolean;
  children: (close: () => void) => ReactNode;
}

// Botón "Registrar ..." del paciente. Con el plan vencido la pantalla queda en solo
// lectura (el servidor también lo bloquea): se muestra el aviso en vez del botón.
const PatientRecordDialog = ({ label, title, description, requirePlan = true, children }: PatientRecordDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const planStatus = useHasActivePlan(requirePlan ? user?.id : undefined);
  const hasActivePlan = requirePlan ? planStatus : true;

  if (hasActivePlan === null) return null;

  if (!hasActivePlan) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2 max-w-xs">
        <p className="flex gap-2 text-muted-foreground">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          Tu plan venció: puedes ver tu historial, pero no registrar datos nuevos.
        </p>
        <Button asChild variant="outline" size="sm" className="h-auto whitespace-normal py-2">
          <a href={getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H')} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4 mr-2" />
            Contacta a Prime F&amp;H para renovar
          </a>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children(() => setOpen(false))}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PatientRecordDialog;
