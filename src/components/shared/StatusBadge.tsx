import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { Appointment, ClientPlan } from '@/types';
import { activeStatusMeta, appointmentStatusMeta, planStatusMeta, type StatusTone } from './statusMeta';

const toneVariant: Record<StatusTone, NonNullable<BadgeProps['variant']>> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  accent: 'accent',
  neutral: 'neutral',
};

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  tone: StatusTone;
}

// Una sola insignia de estado para toda la app: mismo color = mismo significado.
export const StatusBadge = ({ tone, ...props }: StatusBadgeProps) => <Badge variant={toneVariant[tone]} {...props} />;

export const AppointmentStatusBadge = ({ status, ...props }: { status: Appointment['status'] } & Omit<BadgeProps, 'variant'>) => (
  <StatusBadge tone={appointmentStatusMeta[status].tone} {...props}>
    {appointmentStatusMeta[status].label}
  </StatusBadge>
);

export const PlanStatusBadge = ({ status, ...props }: { status: ClientPlan['status'] } & Omit<BadgeProps, 'variant'>) => (
  <StatusBadge tone={planStatusMeta[status].tone} {...props}>
    {planStatusMeta[status].label}
  </StatusBadge>
);

export const ActiveStatusBadge = ({ isActive, ...props }: { isActive: boolean } & Omit<BadgeProps, 'variant'>) => {
  const meta = activeStatusMeta[isActive ? 'active' : 'inactive'];
  return (
    <StatusBadge tone={meta.tone} {...props}>
      {meta.label}
    </StatusBadge>
  );
};
