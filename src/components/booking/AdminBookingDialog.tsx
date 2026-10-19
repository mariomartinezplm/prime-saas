import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import LoadingState from '@/components/shared/LoadingState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import SubmitButton from '@/components/forms/SubmitButton';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { TriangleAlert } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AvailableSlots, CreateAppointmentData } from '@/types';

type AppointmentType = CreateAppointmentData['type'];

interface AdminBookingDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  professionalId: string;
  defaultType: AppointmentType;
  // Solo el admin puede agendar en un horario que ya tiene el máximo de
  // pacientes (sobrecupo). El backend lo vuelve a verificar.
  canOverbook: boolean;
  onBooked: () => void;
}

const AdminBookingDialog = ({
  open,
  onClose,
  patientId,
  professionalId,
  defaultType,
  canOverbook,
  onBooked,
}: AdminBookingDialogProps) => {
  const [type, setType] = useState<AppointmentType>(defaultType);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<AvailableSlots | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slotsAttempt, setSlotsAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setDate('');
    setSlots(null);
    setSelectedSlot(null);
  }, [open, defaultType]);

  useEffect(() => {
    if (!date) return;
    // Si se cambia la fecha rápido, la respuesta de la fecha anterior se descarta
    let active = true;
    setLoadingSlots(true);
    setSlotsError(false);
    setSelectedSlot(null);
    availabilityService
      .getSlots(professionalId, date, patientId)
      .then((result) => active && setSlots(result))
      // El error se muestra junto a los horarios, con 'Reintentar' (antes un aviso que desaparecía)
      .catch(() => {
        if (!active) return;
        setSlots(null);
        setSlotsError(true);
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [date, professionalId, patientId, slotsAttempt]);

  const retrySlots = useCallback(() => setSlotsAttempt((n) => n + 1), []);

  const allSlots = slots
    ? [...slots.availableSlots, ...slots.bookedSlots, ...(slots.blockedSlots || [])].sort()
    : [];
  const selectedIsFull = !!selectedSlot && !!slots?.bookedSlots.includes(selectedSlot);

  const handleBook = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedSlot || !date || submittingRef.current) return;
    const [h, m] = selectedSlot.split(':').map(Number);
    const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await appointmentService.create({
        patient: patientId,
        professional: professionalId,
        date,
        startTime: selectedSlot,
        endTime,
        type,
        allowOverbook: selectedIsFull,
      });
      notify.success(selectedIsFull ? 'Cita agendada como sobrecupo' : 'Cita agendada');
      onBooked();
      onClose();
    } catch (err: unknown) {
      showApiError(err, 'Error al agendar la cita');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar cita</DialogTitle>
          <DialogDescription>Elige el tipo de sesión, la fecha y el horario.</DialogDescription>
        </DialogHeader>

        <form id="admin-booking-form" onSubmit={handleBook} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="admin-booking-type">Tipo de sesión</Label>
            <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
              <SelectTrigger id="admin-booking-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(appointmentTypeLabels) as AppointmentType[]).map((t) => (
                  <SelectItem key={t} value={t}>{appointmentTypeLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-booking-date">Fecha</Label>
            <Input
              id="admin-booking-date"
              type="date"
              min={format(new Date(), 'yyyy-MM-dd')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {date && (
            <div className="space-y-2">
              <Label>Horario</Label>
              {loadingSlots ? (
                <LoadingState className="py-6" label="Cargando horarios…" />
              ) : slotsError ? (
                <LoadErrorAlert message="No se pudieron cargar los horarios de ese día." onRetry={retrySlots} />
              ) : allSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios configurados para este día.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horarios del día">
                    {allSlots.map((slot) => {
                      const isFull = slots!.bookedSlots.includes(slot);
                      const isBlocked = !!slots!.blockedSlots?.includes(slot);
                      // 5 de 5: ni el sobrecupo cabe
                      const isMaxed = !!slots!.overbookFullSlots?.includes(slot);
                      const selectable = !isBlocked && (!isFull || (canOverbook && !isMaxed));
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!selectable}
                          aria-pressed={selectedSlot === slot}
                          aria-label={`${slot}, ${isBlocked ? 'bloqueado' : isMaxed ? 'lleno, 5 de 5 pacientes' : isFull ? (canOverbook ? 'ocupado, se puede agendar 1 sobrecupo' : 'ocupado') : 'disponible'}`}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'rounded-md px-2 py-2.5 text-center text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            !isFull && !isBlocked && 'bg-success/20 text-success hover:bg-success/30',
                            isFull && canOverbook && !isMaxed && 'bg-warning/20 text-warning hover:bg-warning/30',
                            isFull && (!canOverbook || isMaxed) && 'bg-destructive/20 text-destructive cursor-not-allowed',
                            isBlocked && 'bg-muted text-muted-foreground cursor-not-allowed',
                            selectedSlot === slot && 'ring-2 ring-secondary'
                          )}
                        >
                          {slot}
                          {isFull && canOverbook && !isMaxed && <span className="block text-[10px] font-normal">sobrecupo</span>}
                          {isMaxed && <span className="block text-[10px] font-normal">lleno 5/5</span>}
                        </button>
                      );
                    })}
                  </div>
                  {canOverbook && (
                    <p className="text-xs text-muted-foreground">
                      Los horarios en ámbar ya tienen 4 pacientes: puedes agendar 1 sobrecupo (máximo 5 por hora). Los pacientes solo pueden agendar hasta 4.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {selectedIsFull && (
            <Alert variant="warning">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                El horario {selectedSlot} ya tiene 4 pacientes. Esta cita será el 5.º y quedará marcada como sobrecupo.
              </AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <SubmitButton
            form="admin-booking-form"
            disabled={!selectedSlot}
            loading={submitting}
            loadingLabel="Agendando…"
            className="w-full"
          >
            {selectedIsFull ? 'Agendar como sobrecupo' : 'Agendar'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBookingDialog;
