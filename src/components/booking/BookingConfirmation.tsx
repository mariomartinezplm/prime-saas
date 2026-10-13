import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Clock, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PATIENT_CANCEL_AHEAD_HOURS } from '@/config/bookingRules';
import { capitalizeFirst } from '@/lib/utils';
import type { User } from '@/types';

interface BookingConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  professional: User;
  date: Date;
  time: string;
  loading: boolean;
}

const BookingConfirmation = ({
  open,
  onClose,
  onConfirm,
  professional,
  date,
  time,
  loading,
}: BookingConfirmationProps) => {
  const [startH, startM] = time.split(':').map(Number);
  const endTime = `${String(startH + 1).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <UserIcon className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm text-muted-foreground">Profesional</p>
              <p className="font-medium">{professional.firstName} {professional.lastName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm text-muted-foreground">Fecha</p>
              <p className="font-medium">
                {capitalizeFirst(format(date, "EEEE d 'de' MMMM, yyyy", { locale: es }))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm text-muted-foreground">Horario</p>
              <p className="font-medium tabular-nums">{time} – {endTime}</p>
            </div>
          </div>

          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Puedes cancelar hasta {PATIENT_CANCEL_AHEAD_HOURS} horas antes y la sesión vuelve a tu plan.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Reservando…
              </>
            ) : (
              'Confirmar Reserva'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingConfirmation;
