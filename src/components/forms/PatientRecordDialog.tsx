import { useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';
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
import { usePlanHistory } from '@/components/dashboard/usePlanHistory';

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
  const { confirmLeave } = useUnsavedChangesApi();
  const planStatus = useHasActivePlan(requirePlan ? user?.id : undefined);
  const hasActivePlan = requirePlan ? planStatus : true;
  // Sin plan vigente se consulta su historial para decir la verdad: «venció», «todavía no empieza» o «aún no tienes plan»
  const history = usePlanHistory(user?.id, requirePlan && hasActivePlan === false);

  if (hasActivePlan === null) return null;

  if (!hasActivePlan) {
    if (history.pending) return null;
    const copy =
      history.kind === 'expired'
        ? { text: 'Tu plan venció: puedes ver tu historial, pero no registrar datos nuevos.', button: 'Contacta a Prime F&H para renovar', message: 'Hola, quiero renovar mi plan en Prime F&H' }
        : history.kind === 'upcoming'
          ? { text: 'Tu plan todavía no empieza: podrás registrar datos cuando comience.', button: null, message: '' }
          : history.kind === 'none'
            ? { text: 'Aún no tienes un plan activo: podrás registrar datos cuando se active.', button: 'Consultar por WhatsApp', message: 'Hola, quiero consultar por mi plan en Prime F&H' }
            : { text: 'No tienes un plan vigente por ahora: puedes ver tu historial, pero no registrar datos nuevos.', button: 'Consultar por WhatsApp', message: 'Hola, quiero consultar por mi plan en Prime F&H' };
    return (
      <div className="max-w-xs space-y-2 rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-3 text-sm">
        <p className="flex gap-2 text-[#fff8e4]/75">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {copy.text}
        </p>
        {copy.button && (
          <Button asChild variant="outline" size="sm" className="h-auto min-h-[44px] w-full whitespace-normal border-[#398ca2] py-2 text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">
            <a href={getWhatsAppUrl(copy.message)} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {copy.button}
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {label}
      </Button>
      {/* Cerrar con Esc, la X o tocando fuera pregunta si hay datos sin guardar; al guardar se cierra directo */}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : confirmLeave(() => setOpen(false)))}>
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
