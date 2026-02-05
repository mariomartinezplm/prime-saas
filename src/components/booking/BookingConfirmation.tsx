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
    <Dialog open={open} onOpenChange={onClose}>
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
                {format(date, "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm text-muted-foreground">Horario</p>
              <p className="font-medium">{time} - {endTime}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="bg-secondary hover:bg-secondary/90">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reservando...
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
