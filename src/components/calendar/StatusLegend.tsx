import { cn } from '@/lib/utils';
import { appointmentStatusMeta } from '@/components/shared/statusMeta';
import type { Appointment } from '@/types';

const dot: Record<Appointment['status'], string> = {
  scheduled: 'bg-primary',
  completed: 'bg-success',
  'no-show': 'bg-warning',
  cancelled: 'bg-destructive/50',
};

const order: Appointment['status'][] = ['scheduled', 'completed', 'no-show', 'cancelled'];

// Leyenda de colores del calendario: mismos estados y textos que las insignias.
const StatusLegend = ({ className }: { className?: string }) => (
  <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground', className)} aria-label="Leyenda de estados">
    {order.map((status) => (
      <li key={status} className="flex items-center gap-1.5">
        <span className={cn('h-2.5 w-2.5 rounded-sm', dot[status])} aria-hidden="true" />
        {appointmentStatusMeta[status].label}
      </li>
    ))}
  </ul>
);

export default StatusLegend;
