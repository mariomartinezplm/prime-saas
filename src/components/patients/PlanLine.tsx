import { format, parseISO } from 'date-fns';
import { SERVICE_TYPE_LABELS, formatPaymentDeadline, formatPlanRemaining } from '@/config/planCatalog';
import { cn } from '@/lib/utils';
import type { PatientPlanInfo } from '@/lib/patientPlan';

// Una línea con el estado del plan de un paciente (texto + color, nunca solo color).
const PlanLine = ({ info, className }: { info?: PatientPlanInfo; className?: string }) => {
  if (!info) return <span className={cn('text-xs text-muted-foreground', className)}>Sin plan activo</span>;

  const { state, plan } = info;
  if (state === 'none') return <span className={cn('text-xs text-muted-foreground', className)}>Sin plan activo</span>;
  if (state === 'expired' || !plan) return <span className={cn('text-xs font-medium text-destructive', className)}>Plan vencido</span>;

  if (state === 'pending' && plan.paymentDueBy) {
    return (
      <span className={cn('text-xs font-medium text-warning', className)}>
        Pendiente de pago hasta el {formatPaymentDeadline(plan.paymentDueBy)} · {SERVICE_TYPE_LABELS[plan.serviceType]}
      </span>
    );
  }

  return (
    <span className={cn('text-xs', state === 'soon' ? 'font-medium text-warning' : 'text-muted-foreground', className)}>
      {SERVICE_TYPE_LABELS[plan.serviceType]} · {formatPlanRemaining(plan)} ·{' '}
      {plan.openEnded ? 'hasta completar las sesiones' : `${state === 'soon' ? 'vence pronto' : 'vence'} ${format(parseISO(plan.endDate), 'dd/MM/yyyy')}`}
    </span>
  );
};

export default PlanLine;
