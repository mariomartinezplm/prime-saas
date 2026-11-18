import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { Views, type View } from 'react-big-calendar';
import { Lock, TriangleAlert, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { userService } from '@/services/userService';
import { availabilityService } from '@/services/availabilityService';
import { slotClosureService } from '@/services/slotClosureService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AgendaList from '@/components/calendar/AgendaList';
import AppointmentCalendar from '@/components/calendar/AppointmentCalendar';
import AppointmentDetailDialog from '@/components/calendar/AppointmentDetailDialog';
import StatusLegend from '@/components/calendar/StatusLegend';
import AvailabilityLegend from '@/components/calendar/AvailabilityLegend';
import CloseSlotDialog from '@/components/calendar/CloseSlotDialog';
import ClosedSlotsList from '@/components/calendar/ClosedSlotsList';
import { buildCoverage, type Coverage } from '@/components/calendar/availabilityCoverage';
import { toEvents } from '@/components/calendar/calendarUtils';
import { BlockSkeleton, SkeletonRegion } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { notify } from '@/lib/notify';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Appointment, SlotClosure, TeamAppointment, TeamCalendar, User } from '@/types';

// Una cita de un colega, con la forma de una cita para dibujarla en el calendario (solo lectura: sin detalle ni ficha)
const teamToAppointment = (t: TeamAppointment): Appointment => {
  const [first, ...rest] = t.patientName.split(' ');
  return {
    _id: `team-${t.id}`,
    patient: { firstName: first, lastName: rest.join(' ') } as User,
    professional: { _id: t.professional.id, firstName: t.professional.firstName, lastName: t.professional.lastName } as unknown as User,
    date: t.date,
    startTime: t.startTime,
    endTime: t.endTime,
    status: t.status,
    type: t.type,
    fromTeam: true,
    createdAt: '',
    updatedAt: '',
  };
};

const TEAM_ALL = 'team-all';

const AdminCalendar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // En móvil la semana en 7 columnas no cabe: se muestra como lista por día
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState('all');
  const [selected, setSelected] = useState<Appointment | null>(null);

  // El detalle se monta y desmonta con la cita elegida, así que el foco no vuelve solo: se anota la cita
  // enfocada al abrirlo y se devuelve al cerrarlo (para quien navega con teclado).
  const returnFocus = useRef<HTMLElement | null>(null);
  const openDetail = (appointment: Appointment) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(appointment);
  };
  const closeDetail = () => {
    setSelected(null);
    const target = returnFocus.current;
    returnFocus.current = null;
    requestAnimationFrame(() => target?.isConnected && target.focus());
  };
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Horario de atención que se dibuja de fondo: el del profesional elegido, o el propio si se ven "todos"
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const coverageOwnerId = isAdmin && selectedProfessional !== 'all' ? selectedProfessional : user?.id;

  useEffect(() => {
    setCoverage(null);
    if (!coverageOwnerId) return;
    let active = true;
    availabilityService
      .get(coverageOwnerId)
      .then((availability) => active && setCoverage(buildCoverage(availability)))
      // Es un extra visual: si no se puede leer, el calendario se ve como siempre
      .catch(() => active && setCoverage(null));
    return () => {
      active = false;
    };
  }, [coverageOwnerId]);

  // «Cerrar horario»: horas que ya no reciben pacientes nuevos (las del profesional que se ve en el calendario)
  const [closures, setClosures] = useState<SlotClosure[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const loadClosures = useCallback(async () => {
    if (!coverageOwnerId) return;
    try {
      setClosures(await slotClosureService.list(coverageOwnerId));
    } catch {
      // Es un extra: si no carga, el calendario se ve como siempre
      setClosures([]);
    }
  }, [coverageOwnerId]);
  useEffect(() => {
    loadClosures();
  }, [loadClosures]);

  // Agenda del equipo (solo para profesionales): ver cuándo y con quién atienden los colegas, solo lectura.
  // 'mine' = solo la propia · TEAM_ALL = la propia y la de todos · un id = solo la de ese colega
  const [teamMode, setTeamMode] = useState<string>('mine');
  const [team, setTeam] = useState<TeamCalendar | null>(null);
  const [teamFailed, setTeamFailed] = useState(false);
  const monthKey = format(date, 'yyyy-MM');
  useEffect(() => {
    // También con «Mi agenda»: así la lista de colegas del selector ya está lista al abrirlo
    if (isAdmin) return;
    let active = true;
    setTeamFailed(false);
    const from = format(addDays(startOfMonth(date), -7), 'yyyy-MM-dd');
    const to = format(addDays(endOfMonth(date), 7), 'yyyy-MM-dd');
    appointmentService
      .getTeam({ from, to })
      .then((t) => active && setTeam(t))
      .catch(() => active && setTeamFailed(true));
    return () => {
      active = false;
    };
    // Se vuelve a pedir al cambiar de mes, no en cada día
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, monthKey]);

  // El filtro por profesional solo lo respeta el servidor para el admin
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([userService.getAll({ role: 'admin' }), userService.getAll({ role: 'professional' })])
      .then(([admins, profs]) => setProfessionals([...admins.users, ...profs.users]))
      // El calendario sigue funcionando; solo falta el filtro, y se dice
      .catch(() => notify.error('No se pudo cargar la lista de profesionales: el filtro solo muestra "Todos". Recarga la página para intentarlo de nuevo.'));
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const params: Record<string, string> = {};
      if (isAdmin && selectedProfessional !== 'all') params.professional = selectedProfessional;
      // Las canceladas no se muestran en el calendario (la sesión ya volvió al plan); siguen en la ficha del paciente
      setAppointments((await appointmentService.getAll(params)).filter((a) => a.status !== 'cancelled'));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedProfessional]);

  useEffect(() => {
    load();
  }, [load]);

  // Lo que se dibuja: las propias y, si se pidió, las de los colegas (solo lectura)
  const teamRows = !isAdmin && teamMode !== 'mine' && team ? team.appointments.filter((t) => teamMode === TEAM_ALL || t.professional.id === teamMode).map(teamToAppointment) : [];
  const shown = teamMode === 'mine' || isAdmin ? appointments : teamMode === TEAM_ALL ? [...appointments, ...teamRows] : teamRows;
  const pick = (a: Appointment) => {
    if (!a.fromTeam) openDetail(a);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        description="Toca una cita para ver el detalle, sincronizarla o cambiar su estado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setCloseOpen(true)}>
              <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
              Cerrar horario
            </Button>
            {!isAdmin && (
              <Select value={teamMode} onValueChange={setTeamMode}>
                <SelectTrigger className="w-[220px]" aria-label="Qué agenda ver">
                  <Users className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">Mi agenda</SelectItem>
                  <SelectItem value={TEAM_ALL}>Yo y el equipo</SelectItem>
                  {(team?.professionals ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>Solo {p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdmin && (
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger className="w-[220px]" aria-label="Filtrar por profesional">
                <SelectValue placeholder="Todos los profesionales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profesionales</SelectItem>
                {professionals.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.firstName} {prof.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
          </div>
        }
      />

      {!isAdmin && teamMode !== 'mine' && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Las citas con borde punteado son de tus colegas: solo puedes verlas, no abrirlas ni cambiarlas.</span>
        </p>
      )}
      {teamFailed && !isAdmin && teamMode !== 'mine' && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>No se pudo cargar la agenda del equipo. Se muestra solo la tuya.</AlertDescription>
        </Alert>
      )}

      <ClosedSlotsList closures={closures} onChanged={loadClosures} />

      <StatusLegend />
      {coverage && <AvailabilityLegend />}

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar las citas.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <SkeletonRegion label="Cargando citas…">
          <BlockSkeleton className="h-[520px]" />
        </SkeletonRegion>
      ) : isMobile ? (
        <AgendaList appointments={shown} date={date} onNavigate={setDate} onSelect={pick} coverage={coverage} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <AppointmentCalendar
              events={toEvents(shown)}
              date={date}
              view={view}
              onNavigate={setDate}
              onView={setView}
              onSelectEvent={(event) => pick(event.resource)}
              coverage={coverage}
            />
          </CardContent>
        </Card>
      )}

      <AppointmentDetailDialog appointment={selected} onClose={closeDetail} onChanged={load} />

      <CloseSlotDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        isAdmin={isAdmin}
        ownId={user?.id ?? ''}
        professionals={professionals}
        defaultProfessionalId={coverageOwnerId ?? ''}
        closures={closures}
        onClosed={loadClosures}
      />
    </div>
  );
};

export default AdminCalendar;
