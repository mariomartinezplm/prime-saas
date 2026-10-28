import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarCheck, Loader2, RefreshCw, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { clientPlanService, type RenewalPreview } from '@/services/clientPlanService';
import { SERVICE_TYPE_LABELS, TERM_LABELS, type PlanTerm } from '@/config/planCatalog';
import { getErrorMessage } from '@/lib/apiError';
import { notify } from '@/lib/notify';

const day = (iso?: string | null) => (iso ? format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es }) : '');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Lo que pasa, en palabras simples, según el estado del plan
function headline(r: RenewalPreview): string {
  switch (r.kind) {
    case 'settle_pending':
      return 'La renovación está pendiente de pago: se da por pagada y el plan sigue igual.';
    case 'early':
      return 'El plan actual está por terminar: se renueva por adelantado y el nuevo parte justo cuando este termina.';
    case 'reactivate':
      return 'El plan venció: se reactiva hoy con las mismas condiciones.';
    case 'kine_new':
      return 'Se terminaron las sesiones: se crea un paquete nuevo igual.';
    default:
      return '';
  }
}

interface RenewPlanDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Se renovó: la ficha vuelve a cargar
  onRenewed: () => void;
}

// «Renovar plan» con un toque: renueva el plan que el paciente YA tiene (mismo servicio, sesiones, plazo y condiciones) y no toca sus
// citas agendadas ni su horario fijo. Antes de confirmar se ve exactamente qué va a pasar.
const RenewPlanDialog = ({ patientId, patientName, open, onOpenChange, onRenewed }: RenewPlanDialogProps) => {
  const [preview, setPreview] = useState<RenewalPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview(null);
    setFailed(false);
    clientPlanService
      .getRenewalPreview(patientId)
      .then((r) => !cancelled && setPreview(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, patientId, attempt]);

  const renew = async () => {
    if (renewing) return;
    setRenewing(true);
    try {
      const result = await clientPlanService.renew(patientId);
      // «Renovado» solo después de que el servidor lo confirma
      notify.success(result.fixed.created > 0 ? `Plan renovado. Se agendaron ${plural(result.fixed.created, 'cita', 'citas')} de su horario fijo.` : 'Plan renovado');
      onOpenChange(false);
      onRenewed();
    } catch (err) {
      notify.error(getErrorMessage(err, 'No se pudo renovar el plan. Revisa la ficha e inténtalo de nuevo.'));
      setAttempt((n) => n + 1); // el estado pudo cambiar (por ejemplo, ya estaba renovado): se vuelve a mirar
    } finally {
      setRenewing(false);
    }
  };

  const plan = preview?.plan;
  const canRenew = !!preview && preview.kind !== 'none' && !!plan;

  return (
    <Dialog open={open} onOpenChange={(next) => !renewing && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renovar plan de {patientName}</DialogTitle>
          <DialogDescription>Se renueva el plan que ya tiene, con las mismas condiciones.</DialogDescription>
        </DialogHeader>

        {failed && <LoadErrorAlert message="No se pudo revisar el plan." onRetry={() => setAttempt((n) => n + 1)} />}
        {!preview && !failed && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Revisando el plan…
          </p>
        )}

        {preview?.kind === 'none' && (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg border border-border bg-muted/40 p-3">{preview.message}</p>
            <p className="text-muted-foreground">Si necesitas cambiar el plan (otras sesiones, otro plazo o un monto distinto), usa «Elegir otro plan».</p>
          </div>
        )}

        {canRenew && plan && (
          <div className="space-y-4 text-sm">
            <p>{headline(preview)}</p>
            <dl className="divide-y divide-border rounded-lg border border-border">
              <div className="flex justify-between gap-3 p-3">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="text-right font-medium">
                  {SERVICE_TYPE_LABELS[plan.serviceType]} · {plan.unlimited ? 'ilimitado' : plural(plan.sessionsTotal, 'sesión', 'sesiones')}
                  {!plan.openEnded && ` · ${TERM_LABELS[plan.term as PlanTerm]?.toLowerCase() ?? plan.term}`}
                </dd>
              </div>
              <div className="flex justify-between gap-3 p-3">
                <dt className="text-muted-foreground">{preview.kind === 'settle_pending' ? 'Desde' : 'Parte'}</dt>
                <dd className="text-right font-medium">{day(preview.starts)}</dd>
              </div>
              {preview.endsOn && (
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-muted-foreground">{plan.cyclesTotal > 1 ? 'Pagado hasta' : 'Vence'}</dt>
                  <dd className="text-right font-medium">{day(preview.endsOn)}</dd>
                </div>
              )}
              {plan.scholarship && (
                <div className="flex justify-between gap-3 p-3">
                  <dt className="text-muted-foreground">Condición</dt>
                  <dd className="text-right font-medium">Beca</dd>
                </div>
              )}
            </dl>

            <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="font-medium">Se mantiene todo:</p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {preview.keep && preview.keep.futureAppointments > 0 ? `Sus ${plural(preview.keep.futureAppointments, 'cita agendada', 'citas agendadas')} no se tocan` : 'Sus citas no se tocan'}
                  {preview.kind === 'settle_pending' ? ' y las sesiones que ya usó siguen contando.' : '.'}
                </span>
              </p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <Repeat className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {preview.keep && preview.keep.fixedSlots > 0
                    ? `${plural(preview.keep.fixedSlots, 'horario fijo sigue', 'horarios fijos siguen')} vigente${preview.keep.fixedSlots === 1 ? '' : 's'} y se agendan sus fechas del plan nuevo.`
                    : 'Si tiene un horario fijo, sigue vigente.'}
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {canRenew && (
            <Button onClick={renew} disabled={renewing} className="w-full">
              {renewing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {renewing ? 'Renovando…' : 'Renovar plan'}
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link to={`/app/admin/planes?paciente=${patientId}`}>Elegir otro plan</Link>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={renewing} className="w-full">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenewPlanDialog;
