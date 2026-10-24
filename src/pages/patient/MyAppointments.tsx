import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, CalendarPlus, Info, TriangleAlert, X } from 'lucide-react';
import { appointmentService } from '@/services/appointmentService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CancelScopeChoice, { type CancelScope } from '@/components/booking/CancelScopeChoice';
import DateBadge from '@/components/shared/DateBadge';
import EmptyGuide from '@/components/premium/EmptyGuide';
import SegmentedTabs from '@/components/premium/SegmentedTabs';
import { CARD, HERO_SURFACE } from '@/components/dashboard/brand';
import { ListSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import PageTitle from '@/components/premium/PageTitle';
import { AppointmentStatusBadge } from '@/components/shared/StatusBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { PATIENT_CANCEL_AHEAD_HOURS } from '@/config/bookingRules';
import { appointmentEnd, appointmentStart, parseDay, personName } from '@/lib/appointments';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { capitalizeFirst, cn } from '@/lib/utils';
import type { Appointment } from '@/types';

const AppointmentCard = ({
  apt,
  onCancel,
  highlight,
}: {
  apt: Appointment;
  onCancel: (apt: Appointment) => void;
  // La próxima sesión se destaca para encontrarla sin leer la lista
  highlight?: boolean;
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

  const professional = typeof apt.professional === 'object' ? personName(apt.professional, '') : '';
  return (
    <li
      className={cn(
        'flex flex-col gap-4 p-4 min-[375px]:p-5',
        highlight ? cn('rounded-[24px] border', HERO_SURFACE) : cn(CARD, 'p-4'),
        (apt.status === 'cancelled' || apt.status === 'no-show') && 'opacity-80'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {highlight ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7cc0d2]">Próxima sesión</p> : <span aria-hidden="true" />}
        <AppointmentStatusBadge status={apt.status} />
      </div>
      <div className="flex min-w-0 items-start gap-4">
        <DateBadge date={parseDay(apt.date)} className={cn('border-[#398ca2]/50 bg-[#181619]/55 text-[#fff8e4] [&>span:first-child]:text-[#7cc0d2]', highlight ? 'h-[4.75rem] w-[4rem] [&>span:last-child]:text-[30px] [&>span:last-child]:font-extrabold' : '')} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[15px] font-semibold text-[#fff8e4]">{capitalizeFirst(format(parseDay(apt.date), "EEEE d 'de' MMMM", { locale: es }))}</p>
          <p className={cn('whitespace-nowrap font-extrabold tabular-nums tracking-tight text-[#fff8e4]', highlight ? 'text-[1.5rem] leading-none' : 'text-lg')}>
            {apt.startTime} – {apt.endTime}
          </p>
          <p className="text-[13px] text-[#fff8e4]/72">
            {appointmentTypeLabels[apt.type]}
            {apt.recurringSlot && <span> · Horario fijo</span>}
            {professional && <span> · con {professional}</span>}
          </p>
        </div>
      </div>
      {(apt.status === 'scheduled') && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={addToCalendar} disabled={downloading} className="min-h-[44px] flex-1 border-[#fff8e4]/20 text-[#fff8e4] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
            <CalendarPlus aria-hidden="true" />
            Agregar a mi calendario
          </Button>
          {canCancel && (
            <Button variant="outline" onClick={() => onCancel(apt)} className="min-h-[44px] border-[#fff8e4]/20 text-[#fff8e4]/85 hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
              <X aria-hidden="true" />
              Cancelar
            </Button>
          )}
        </div>
      )}
    </li>
  );
};

const MyAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [scope, setScope] = useState<CancelScope>('this');
  const [tab, setTab] = useState('upcoming');
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
      await appointmentService.cancel(cancelling._id, reason.trim(), cancelling.recurringSlot ? scope : 'this');
      notify.success('Cita cancelada');
      setCancelling(null);
      setReason('');
      setScope('this');
      load();
    } catch (err) {
      showApiError(err, 'No se pudo cancelar la cita');
      throw err;
    }
  };

  if (loading) {
    return (
      <PageSkeleton label="Cargando tus citas…">
        <ListSkeleton rows={4} />
      </PageSkeleton>
    );
  }

  const renderList = (items: Appointment[], empty: React.ReactNode, highlightFirst = false) =>
    items.length === 0 ? (
      empty
    ) : (
      <ul className="space-y-3">
        {items.map((apt, index) => (
          <AppointmentCard key={apt._id} apt={apt} onCancel={setCancelling} highlight={highlightFirst && index === 0} />
        ))}
      </ul>
    );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle
        eyebrow="Mis citas"
        title={<>Tus citas,<br />en orden</>}
        description="Todas las horas son de Chile."
        actions={
          <Button asChild className="min-h-[48px] rounded-2xl text-base font-bold">
            <Link to="/app/reservar">
              <CalendarPlus aria-hidden="true" />
              Reservar hora
            </Link>
          </Button>
        }
      />

      <p className="flex items-start gap-2 rounded-2xl border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] px-4 py-3 text-[13.5px] leading-snug text-[#fff8e4]/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#62b8cf]" aria-hidden="true" />
        <span>Todas las sesiones agendadas se pueden cancelar hasta <strong className="text-[#fff8e4]">{PATIENT_CANCEL_AHEAD_HOURS} horas antes</strong> de la hora. Si cancelas con menos tiempo, esa sesión se pierde.</span>
      </p>

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

      <SegmentedTabs
        ariaLabel="Tus citas"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'upcoming', label: `Próximas (${upcoming.length})` },
          { value: 'past', label: `Historial (${past.length})` },
          { value: 'cancelled', label: `Canceladas (${cancelled.length})` },
        ]}
      >
        {[
          renderList(
            upcoming,
            <EmptyGuide
              icon={CalendarClock}
              title="Tu próxima sesión comienza aquí"
              description="No tienes citas agendadas. Reserva cuando quieras: verás aquí la fecha, la hora y con quién."
              action={
                <Button asChild className="min-h-[48px] rounded-2xl text-base font-bold">
                  <Link to="/app/reservar">Reservar hora</Link>
                </Button>
              }
            />,
            true
          ),
          renderList(past, <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-8 text-center text-sm text-[#fff8e4]/72">Todavía no tienes citas anteriores. Aquí quedará el historial de tus sesiones.</p>),
          renderList(cancelled, <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-8 text-center text-sm text-[#fff8e4]/72">No tienes citas canceladas.</p>),
        ]}
      </SegmentedTabs>

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null);
            setReason('');
            setScope('this');
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
        {cancelling?.recurringSlot && <CancelScopeChoice value={scope} onChange={setScope} />}
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
