import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarCheck2, Check, CircleSlash, Trash2, UserRound, X } from 'lucide-react';
import CancelScopeChoice, { type CancelScope } from '@/components/booking/CancelScopeChoice';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { AppointmentStatusBadge } from '@/components/shared/StatusBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { appointmentStart, parseDay, personId, personName } from '@/lib/appointments';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { capitalizeFirst } from '@/lib/utils';
import type { Appointment } from '@/types';

type PendingAction = 'completed' | 'no-show' | 'cancel' | 'delete' | null;

interface AppointmentDetailDialogProps {
  appointment: Appointment | null;
  onClose: () => void;
  // Se llama tras cancelar o cambiar el estado, para recargar la agenda
  onChanged: () => void;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{children}</dd>
  </div>
);

const AppointmentDetailDialog = ({ appointment, onClose, onChanged }: AppointmentDetailDialogProps) => {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState<CancelScope>('this');
  const [syncing, setSyncing] = useState(false);

  if (!appointment) return null;

  const patientId = personId(appointment.patient);
  const isMine = personId(appointment.professional) === user?.id;
  // El profesional gestiona sus propias citas; el admin, todas
  const canManage = user?.role === 'admin' || isMine;
  const isScheduled = appointment.status === 'scheduled';
  const hasStarted = appointmentStart(appointment) <= new Date();

  const handleSync = async () => {
    setSyncing(true);
    try {
      await googleCalendarService.sync(appointment._id);
      notify.success('Cita sincronizada con Google Calendar');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { code?: string } } };
      if (error.response?.data?.code === 'NOT_CONNECTED') {
        notify.error('Primero conecta tu Google Calendar en Configuración', {
          action: { label: 'Ir a Configuración', onClick: () => (window.location.href = '/app/configuracion') },
        });
      } else {
        showApiError(err, 'Error al sincronizar con Google Calendar');
      }
    } finally {
      setSyncing(false);
    }
  };

  const finish = (message: string) => {
    notify.success(message);
    setPending(null);
    setReason('');
    onChanged();
    onClose();
  };

  const confirmStatus = (status: 'completed' | 'no-show') => async () => {
    try {
      await appointmentService.update(appointment._id, { status });
      finish(status === 'completed' ? 'Cita marcada como completada' : 'Cita marcada como "No asistió"');
    } catch (err) {
      showApiError(err, 'No se pudo actualizar la cita');
      throw err;
    }
  };

  const confirmCancel = async () => {
    try {
      await appointmentService.cancel(appointment._id, reason.trim() || undefined, appointment.recurringSlot ? scope : 'this');
      finish(appointment.recurringSlot && scope === 'following' ? 'Cita cancelada, junto con las siguientes de su horario fijo' : 'Cita cancelada');
    } catch (err) {
      showApiError(err, 'No se pudo cancelar la cita');
      throw err;
    }
  };

  const confirmDelete = async () => {
    try {
      await appointmentService.delete(appointment._id);
      finish('Cita eliminada');
    } catch (err) {
      showApiError(err, 'No se pudo eliminar la cita');
      throw err;
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {personName(appointment.patient, 'Paciente')}
              <AppointmentStatusBadge status={appointment.status} />
            </DialogTitle>
            <DialogDescription>{appointmentTypeLabels[appointment.type]}</DialogDescription>
          </DialogHeader>

          <dl className="divide-y divide-border">
            <Row label="Fecha">{capitalizeFirst(format(parseDay(appointment.date), "EEEE d 'de' MMMM yyyy", { locale: es }))}</Row>
            <Row label="Hora">
              <span className="tabular-nums">
                {appointment.startTime} – {appointment.endTime}
              </span>
            </Row>
            <Row label="Profesional">{personName(appointment.professional, '—')}</Row>
            {(appointment.outsideCapacity || appointment.overbooked) && (
              <Row label="Cupo">
                {appointment.outsideCapacity && <Badge variant="accent">Sobre cupo</Badge>}
                {appointment.overbooked && <Badge variant="warning">Sobrecupo</Badge>}
              </Row>
            )}
            {appointment.notes && <Row label="Notas">{appointment.notes}</Row>}
            {appointment.status === 'cancelled' && (
              <>
                {appointment.cancelledAt && (
                  <Row label="Cancelada el">{format(parseISO(appointment.cancelledAt), "d 'de' MMM, HH:mm", { locale: es })}</Row>
                )}
                {appointment.cancellationReason && <Row label="Motivo">{appointment.cancellationReason}</Row>}
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            {patientId && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/app/admin/pacientes/${patientId}`} onClick={onClose}>
                  <UserRound aria-hidden="true" />
                  Ver ficha
                </Link>
              </Button>
            )}
            {isMine && (
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <CalendarCheck2 aria-hidden="true" />
                {syncing ? 'Sincronizando…' : 'Sincronizar con Google Calendar'}
              </Button>
            )}
          </div>

          {canManage && !isScheduled && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPending('delete')}>
                <Trash2 aria-hidden="true" />
                Eliminar cita
              </Button>
            </DialogFooter>
          )}

          {canManage && isScheduled && (
            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setPending('completed')} disabled={!hasStarted} title={hasStarted ? undefined : 'Disponible desde la hora de la cita'}>
                  <Check aria-hidden="true" />
                  Completada
                </Button>
                <Button variant="outline" onClick={() => setPending('no-show')} disabled={!hasStarted} title={hasStarted ? undefined : 'Disponible desde la hora de la cita'}>
                  <CircleSlash aria-hidden="true" />
                  No asistió
                </Button>
              </div>
              <Button variant="destructive" onClick={() => setPending('cancel')}>
                <X aria-hidden="true" />
                Cancelar cita
              </Button>
              <Button variant="ghost" onClick={() => setPending('delete')}>
                <Trash2 aria-hidden="true" />
                Eliminar cita
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pending === 'completed'}
        onOpenChange={(open) => !open && setPending(null)}
        title="¿Marcar como completada?"
        description={`Se registrará que ${personName(appointment.patient, 'el paciente')} asistió a su cita.`}
        confirmLabel="Sí, completada"
        onConfirm={confirmStatus('completed')}
      />
      <ConfirmDialog
        open={pending === 'no-show'}
        onOpenChange={(open) => !open && setPending(null)}
        title="¿Marcar como “No asistió”?"
        description={`Se registrará que ${personName(appointment.patient, 'el paciente')} no llegó a su cita. La sesión ya está descontada del plan.`}
        confirmLabel="Sí, no asistió"
        onConfirm={confirmStatus('no-show')}
      />
      <ConfirmDialog
        open={pending === 'cancel'}
        onOpenChange={(open) => !open && setPending(null)}
        title="¿Cancelar esta cita?"
        description="La sesión se devuelve al plan del paciente. Esta acción no le envía un aviso: avísale tú si corresponde."
        confirmLabel="Sí, cancelar cita"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmCancel}
      >
        {appointment.recurringSlot && <CancelScopeChoice value={scope} onChange={setScope} />}
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Motivo (opcional)"
          aria-label="Motivo de la cancelación"
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={pending === 'delete'}
        onOpenChange={(open) => !open && setPending(null)}
        title="¿Eliminar esta cita?"
        description="Se borra el registro de la cita y, si había descontado una sesión del plan, la sesión se devuelve. Úsalo para corregir errores; si solo se canceló, usa «Cancelar cita». No se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default AppointmentDetailDialog;
