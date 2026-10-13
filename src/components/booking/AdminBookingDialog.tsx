import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import LoadingState from '@/components/shared/LoadingState';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { Loader2, TriangleAlert } from 'lucide-react';
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
    setSelectedSlot(null);
    availabilityService
      .getSlots(professionalId, date, patientId)
      .then((result) => active && setSlots(result))
      .catch(() => {
        if (!active) return;
        setSlots(null);
        notify.error('No se pudieron cargar los horarios');
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [date, professionalId, patientId]);

  const allSlots = slots
    ? [...slots.availableSlots, ...slots.bookedSlots, ...(slots.blockedSlots || [])].sort()
    : [];
  const selectedIsFull = !!selectedSlot && !!slots?.bookedSlots.includes(selectedSlot);

  const handleBook = async () => {
    if (!selectedSlot || !date) return;
    const [h, m] = selectedSlot.split(':').map(Number);
    const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

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

        <div className="space-y-4 py-2">
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
              ) : allSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios configurados para este día.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horarios del día">
                    {allSlots.map((slot) => {
                      const isFull = slots!.bookedSlots.includes(slot);
                      const isBlocked = !!slots!.blockedSlots?.includes(slot);
                      const selectable = !isBlocked && (!isFull || canOverbook);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!selectable}
                          aria-pressed={selectedSlot === slot}
                          aria-label={`${slot}, ${isBlocked ? 'bloqueado' : isFull ? (canOverbook ? 'ocupado, se puede agendar como sobrecupo' : 'ocupado') : 'disponible'}`}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'rounded-md px-2 py-2.5 text-center text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            !isFull && !isBlocked && 'bg-success/20 text-success hover:bg-success/30',
                            isFull && canOverbook && 'bg-warning/20 text-warning hover:bg-warning/30',
                            isFull && !canOverbook && 'bg-destructive/20 text-destructive cursor-not-allowed',
                            isBlocked && 'bg-muted text-muted-foreground cursor-not-allowed',
                            selectedSlot === slot && 'ring-2 ring-secondary'
                          )}
                        >
                          {slot}
                          {isFull && canOverbook && <span className="block text-[10px] font-normal">sobrecupo</span>}
                        </button>
                      );
                    })}
                  </div>
                  {canOverbook && (
                    <p className="text-xs text-muted-foreground">
                      Los horarios en ámbar ya tienen el máximo de pacientes; puedes agendar igual como sobrecupo.
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
                El horario {selectedSlot} ya tiene el máximo de pacientes simultáneos. Esta cita quedará marcada como sobrecupo.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleBook} disabled={!selectedSlot || submitting} className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {selectedIsFull ? 'Agendar como sobrecupo' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBookingDialog;
