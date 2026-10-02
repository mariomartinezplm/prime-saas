import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import { showApiError } from '@/lib/apiError';
import { toast } from 'sonner';
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

const TYPE_LABELS: Record<AppointmentType, string> = {
  kinesiologia: 'Kinesiología',
  entrenamiento: 'Entrenamiento',
  evaluacion: 'Evaluación',
};

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
    setLoadingSlots(true);
    setSelectedSlot(null);
    availabilityService
      .getSlots(professionalId, date)
      .then(setSlots)
      .catch(() => {
        setSlots(null);
        toast.error('No se pudieron cargar los horarios');
      })
      .finally(() => setLoadingSlots(false));
  }, [date, professionalId]);

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
      toast.success(selectedIsFull ? 'Cita agendada como sobrecupo' : 'Cita agendada');
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
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo de sesión</Label>
            <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as AppointmentType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
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
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-secondary" />
                </div>
              ) : allSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios configurados para este día.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {allSlots.map((slot) => {
                      const isFull = slots!.bookedSlots.includes(slot);
                      const isBlocked = !!slots!.blockedSlots?.includes(slot);
                      const selectable = !isBlocked && (!isFull || canOverbook);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!selectable}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'py-2 px-2 rounded-md text-sm font-medium text-center transition-all',
                            !isFull && !isBlocked && 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
                            isFull && canOverbook && 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
                            isFull && !canOverbook && 'bg-red-500/20 text-red-400 cursor-not-allowed',
                            isBlocked && 'bg-gray-500/20 text-gray-400 cursor-not-allowed',
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
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                El horario {selectedSlot} ya tiene el máximo de pacientes simultáneos. Esta cita quedará marcada como sobrecupo.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleBook} disabled={!selectedSlot || submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {selectedIsFull ? 'Agendar como sobrecupo' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBookingDialog;
