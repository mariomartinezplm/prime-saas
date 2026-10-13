import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateBadgeProps {
  date: Date;
  className?: string;
}

// Mini "hoja de calendario" (mes + día) para reconocer una cita de un vistazo. Es solo decoración: el texto
// de la fecha completa siempre va al lado, por eso queda oculta para lectores de pantalla.
const DateBadge = ({ date, className }: DateBadgeProps) => (
  <div
    aria-hidden="true"
    className={cn(
      'flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-secondary',
      className
    )}
  >
    <span className="text-[11px] font-medium uppercase leading-none tracking-wider">{format(date, 'MMM', { locale: es }).replace('.', '')}</span>
    <span className="mt-1 text-2xl font-semibold leading-none tabular-nums">{format(date, 'd')}</span>
  </div>
);

export default DateBadge;
