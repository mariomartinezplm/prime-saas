import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  ArrowLeft,
  Calendar,
  CalendarX,
  ClipboardList,
  Dumbbell,
  FileText,
  MoreHorizontal,
  Pencil,
  Repeat,
  Ruler,
  Send,
  Trash2,
  TriangleAlert,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';
import MeasurementForm from '@/components/forms/MeasurementForm';
import ExerciseForm from '@/components/forms/ExerciseForm';
import PreparationsCard from '@/components/training/PreparationsCard';
import EVAForm from '@/components/forms/EVAForm';
import WellnessHistoryTab from '@/components/wellness/WellnessHistoryTab';
import PatientFilesTab from '@/components/files/PatientFilesTab';
import PatientPhotos from '@/components/photos/PatientPhotos';
import PatientAchievementsTab from '@/components/achievements/PatientAchievementsTab';
import PatientGoalsTab from '@/components/goals/PatientGoalsTab';
import { MeasurementHistory, ExerciseHistory } from '@/components/records/PatientRecordHistory';
import ClinicalBaselineFields from '@/components/forms/ClinicalBaselineFields';
import EditPatientDialog from '@/components/forms/EditPatientDialog';
import RenewPlanDialog from '@/components/plans/RenewPlanDialog';
import AdminBookingDialog from '@/components/booking/AdminBookingDialog';
import FixedScheduleDialog from '@/components/booking/FixedScheduleDialog';
import AppointmentDetailDialog from '@/components/calendar/AppointmentDetailDialog';
import FounderBadge from '@/components/plans/FounderBadge';
import { DetailList, DetailRow } from '@/components/patients/DetailList';
import PlanLine from '@/components/patients/PlanLine';
import DeletePatientDialog from '@/components/admin/DeletePatientDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import { CardsSkeleton, PageSkeleton, StatsSkeleton } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { ActiveStatusBadge, AppointmentStatusBadge, InviteStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { SERVICE_TYPE_LABELS, formatPlanUsage, formatCycleProgress, formatPaymentDeadline } from '@/config/planCatalog';
import { appointmentStart, parseDay } from '@/lib/appointments';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { infoFromBalance } from '@/lib/patientPlan';
import { notify } from '@/lib/notify';
import { capitalizeFirst } from '@/lib/utils';
import type { Appointment, PatientProfile, SessionBalance } from '@/types';

// Las secciones de la ficha, agrupadas por lo que el profesional necesita hacer (las rutas y los valores de `?tab=` no cambian)
const GROUPS: { label: string; items: { value: string; label: string }[] }[] = [
  { label: 'Paciente', items: [{ value: 'profile', label: 'Perfil' }] },
  { label: 'Agenda y plan', items: [{ value: 'appointments', label: 'Citas' }, { value: 'plan', label: 'Plan' }] },
  {
    label: 'Entrenamiento y progreso',
    items: [
      { value: 'exercises', label: 'Ejercicios' },
      { value: 'measurements', label: 'Mediciones' },
      { value: 'goals', label: 'Objetivos' },
      { value: 'achievements', label: 'Logros' },
      { value: 'photos', label: 'Fotos' },
    ],
  },
  { label: 'Clínico y archivos', items: [{ value: 'eva', label: 'EVA (dolor)' }, { value: 'wellness', label: 'Bienestar' }, { value: 'files', label: 'Archivos' }] },
];
const SECTIONS = GROUPS.flatMap((g) => g.items);

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // Próximas = agendadas que aún no empiezan (la más cercana primero); historial = el resto (la más reciente primero)
  const upcomingApts = appointments.filter((a) => a.status === 'scheduled' && appointmentStart(a) > new Date()).sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime());
  const pastApts = appointments.filter((a) => !upcomingApts.includes(a)).sort((a, b) => appointmentStart(b).getTime() - appointmentStart(a).getTime());
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (SECTIONS.some((x) => x.value === searchParams.get('tab')) ? (searchParams.get('tab') as string) : 'profile'));
  // Cambiar de sección descarta lo escrito en la anterior: si hay un formulario a medias, se pregunta
  const { confirmLeave } = useUnsavedChangesApi();
  const changeTab = (next: string) => {
    if (next !== tab) confirmLeave(() => setTab(next));
  };
  const [bookingOpen, setBookingOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manageApt, setManageApt] = useState<{ apt: Appointment; action?: 'cancel' | 'delete' } | null>(null);
  const navigate = useNavigate();
  const [recordsKey, setRecordsKey] = useState(0);
  const [renewOpen, setRenewOpen] = useState(false);
  // «Preparar entrenamiento» desde el encabezado: cambia a Ejercicios y abre el panel (el número cambia en cada petición)
  const [prepareRequest, setPrepareRequest] = useState(0);
  // «Registrar un nuevo peso» desde una fila del historial de ejercicios: el formulario de arriba se completa con ese ejercicio
  const [exercisePrefill, setExercisePrefill] = useState<{ name: string; category: string; nonce: number } | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    // El perfil es imprescindible; el saldo y las citas se muestran si llegan. Se piden TODAS las citas de este paciente
    // (próximas, realizadas y canceladas), ya filtradas en el servidor, para poder corregir o borrar cualquiera.
    const [prof, bal, apts] = await Promise.allSettled([
      userService.getPatientProfile(id),
      clientPlanService.getBalance(id),
      appointmentService.getAll({ patient: id }),
    ]);

    if (prof.status === 'rejected') {
      const status = (prof.reason as { response?: { status?: number } })?.response?.status;
      setState(status === 404 ? 'not-found' : 'error');
      return;
    }
    setProfile(prof.value);
    setBalance(bal.status === 'fulfilled' ? bal.value : null);
    setAppointments(apts.status === 'fulfilled' ? apts.value : []);
    setState('ready');
  }, [id]);

  useEffect(() => {
    setState('loading');
    fetchData();
  }, [fetchData]);

  if (state === 'loading') {
    return (
      <PageSkeleton label="Cargando ficha…">
        <StatsSkeleton count={4} />
        <CardsSkeleton count={2} />
      </PageSkeleton>
    );
  }

  if (state === 'not-found') {
    return (
      <EmptyState
        icon={UserX}
        title="Paciente no encontrado"
        description="Puede que no exista o que no esté asignado a ti."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/admin/pacientes">Volver a pacientes</Link>
          </Button>
        }
      />
    );
  }

  if (state === 'error' || !profile) {
    return (
      <Alert variant="warning">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>No se pudo cargar la ficha del paciente.</span>
          <Button variant="outline" size="sm" onClick={() => { setState('loading'); fetchData(); }}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { patient, stats } = profile;
  const assignedProfessional = patient.assignedProfessionalId;
  const bookingProfessionalId = (typeof assignedProfessional === 'object' ? assignedProfessional?.id : assignedProfessional) || user?.id;
  const bookingDefaultType = balance?.plan?.serviceType ?? 'kinesiologia';
  // El horario fijo se arma con el profesional ASIGNADO al paciente (el servidor lo exige)
  const fixedProfessionalId = typeof assignedProfessional === 'object' ? assignedProfessional?.id : assignedProfessional;
  const fixedTypes: Array<'kinesiologia' | 'entrenamiento'> = bookingDefaultType === 'entrenamiento' ? ['entrenamiento', 'kinesiologia'] : ['kinesiologia', 'entrenamiento'];

  const resendInvite = async () => {
    try {
      await userService.resendInvite(id!);
      notify.success('Invitación reenviada');
      // El estado pasa a "Invitación enviada" sin tener que recargar la página
      fetchData();
    } catch (err) {
      showApiError(err, 'No se pudo reenviar la invitación');
      throw err;
    }
  };

  // Los contadores van dentro de las pestañas (antes eran tarjetas que repetían lo mismo)
  const counts: Record<string, number> = { appointments: stats.totalAppointments, measurements: stats.totalMeasurements, exercises: stats.totalExercises, eva: stats.totalEVARecords };
  const onExercises = tab === 'exercises';
  const prepare = () => {
    changeTab('exercises');
    setPrepareRequest((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px]">
        <Link to="/app/admin/pacientes">
          <ArrowLeft aria-hidden="true" />
          Pacientes
        </Link>
      </Button>

      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        badges={
          <>
            <ActiveStatusBadge isActive={patient.isActive} />
            {patient.inviteStatus && <InviteStatusBadge status={patient.inviteStatus} />}
            {patient.isFounder && <FounderBadge />}
            {patient.autoRenew && (
              <Badge variant="accent" title="Su plan se renueva solo cada mes">
                Renueva solo
              </Badge>
            )}
            {patient.exemptFromCapacity && (
              <Badge variant="accent" title="Puede agendar aunque el horario esté lleno; no cuenta en los 4 simultáneos">
                Sobre cupo
              </Badge>
            )}
          </>
        }
        description={
          <span className="flex flex-col gap-1">
            <span className="break-all">{patient.email}</span>
            <PlanLine info={infoFromBalance(balance)} />
          </span>
        }
        actions={
          <>
            {/* Una sola acción protagonista según lo que se está haciendo: con los ejercicios abiertos, preparar el entrenamiento */}
            {onExercises ? (
              <Button onClick={prepare} className="min-h-[44px] w-full px-5 sm:w-auto">
                <ClipboardList aria-hidden="true" />
                Preparar entrenamiento
              </Button>
            ) : (
              bookingProfessionalId && (
                <Button onClick={() => setBookingOpen(true)} className="min-h-[44px] w-full px-5 sm:w-auto">
                  <Calendar aria-hidden="true" />
                  Agendar cita
                </Button>
              )
            )}
            <Button variant="outline" onClick={() => setRenewOpen(true)} className="min-h-[44px]">
              <RefreshCw aria-hidden="true" />
              Renovar plan
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} className="min-h-[44px]">
              <Pencil aria-hidden="true" />
              Editar datos
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones" className="h-11 w-11">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[240px]">
                {onExercises && bookingProfessionalId && (
                  <DropdownMenuItem className="min-h-[44px]" onSelect={() => setBookingOpen(true)}>
                    <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                    Agendar cita
                  </DropdownMenuItem>
                )}
                {!onExercises && (
                  <DropdownMenuItem className="min-h-[44px]" onSelect={prepare}>
                    <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" />
                    Preparar entrenamiento
                  </DropdownMenuItem>
                )}
                {fixedProfessionalId && (
                  <DropdownMenuItem className="min-h-[44px]" onSelect={() => setFixedOpen(true)}>
                    <Repeat className="mr-2 h-4 w-4" aria-hidden="true" />
                    Horario fijo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="min-h-[44px]" onSelect={() => setInviteOpen(true)}>
                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  {patient.inviteStatus === 'activated' ? 'Enviar enlace para nueva contraseña' : 'Reenviar invitación'}
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-[44px] text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Eliminar paciente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Tabs value={tab} onValueChange={changeTab}>
        {/* En teléfono y iPad vertical 11 pestañas no caben: se elige la sección con un selector (agrupado, con contadores) */}
        <div className="lg:hidden">
          <Select value={tab} onValueChange={changeTab}>
            <SelectTrigger aria-label="Sección de la ficha" className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.items.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="min-h-[44px]">
                      {s.label}
                      {counts[s.value] !== undefined ? ` (${counts[s.value]})` : ''}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* iPad horizontal y escritorio: las secciones agrupadas por lo que se hace con ellas, con su contador dentro */}
        <div className="hidden flex-wrap gap-x-4 gap-y-2.5 lg:flex" role="presentation">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{g.label}</p>
              <TabsList className="h-auto flex-wrap justify-start">
                {g.items.map((s) => (
                  <TabsTrigger key={s.value} value={s.value} className="min-h-[44px] gap-1.5 px-3">
                    {s.label}
                    {counts[s.value] !== undefined && (
                      <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground" aria-label={`${counts[s.value]} registros`}>
                        {counts[s.value]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          ))}
        </div>

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos personales</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="RUT">{patient.rut}</DetailRow>
                  <DetailRow label="Teléfono">{patient.phone}</DetailRow>
                  <DetailRow label="Último ingreso a la app">
                    {patient.lastLoginAt
                      ? format(parseISO(patient.lastLoginAt), "dd/MM/yyyy 'a las' HH:mm")
                      : patient.inviteStatus === 'activated'
                        ? 'Sin registro (se anota desde su próximo ingreso)'
                        : 'Todavía no ha entrado'}
                  </DetailRow>
                  <DetailRow label="Fecha de nacimiento">
                    {patient.dateOfBirth ? format(parseISO(patient.dateOfBirth.slice(0, 10)), 'dd/MM/yyyy') : undefined}
                  </DetailRow>
                  <DetailRow label="Dirección">{patient.address}</DetailRow>
                  <DetailRow label="Género">{patient.gender}</DetailRow>
                  <DetailRow label="Previsión">{patient.healthInsurance}</DetailRow>
                  <DetailRow label="Cómo llegó">{patient.referralSource}</DetailRow>
                  <DetailRow label="Objetivos">{patient.objectives?.length ? patient.objectives.join(', ') : undefined}</DetailRow>
                  <DetailRow label="Profesional">
                    {typeof assignedProfessional === 'object' && assignedProfessional
                      ? `${assignedProfessional.firstName} ${assignedProfessional.lastName}`
                      : patient.assignedProfessional || 'Sin asignar'}
                    {user?.role === 'admin' && !(typeof assignedProfessional === 'object' && assignedProfessional) && !patient.assignedProfessional && (
                      <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => setEditOpen(true)}>
                        Asignar
                      </Button>
                    )}
                  </DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contacto de emergencia</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="Nombre">{patient.emergencyContact?.name}</DetailRow>
                  <DetailRow label="Teléfono">{patient.emergencyContact?.phone}</DetailRow>
                  <DetailRow label="Relación">{patient.emergencyContact?.relationship}</DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Información médica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ClinicalBaselineFields
                  medicalInfo={patient.medicalInfo}
                  dateOfBirth={patient.dateOfBirth}
                  onSave={async (medicalInfo) => {
                    const updated = await userService.update(patient.id, { medicalInfo });
                    setProfile((prev) => (prev ? { ...prev, patient: updated } : prev));
                  }}
                />
                <div className="border-t border-border pt-3">
                  <DetailList>
                    <DetailRow label="Condiciones crónicas">{patient.medicalInfo?.chronicConditions?.join(', ') || 'Ninguna'}</DetailRow>
                    <DetailRow label="Medicamentos">{patient.medicalInfo?.medications?.join(', ') || 'Ninguno'}</DetailRow>
                    <DetailRow label="Alergias">{patient.medicalInfo?.allergies?.join(', ') || 'Ninguna'}</DetailRow>
                    <DetailRow label="Lesiones">{patient.medicalInfo?.injuries?.join(', ') || 'Ninguna'}</DetailRow>
                  </DetailList>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-3">
          {appointments.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="No hay citas programadas"
              action={
                bookingProfessionalId && (
                  <Button size="sm" onClick={() => setBookingOpen(true)}>
                    <Calendar aria-hidden="true" />
                    Agendar cita
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-5">
              {[
                { title: 'Próximas', list: upcomingApts },
                { title: 'Historial', list: pastApts },
              ].map(({ title, list }) =>
                list.length === 0 ? null : (
                  <section key={title} aria-label={title} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">{title} ({list.length})</h3>
                    <ul className="space-y-2">
              {list.map((apt) => (
                <li key={apt._id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{capitalizeFirst(format(parseDay(apt.date), "EEEE d 'de' MMMM", { locale: es }))}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {apt.startTime} – {apt.endTime}
                      </span>{' '}
                      · {appointmentTypeLabels[apt.type]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {apt.recurringSlot && <Badge variant="outline">Horario fijo</Badge>}
                    {apt.overbooked && <Badge variant="warning">Sobrecupo</Badge>}
                    {apt.outsideCapacity && <Badge variant="accent">Sobre cupo</Badge>}
                    <AppointmentStatusBadge status={apt.status} />
                    {apt.status === 'scheduled' && (
                      <Button size="sm" variant="outline" onClick={() => setManageApt({ apt, action: 'cancel' })}>
                        Cancelar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setManageApt({ apt, action: 'delete' })} aria-label={`Eliminar la cita del ${format(parseDay(apt.date), "d 'de' MMMM", { locale: es })} a las ${apt.startTime}`}>
                      <Trash2 aria-hidden="true" />
                      Eliminar
                    </Button>
                  </div>
                </li>
              ))}
                    </ul>
                  </section>
                )
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="measurements" className="mt-4">
          <div className="space-y-4">
            <MeasurementForm patientId={id!} onSuccess={() => setRecordsKey((k) => k + 1)} />
            <MeasurementHistory patientId={id!} refreshKey={recordsKey} />
          </div>
        </TabsContent>

        <TabsContent value="exercises" className="mt-4">
          <div className="space-y-4">
            <PreparationsCard patientId={id!} patientName={`${patient.firstName} ${patient.lastName}`} openRequest={prepareRequest} onRequestHandled={() => setPrepareRequest(0)} />
            <ExerciseForm patientId={id!} onSuccess={() => setRecordsKey((k) => k + 1)} prefill={exercisePrefill ?? undefined} />
            <ExerciseHistory patientId={id!} refreshKey={recordsKey} onNewWeight={(e) => setExercisePrefill({ name: e.exerciseName, category: e.category, nonce: Date.now() })} />
          </div>
        </TabsContent>

        <TabsContent value="eva" className="mt-4">
          <EVAForm patientId={id!} onSuccess={() => {}} />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <PatientFilesTab patientId={id!} />
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <PatientPhotos patientId={id!} />
        </TabsContent>

        <TabsContent value="wellness" className="mt-4">
          <WellnessHistoryTab patientId={id!} />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <PatientGoalsTab patientId={id!} />
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <PatientAchievementsTab patientId={id!} />
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          {balance === null ? (
            <Alert variant="warning">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>No se pudo cargar el plan de este paciente.</AlertDescription>
            </Alert>
          ) : balance.hasActivePlan && balance.plan ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">{balance.paymentPending ? 'Plan pendiente de pago' : 'Plan activo'}</CardTitle>
                  <StatusBadge tone={balance.paymentPending ? 'warning' : 'success'}>
                    {balance.paymentPending ? 'Pendiente de pago' : 'Activo'}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {balance.paymentPending && balance.paymentDueBy && (
                  <Alert variant="warning">
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription className="space-y-2">
                      <p>
                        El paciente tiene hasta el {formatPaymentDeadline(balance.paymentDueBy)} para pagar y puede agendar hasta esa fecha. Si no
                        paga, el plan vence solo.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/admin/planes">Ir a Planes para registrar el pago</Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                <Button size="sm" variant="outline" className="w-fit" onClick={() => setRenewOpen(true)}>
                  <RefreshCw aria-hidden="true" />
                  Renovar plan
                </Button>
                <DetailList>
                  <DetailRow label="Tipo">{SERVICE_TYPE_LABELS[balance.plan.serviceType]}</DetailRow>
                  <DetailRow label="Plan">{formatCycleProgress(balance.plan) || undefined}</DetailRow>
                  <DetailRow label="Sesiones">{formatPlanUsage(balance.plan)}</DetailRow>
                  <DetailRow label="Inicio">{format(parseISO(balance.plan.startDate), 'dd/MM/yyyy')}</DetailRow>
                  <DetailRow label={balance.plan.openEnded ? 'Duración' : 'Vence'}>
                    {balance.plan.openEnded ? 'Hasta completar las sesiones' : format(parseISO(balance.plan.endDate), 'dd/MM/yyyy')}
                  </DetailRow>
                  {balance.extraSessionsAvailable > 0 && <DetailRow label="Sesiones extra">{balance.extraSessionsAvailable}</DetailRow>}
                </DetailList>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={FileText}
              title="Este paciente no tiene un plan activo"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => setRenewOpen(true)}>Renovar plan</Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/admin/planes/clasificar">Asignar plan</Link>
                  </Button>
                </div>
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <RenewPlanDialog
        patientId={id!}
        patientName={`${patient.firstName} ${patient.lastName}`}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onRenewed={fetchData}
        canSetAutoRenew={user?.role === 'admin' || user?.role === 'professional'}
        autoRenew={patient.autoRenew === true}
        onAutoRenewChanged={fetchData}
      />

      <EditPatientDialog
        patient={patient}
        open={editOpen}
        onOpenChange={setEditOpen}
        canAssign={user?.role === 'admin'}
        canChangeProfessional={user?.role === 'professional'}
        onSaved={fetchData}
      />

      <DeletePatientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        patientId={id!}
        patientName={`${patient.firstName} ${patient.lastName}`}
        onDeleted={() => navigate('/app/admin/pacientes')}
      />
      <ConfirmDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={patient.inviteStatus === 'activated' ? `¿Enviar enlace de nueva contraseña a ${patient.firstName}?` : `¿Reenviar invitación a ${patient.firstName}?`}
        description="Se generará un link nuevo y el anterior dejará de funcionar. Si el paciente ya tenía acceso, esto también sirve para resetear su contraseña (por ejemplo, si la perdió)."
        confirmLabel="Reenviar"
        onConfirm={resendInvite}
      />

      {bookingProfessionalId && (
        <AdminBookingDialog
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          patientId={id!}
          professionalId={bookingProfessionalId}
          defaultType={bookingDefaultType}
          canOverbook={user?.role === 'admin' || (user?.role === 'professional' && bookingProfessionalId === user.id)}
          onBooked={fetchData}
        />
      )}

      {manageApt && (
        <AppointmentDetailDialog
          key={`${manageApt.apt._id}-${manageApt.action}`}
          appointment={manageApt.apt}
          initialAction={manageApt.action}
          canManageAny
          onClose={() => setManageApt(null)}
          onChanged={fetchData}
        />
      )}

      {fixedProfessionalId && (
        <FixedScheduleDialog
          open={fixedOpen}
          onClose={() => setFixedOpen(false)}
          professionalId={fixedProfessionalId}
          allowedTypes={fixedTypes}
          patientId={id!}
          onChanged={fetchData}
        />
      )}
    </div>
  );
};

export default PatientDetail;
