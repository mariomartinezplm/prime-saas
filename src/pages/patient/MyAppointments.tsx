import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, CalendarPlus, CalendarX, History, TriangleAlert, X } from 'lucide-react';
import { appointmentService } from '@/services/appointmentService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { AppointmentStatusBadge } from '@/components/shared/StatusBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { PATIENT_CANCEL_AHEAD_HOURS } from '@/config/bookingRules';
import { appointmentEnd, appointmentStart, parseDay, personName } from '@/lib/appointments';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { capitalizeFirst } from '@/lib/utils';
import type { Appointment } from '@/types';

const AppointmentCard = ({
  apt,
  onCancel,
}: {
  apt: Appointment;
  onCancel: (apt: Appointment) => void;
}) => {
  // Se puede cancelar mientras la cita no haya empezado. Con menos de 4 horas la sesión se pierde
  // (lo decide el servidor); aquí solo se avisa en la confirmación.
  const canCancel = apt.status === 'scheduled' && appointmentStart(apt) > new Date();
  const [downloading, setDownloading] = useState(false);

  const addToCalendar = async () => {
    setDownloading(true);
    try {
      await appointmentService.downloadICS(apt._id);
    } catch (err) {
      showApiError(err, 'No se pudo descargar el archivo de calendario');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{capitalizeFirst(format(parseDay(apt.date), "EEEE d 'de' MMMM", { locale: es }))}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {apt.startTime} – {apt.endTime}
        </p>
        <p className="text-xs text-muted-foreground">
          {appointmentTypeLabels[apt.type]}
          {typeof apt.professional === 'object' && <span className="text-secondary"> · {personName(apt.professional, '')}</span>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AppointmentStatusBadge status={apt.status} />
        {apt.status === 'scheduled' && (
          <Button variant="outline" size="sm" onClick={addToCalendar} disabled={downloading}>
            <CalendarPlus aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Agregar a mi calendario</span>
            <span className="sr-only sm:hidden">calendario</span>
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onCancel(apt)}>
            <X aria-hidden="true" />
            Cancelar
          </Button>
        )}
      </div>
    </li>
  );
};

const MyAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setAppointments(await appointmentService.getAll());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Se clasifica por la HORA de la cita, no por el día a medianoche: antes, en Chile, las citas
  // de hoy caían en "Historial". Las "No asistió" no aparecían en ninguna pestaña.
  const now = new Date();
  const byStart = (a: Appointment, b: Appointment) => appointmentStart(a).getTime() - appointmentStart(b).getTime();
  // Próximas: la más cercana primero. Historial y canceladas: la más reciente primero.
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && appointmentEnd(a) > now).sort(byStart);
  const past = appointments
    .filter((a) => a.status === 'completed' || a.status === 'no-show' || (a.status === 'scheduled' && appointmentEnd(a) <= now))
    .sort((a, b) => byStart(b, a));
  const cancelled = appointments.filter((a) => a.status === 'cancelled').sort((a, b) => byStart(b, a));

  const refundsSession = cancelling ? appointmentStart(cancelling) > addHours(now, PATIENT_CANCEL_AHEAD_HOURS) : true;

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await appointmentService.cancel(cancelling._id, reason.trim());
      notify.success('Cita cancelada');
      setCancelling(null);
      setReason('');
      load();
    } catch (err) {
      showApiError(err, 'No se pudo cancelar la cita');
      throw err;
    }
  };

  if (loading) return <LoadingState label="Cargando tus citas…" />;

  const renderList = (items: Appointment[], empty: React.ReactNode) =>
    items.length === 0 ? (
      empty
    ) : (
      <ul className="space-y-3">
        {items.map((apt) => (
          <AppointmentCard key={apt._id} apt={apt} onCancel={setCancelling} />
        ))}
      </ul>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis citas"
        description="Gestiona tus sesiones"
        actions={
          <Button asChild>
            <Link to="/app/reservar">
              <CalendarPlus aria-hidden="true" />
              Reservar hora
            </Link>
          </Button>
        }
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar tus citas.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Historial ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas ({cancelled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {renderList(
            upcoming,
            <EmptyState
              icon={CalendarClock}
              title="No tienes citas próximas"
              description="Reserva tu próxima sesión cuando quieras."
              action={
                <Button asChild size="sm">
                  <Link to="/app/reservar">Reservar hora</Link>
                </Button>
              }
            />
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          {renderList(past, <EmptyState icon={History} title="Todavía no tienes citas anteriores" />)}
        </TabsContent>
        <TabsContent value="cancelled" className="mt-4">
          {renderList(cancelled, <EmptyState icon={CalendarX} title="No tienes citas canceladas" />)}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null);
            setReason('');
          }
        }}
        title="¿Cancelar esta cita?"
        description={
          refundsSession
            ? `Faltan más de ${PATIENT_CANCEL_AHEAD_HOURS} horas: la sesión se devuelve a tu plan.`
            : `Faltan menos de ${PATIENT_CANCEL_AHEAD_HOURS} horas: si cancelas ahora, la sesión se descuenta de tu plan.`
        }
        confirmLabel="Sí, cancelar cita"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmCancel}
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Motivo (opcional)"
          aria-label="Motivo de la cancelación"
        />
      </ConfirmDialog>
    </div>
  );
};

export default MyAppointments;
