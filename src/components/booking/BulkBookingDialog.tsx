import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { availabilityService } from '@/services/availabilityService';
import { appointmentService } from '@/services/appointmentService';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { Loader2 } from 'lucide-react';
import { format, addWeeks, addDays, parseISO, getDay, isBefore, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { SERVICE_TYPE_LABELS } from '@/config/planCatalog';
import { MIN_BOOKING_AHEAD_HOURS } from '@/config/bookingRules';
import { capitalizeFirst } from '@/lib/utils';
import type { User, ClientPlan } from '@/types';

interface BulkBookingDialogProps {
  open: boolean;
  onClose: () => void;
  professional: User;
  plan: ClientPlan;
}

const DAYS_OF_WEEK = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
];

const BulkBookingDialog = ({ open, onClose, professional, plan }: BulkBookingDialogProps) => {
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [booking, setBooking] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);

  // Memorizados: si se recrearan en cada render, el efecto de abajo (que actualiza el estado)
  // se volvería a ejecutar sin parar.
  const planEnd = useMemo(() => parseISO(plan.endDate), [plan.endDate]);
  const planStart = useMemo(() => parseISO(plan.startDate), [plan.startDate]);

  useEffect(() => {
    if (selectedDay && professional) {
      // Get availability for that day of week using a sample date
      const today = new Date();
      const dayNum = parseInt(selectedDay);
      const currentDay = getDay(today);
      const diff = dayNum - currentDay;
      const sampleDate = addDays(today, diff >= 0 ? diff : diff + 7);
      const dateStr = format(sampleDate, 'yyyy-MM-dd');

      availabilityService.getSlots(professional.id, dateStr).then((slots) => {
        setAvailableTimes(slots.availableSlots);
      }).catch(() => setAvailableTimes([]));
    }
  }, [selectedDay, professional]);

  useEffect(() => {
    if (selectedDay && selectedTime) {
      // Calculate all dates for this day of week within plan range
      const dayNum = parseInt(selectedDay);
      const dates: string[] = [];
      const now = new Date();
      let current = new Date(Math.max(planStart.getTime(), now.getTime()));

      // Move to first occurrence of selectedDay
      while (getDay(current) !== dayNum) {
        current = addDays(current, 1);
      }

      // Debe ser al menos 4h desde ahora (mismo mínimo que exige el backend).
      // Comparar el horario real de la primera ocurrencia, no "ahora" a secas
      // — antes esto comparaba el propio "now" contra "now + 4h" (siempre
      // true), así que la primera ocurrencia de hoy nunca entraba en el lote,
      // sin importar qué tan lejos en el día estuviera selectedTime.
      const [firstHours, firstMinutes] = selectedTime.split(':').map(Number);
      const firstOccurrence = new Date(current);
      firstOccurrence.setHours(firstHours, firstMinutes, 0, 0);
      if (isBefore(firstOccurrence, addHours(now, MIN_BOOKING_AHEAD_HOURS))) {
        current = addDays(current, 7);
      }

      while (isBefore(current, planEnd)) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addWeeks(current, 1);
      }

      setPreview(dates);
    } else {
      setPreview([]);
    }
  }, [selectedDay, selectedTime, planStart, planEnd]);

  const handleBulkBook = async () => {
    if (!selectedTime || preview.length === 0) return;

    setBooking(true);
    try {
      const [startH, startM] = selectedTime.split(':').map(Number);
      const endTime = `${String(startH + 1).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

      const result = await appointmentService.bulkCreate({
        appointments: preview.map((date) => ({
          professional: professional.id,
          date,
          startTime: selectedTime,
          endTime,
          type: plan.serviceType,
        })),
      });

      notify.success(`${result.created.length} citas reservadas exitosamente`);
      if (result.skipped.length > 0) {
        notify.warning(`${result.skipped.length} horarios no se pudieron reservar`);
      }
      onClose();
    } catch (err: unknown) {
      showApiError(err, 'Error al reservar');
    } finally {
      setBooking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !booking && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Horario predeterminado</DialogTitle>
          <DialogDescription>
            Reserva el mismo horario todas las semanas dentro de tu plan ({SERVICE_TYPE_LABELS[plan.serviceType]}).
            Rango: {format(planStart, 'dd/MM/yyyy')} – {format(planEnd, 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-day">Día de la semana</Label>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger id="bulk-day">
                <SelectValue placeholder="Seleccionar día" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableTimes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="bulk-time">Horario</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger id="bulk-time">
                  <SelectValue placeholder="Seleccionar hora" />
                </SelectTrigger>
                <SelectContent>
                  {availableTimes.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Fechas a reservar ({preview.length})</Label>
              <div className="max-h-40 overflow-y-auto rounded border border-border p-2 space-y-1">
                {preview.map((date) => (
                  <p key={date} className="text-sm text-muted-foreground">
                    {capitalizeFirst(format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }))}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={booking}>
            Cancelar
          </Button>
          <Button onClick={handleBulkBook} disabled={booking || preview.length === 0}>
            {booking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Reservando…
              </>
            ) : (
              `Reservar ${preview.length} citas`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkBookingDialog;
