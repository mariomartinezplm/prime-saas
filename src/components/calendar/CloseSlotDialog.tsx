import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { availabilityService } from '@/services/availabilityService';
import { slotClosureService } from '@/services/slotClosureService';
import LoadingState from '@/components/shared/LoadingState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import SubmitButton from '@/components/forms/SubmitButton';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import type { SlotClosure, User } from '@/types';

interface CloseSlotDialogProps {
  open: boolean;
  onClose: () => void;
  // Quién cierra: el profesional, en su propia agenda; el administrador elige de quién
  isAdmin: boolean;
  ownId: string;
  professionals: User[];
  defaultProfessionalId: string;
  // Horas ya cerradas del profesional que se muestra (para marcarlas)
  closures: SlotClosure[];
  onClosed: () => void;
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Cerrar horario: eliges el día y la hora; no se suman más pacientes, y los que ya están se mantienen
const CloseSlotDialog = ({ open, onClose, isAdmin, ownId, professionals, defaultProfessionalId, closures, onClosed }: CloseSlotDialogProps) => {
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Cada vez que se abre, parte de hoy y del profesional que se está viendo
  useEffect(() => {
    if (!open) return;
    setProfessionalId(defaultProfessionalId);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSelected(null);
  }, [open, defaultProfessionalId]);

  // Horas de atención de ese día (las mismas con las que se agenda)
  useEffect(() => {
    if (!open || !date || !professionalId) return;
    let active = true;
    setLoading(true);
    setError(false);
    setSelected(null);
    availabilityService
      .getSlots(professionalId, date)
      .then((s) => active && setHours([...new Set([...s.availableSlots, ...s.bookedSlots, ...(s.blockedSlots ?? [])])].sort()))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, date, professionalId, attempt]);

  const alreadyClosed = new Set(closures.filter((c) => c.professional === professionalId && c.date === date).map((c) => c.startTime));
  // Una hora que ya terminó no se puede cerrar
  const isPast = (slot: string) => {
    if (date !== format(new Date(), 'yyyy-MM-dd')) return false;
    const now = new Date();
    return toMin(slot) + 60 <= now.getHours() * 60 + now.getMinutes();
  };

  const close = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const closure = await slotClosureService.close(professionalId, { date, startTime: selected });
      notify.success(
        closure.present === 0
          ? `Horario de las ${selected} cerrado.`
          : `Horario de las ${selected} cerrado. ${closure.present === 1 ? 'La persona que ya está se mantiene' : `Las ${closure.present} personas que ya están se mantienen`}.`
      );
      onClosed();
      onClose();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo cerrar el horario');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar horario</DialogTitle>
          <DialogDescription>No se suman más pacientes a esa hora. Las personas que ya están agendadas se mantienen.</DialogDescription>
        </DialogHeader>

        <form id="close-slot-form" onSubmit={close} className="space-y-4 py-2">
          {isAdmin && professionals.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="close-slot-professional">Profesional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger id="close-slot-professional"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.id === ownId ? 'Yo' : `${p.firstName} ${p.lastName}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="close-slot-date">Día</Label>
            <Input id="close-slot-date" type="date" min={format(new Date(), 'yyyy-MM-dd')} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {date && (
            <div className="space-y-2">
              <Label>Hora que quieres cerrar</Label>
              {loading ? (
                <LoadingState className="py-6" label="Cargando horarios…" />
              ) : error ? (
                <LoadErrorAlert message="No se pudieron cargar los horarios de ese día." onRetry={() => setAttempt((n) => n + 1)} />
              ) : !hours || hours.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios de atención ese día.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horas del día">
                  {hours.map((slot) => {
                    const closed = alreadyClosed.has(slot);
                    const disabled = closed || isPast(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected === slot}
                        aria-label={`${slot}${closed ? ', ya cerrado' : ''}`}
                        onClick={() => setSelected(slot)}
                        className={cn(
                          'min-h-[44px] rounded-md border border-border px-2 py-2.5 text-center text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          disabled ? 'cursor-not-allowed bg-muted text-muted-foreground' : 'hover:bg-muted',
                          selected === slot && 'border-primary bg-primary/10 ring-2 ring-primary'
                        )}
                      >
                        {slot}
                        {closed && <span className="block text-[10px] font-normal">cerrado</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selected && (
            <Alert>
              <Lock className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Se cerrará el horario de las {selected}. Tampoco se podrá agendar a las {String(Math.floor((toMin(selected) - 30) / 60)).padStart(2, '0')}:{(toMin(selected) - 30) % 60 === 0 ? '00' : '30'} ni a las {String(Math.floor((toMin(selected) + 30) / 60)).padStart(2, '0')}:{(toMin(selected) + 30) % 60 === 0 ? '00' : '30'}, porque cada sesión dura 1 hora y se juntaría con esta. Tú y el equipo sí pueden agregar a alguien confirmando un aviso, y puedes reabrirlo cuando quieras.
              </AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <SubmitButton form="close-slot-form" disabled={!selected} loading={submitting} loadingLabel="Cerrando…" className="w-full">
            Cerrar horario
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CloseSlotDialog;
