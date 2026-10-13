import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  ArrowLeft,
  Calendar,
  CalendarX,
  Dumbbell,
  FileText,
  MoreHorizontal,
  Pencil,
  Ruler,
  Send,
  TriangleAlert,
  UserX,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnsavedChangesApi } from '@/contexts/UnsavedChangesContext';
import MeasurementForm from '@/components/forms/MeasurementForm';
import ExerciseForm from '@/components/forms/ExerciseForm';
import EVAForm from '@/components/forms/EVAForm';
import WellnessHistoryTab from '@/components/wellness/WellnessHistoryTab';
import PatientFilesTab from '@/components/files/PatientFilesTab';
import PatientPhotos from '@/components/photos/PatientPhotos';
import PatientAchievementsTab from '@/components/achievements/PatientAchievementsTab';
import { MeasurementHistory, ExerciseHistory } from '@/components/records/PatientRecordHistory';
import ClinicalBaselineFields from '@/components/forms/ClinicalBaselineFields';
import EditPatientDialog from '@/components/forms/EditPatientDialog';
import AdminBookingDialog from '@/components/booking/AdminBookingDialog';
import FounderBadge from '@/components/plans/FounderBadge';
import { DetailList, DetailRow } from '@/components/patients/DetailList';
import PlanLine from '@/components/patients/PlanLine';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import { CardsSkeleton, PageSkeleton, StatsSkeleton } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { ActiveStatusBadge, AppointmentStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { SERVICE_TYPE_LABELS, formatPlanUsage, formatCycleProgress, formatPaymentDeadline } from '@/config/planCatalog';
import { parseDay } from '@/lib/appointments';
import { showApiError } from '@/lib/apiError';
import { todayLocal } from '@/lib/evolutionDate';
import { infoFromBalance } from '@/lib/patientPlan';
import { notify } from '@/lib/notify';
import { capitalizeFirst } from '@/lib/utils';
import type { Appointment, PatientProfile, SessionBalance } from '@/types';

const SECTIONS = [
  { value: 'profile', label: 'Perfil' },
  { value: 'appointments', label: 'Citas' },
  { value: 'measurements', label: 'Mediciones' },
  { value: 'exercises', label: 'Ejercicios' },
  { value: 'eva', label: 'EVA (dolor)' },
  { value: 'files', label: 'Archivos' },
  { value: 'photos', label: 'Fotos' },
  { value: 'wellness', label: 'Bienestar' },
  { value: 'achievements', label: 'Logros' },
  { value: 'plan', label: 'Plan' },
] as const;

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tab, setTab] = useState('profile');
  // Cambiar de sección descarta lo escrito en la anterior: si hay un formulario a medias, se pregunta
  const { confirmLeave } = useUnsavedChangesApi();
  const changeTab = (next: string) => {
    if (next !== tab) confirmLeave(() => setTab(next));
  };
  const [bookingOpen, setBookingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [recordsKey, setRecordsKey] = useState(0);

  const fetchData = useCallback(async () => {
    if (!id) return;
    // El perfil es imprescindible; el saldo y las citas se muestran si llegan. Las citas se piden
    // desde hoy y ya filtradas por este paciente en el servidor.
    const [prof, bal, apts] = await Promise.allSettled([
      userService.getPatientProfile(id),
      clientPlanService.getBalance(id),
      appointmentService.getAll({ status: 'scheduled', from: todayLocal(), patient: id }),
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

  const resendInvite = async () => {
    try {
      await userService.resendInvite(id!);
      notify.success('Invitación reenviada');
    } catch (err) {
      showApiError(err, 'No se pudo reenviar la invitación');
      throw err;
    }
  };

  const statCards = [
    { label: 'Citas', value: stats.totalAppointments, icon: Calendar, tab: 'appointments' },
    { label: 'Mediciones', value: stats.totalMeasurements, icon: Ruler, tab: 'measurements' },
    { label: 'Ejercicios', value: stats.totalExercises, icon: Dumbbell, tab: 'exercises' },
    { label: 'EVA', value: stats.totalEVARecords, icon: Activity, tab: 'eva' },
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
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
            {patient.isFounder && <FounderBadge />}
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
            {bookingProfessionalId && (
              <Button onClick={() => setBookingOpen(true)}>
                <Calendar aria-hidden="true" />
                Agendar cita
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" />
              Editar datos
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reenviar invitación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, tab: target }) => (
          <button
            key={label}
            type="button"
            onClick={() => changeTab(target)}
            className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
                <div>
                  <p className="text-xl font-semibold leading-none">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        {/* En móvil 10 pestañas no caben: se elige la sección con un selector */}
        <div className="md:hidden">
          <Select value={tab} onValueChange={changeTab}>
            <SelectTrigger aria-label="Sección de la ficha">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden h-auto flex-wrap justify-start md:inline-flex">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

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
            <ul className="space-y-2">
              {appointments.map((apt) => (
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
                    {apt.overbooked && <Badge variant="warning">Sobrecupo</Badge>}
                    {apt.outsideCapacity && <Badge variant="accent">Sobre cupo</Badge>}
                    <AppointmentStatusBadge status={apt.status} />
                  </div>
                </li>
              ))}
            </ul>
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
            <ExerciseForm patientId={id!} onSuccess={() => setRecordsKey((k) => k + 1)} />
            <ExerciseHistory patientId={id!} refreshKey={recordsKey} />
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
                <DetailList>
                  <DetailRow label="Tipo">{SERVICE_TYPE_LABELS[balance.plan.serviceType]}</DetailRow>
                  <DetailRow label="Plan">{formatCycleProgress(balance.plan) || undefined}</DetailRow>
                  <DetailRow label="Sesiones">{formatPlanUsage(balance.plan)}</DetailRow>
                  <DetailRow label="Inicio">{format(parseISO(balance.plan.startDate), 'dd/MM/yyyy')}</DetailRow>
                  <DetailRow label="Vence">{format(parseISO(balance.plan.endDate), 'dd/MM/yyyy')}</DetailRow>
                  {balance.extraSessionsAvailable > 0 && <DetailRow label="Sesiones extra">{balance.extraSessionsAvailable}</DetailRow>}
                </DetailList>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={FileText}
              title="Este paciente no tiene un plan activo"
              action={
                <Button asChild size="sm">
                  <Link to="/app/admin/planes/clasificar">Asignar plan</Link>
                </Button>
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <EditPatientDialog
        patient={patient}
        open={editOpen}
        onOpenChange={setEditOpen}
        canAssign={user?.role === 'admin'}
        onSaved={fetchData}
      />

      <ConfirmDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`¿Reenviar invitación a ${patient.firstName}?`}
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
          canOverbook={user?.role === 'admin'}
          onBooked={fetchData}
        />
      )}
    </div>
  );
};

export default PatientDetail;
