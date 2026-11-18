import { useEffect, useRef, useState } from 'react';
import { addHours, format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import SlotGrid from '@/components/booking/SlotGrid';
import LoadingState from '@/components/shared/LoadingState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import SubmitButton from '@/components/forms/SubmitButton';
import { MIN_BOOKING_AHEAD_HOURS } from '@/config/bookingRules';
import { parseDay } from '@/lib/appointments';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { capitalizeFirst } from '@/lib/utils';
import type { Appointment, AvailableSlots } from '@/types';

interface RescheduleDialogProps {
  appointment: Appointment | null;
  onClose: () => void;
  onChanged: () => void;
}

const professionalIdOf = (apt: Appointment): string => {
  const p = apt.professional as unknown;
  if (typeof p === 'string') return p;
  const o = p as { _id?: string; id?: string };
  return o._id ?? o.id ?? '';
};

// «Cambiar hora»: el paciente elige otro día y horario de su mismo profesional; al confirmar, la hora actual queda liberada.
// La sesión no se pierde (se pasa de una hora a la otra). El servidor vuelve a validar todo.
const RescheduleDialog = ({ appointment, onClose, onChanged }: RescheduleDialogProps) => {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<AvailableSlots | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const open = !!appointment;
  const professionalId = appointment ? professionalIdOf(appointment) : '';

  useEffect(() => {
    if (!appointment) return;
    setDate('');
    setSlots(null);
    setSelected(null);
  }, [appointment]);

  useEffect(() => {
    if (!open || !date || !professionalId) return;
    let active = true;
    setLoading(true);
    setError(false);
    setSelected(null);
    availabilityService
      .getSlots(professionalId, date)
      .then((s) => active && setSlots(s))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, date, professionalId, attempt]);

  if (!appointment) return null;

  const isTooSoon = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const at = new Date(`${date}T00:00:00`);
    at.setHours(h, m, 0, 0);
    return isBefore(at, addHours(new Date(), MIN_BOOKING_AHEAD_HOURS));
  };
  // Su propia hora actual no es una opción
  const isCurrent = (time: string) => date === appointment.date.slice(0, 10) && time === appointment.startTime;
  const available = slots ? slots.availableSlots.filter((s) => !isTooSoon(s) && !isCurrent(s)) : [];
  const tooSoon = slots ? slots.availableSlots.filter((s) => isTooSoon(s) && !isCurrent(s)) : [];
  const shownSlots: AvailableSlots | null = slots ? { ...slots, availableSlots: available, bookedSlots: [...slots.bookedSlots, ...slots.availableSlots.filter(isCurrent)] } : null;

  const currentLabel = `${capitalizeFirst(format(parseDay(appointment.date), "EEEE d 'de' MMMM", { locale: es }))} · ${appointment.startTime}`;

  const confirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected || !date || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await appointmentService.reschedule(appointment._id, { date, startTime: selected });
      notify.success('Cambiaste tu hora. La anterior quedó liberada.');
      onChanged();
      onClose();
    } catch (err: unknown) {
      showApiError(err, 'No se pudo cambiar la hora');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar hora</DialogTitle>
          <DialogDescription>
            Hora actual: <strong>{currentLabel}</strong>. Elige la nueva: al confirmar, la actual queda liberada y tu sesión se pasa a la nueva, sin perderla.
          </DialogDescription>
        </DialogHeader>

        <form id="reschedule-form" onSubmit={confirm} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reschedule-date">Nuevo día</Label>
            <Input id="reschedule-date" type="date" min={format(new Date(), 'yyyy-MM-dd')} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {date && (
            <div className="space-y-2">
              <Label>Nuevo horario</Label>
              {loading ? (
                <LoadingState className="py-6" label="Cargando horarios…" />
              ) : error ? (
                <LoadErrorAlert message="No se pudieron cargar los horarios de ese día." onRetry={() => setAttempt((n) => n + 1)} />
              ) : shownSlots?.planLocked ? (
                <p className="text-sm text-muted-foreground">{shownSlots.message}</p>
              ) : shownSlots ? (
                <SlotGrid slots={shownSlots} tooSoonSlots={tooSoon} selectedSlot={selected} onSelect={setSelected} />
              ) : null}
            </div>
          )}
        </form>

        <DialogFooter>
          <SubmitButton form="reschedule-form" disabled={!selected} loading={submitting} loadingLabel="Cambiando…" className="w-full">
            {selected ? `Cambiar a las ${selected}` : 'Cambiar hora'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleDialog;
