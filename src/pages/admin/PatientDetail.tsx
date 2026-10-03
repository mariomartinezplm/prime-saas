import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Calendar, Ruler, Dumbbell, Activity, FileText, Send, Loader2, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import MeasurementForm from '@/components/forms/MeasurementForm';
import ExerciseForm from '@/components/forms/ExerciseForm';
import EVAForm from '@/components/forms/EVAForm';
import WellnessHistoryTab from '@/components/wellness/WellnessHistoryTab';
import PatientFilesTab from '@/components/files/PatientFilesTab';
import ClinicalBaselineFields from '@/components/forms/ClinicalBaselineFields';
import EditPatientDialog from '@/components/forms/EditPatientDialog';
import AdminBookingDialog from '@/components/booking/AdminBookingDialog';
import { SERVICE_TYPE_LABELS, formatPlanUsage, formatCycleProgress, formatPaymentDeadline } from '@/config/planCatalog';
import type { User, PatientProfile, SessionBalance, Appointment } from '@/types';
import FounderBadge from '@/components/plans/FounderBadge';

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [prof, bal, apts] = await Promise.all([
        userService.getPatientProfile(id),
        clientPlanService.getBalance(id),
        appointmentService.getAll({ status: 'scheduled' }),
      ]);
      setProfile(prof);
      setBalance(bal);
      setAppointments(apts.filter((a) => {
        const patientId = typeof a.patient === 'object' ? a.patient.id : a.patient;
        return patientId === id;
      }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-muted-foreground">Paciente no encontrado</p>;
  }

  const { patient, stats } = profile;
  const assignedProfessional = patient.assignedProfessionalId;
  const bookingProfessionalId =
    (typeof assignedProfessional === 'object' ? assignedProfessional?.id : assignedProfessional) || user?.id;
  const bookingDefaultType = balance?.plan?.serviceType ?? 'kinesiologia';

  const handleResendInvite = async () => {
    setIsResending(true);
    try {
      await userService.resendInvite(id!);
      toast.success('Invitación reenviada');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'No se pudo reenviar la invitación');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/pacientes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              {patient.firstName} {patient.lastName}
              {patient.isFounder && <FounderBadge />}
            </h1>
            <p className="text-muted-foreground">{patient.email} {patient.rut && `| ${patient.rut}`}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar datos
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isResending}>
              {isResending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Reenviar invitación
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Reenviar invitación a {patient.firstName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se generará un link nuevo y el anterior dejará de funcionar. Si el paciente ya
                tenía acceso, esto también sirve para resetear su contraseña (por ejemplo, si la
                perdió).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleResendInvite}>Reenviar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      <EditPatientDialog
        patient={patient}
        open={editOpen}
        onOpenChange={setEditOpen}
        canAssign={user?.role === 'admin'}
        onSaved={fetchData}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-bold">{stats.totalAppointments}</p>
            <p className="text-xs text-muted-foreground">Citas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Ruler className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-bold">{stats.totalMeasurements}</p>
            <p className="text-xs text-muted-foreground">Mediciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Dumbbell className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-bold">{stats.totalExercises}</p>
            <p className="text-xs text-muted-foreground">Ejercicios</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-bold">{stats.totalEVARecords}</p>
            <p className="text-xs text-muted-foreground">EVA</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="appointments">Citas</TabsTrigger>
          <TabsTrigger value="measurements">Mediciones</TabsTrigger>
          <TabsTrigger value="exercises">Ejercicios</TabsTrigger>
          <TabsTrigger value="eva">EVA</TabsTrigger>
          <TabsTrigger value="files">Archivos</TabsTrigger>
          <TabsTrigger value="wellness">Bienestar</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Datos Personales</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span>{patient.phone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha nacimiento</span>
                  <span>{patient.dateOfBirth ? format(parseISO(patient.dateOfBirth.slice(0, 10)), 'dd/MM/yyyy') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dirección</span>
                  <span>{patient.address || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Género</span>
                  <span>{patient.gender || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previsión</span>
                  <span>{patient.healthInsurance || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Cómo llegó</span>
                  <span className="text-right">{patient.referralSource || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Objetivos</span>
                  <span className="text-right">{patient.objectives?.length ? patient.objectives.join(', ') : '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Profesional</span>
                  <span className="text-right">
                    {typeof assignedProfessional === 'object' && assignedProfessional
                      ? `${assignedProfessional.firstName} ${assignedProfessional.lastName}`
                      : patient.assignedProfessional || 'Sin asignar'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Contacto de Emergencia</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre</span>
                  <span>{patient.emergencyContact?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span>{patient.emergencyContact?.phone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Relación</span>
                  <span>{patient.emergencyContact?.relationship || '-'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-lg">Información Médica</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ClinicalBaselineFields
                  medicalInfo={patient.medicalInfo}
                  dateOfBirth={patient.dateOfBirth}
                  onSave={async (medicalInfo) => {
                    const updated = await userService.update(patient.id, { medicalInfo });
                    setProfile((prev) => prev ? { ...prev, patient: updated } : prev);
                  }}
                />
                <div className="border-t border-border pt-3 space-y-3">
                <div>
                  <span className="text-muted-foreground">Condiciones crónicas: </span>
                  <span>{patient.medicalInfo?.chronicConditions?.join(', ') || 'Ninguna'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Medicamentos: </span>
                  <span>{patient.medicalInfo?.medications?.join(', ') || 'Ninguno'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Alergias: </span>
                  <span>{patient.medicalInfo?.allergies?.join(', ') || 'Ninguna'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lesiones: </span>
                  <span>{patient.medicalInfo?.injuries?.join(', ') || 'Ninguna'}</span>
                </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-3">
          {bookingProfessionalId && (
            <Button size="sm" onClick={() => setBookingOpen(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Agendar cita
            </Button>
          )}
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin citas</p>
          ) : (
            appointments.map((apt) => (
              <div key={apt._id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm">
                    {format(parseISO(apt.date), "d 'de' MMMM", { locale: es })}
                  </p>
                  <p className="text-xs text-muted-foreground">{apt.startTime} - {apt.endTime} | {apt.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {apt.overbooked && <Badge className="bg-amber-500/20 text-amber-400">Sobrecupo</Badge>}
                  <Badge>{apt.status}</Badge>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="measurements" className="mt-4">
          <MeasurementForm patientId={id!} onSuccess={() => {}} />
        </TabsContent>

        <TabsContent value="exercises" className="mt-4">
          <ExerciseForm patientId={id!} onSuccess={() => {}} />
        </TabsContent>

        <TabsContent value="eva" className="mt-4">
          <EVAForm patientId={id!} onSuccess={() => {}} />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <PatientFilesTab patientId={id!} />
        </TabsContent>

        <TabsContent value="wellness" className="mt-4">
          <WellnessHistoryTab patientId={id!} />
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          {balance?.hasActivePlan && balance.plan ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{balance.paymentPending ? 'Plan pendiente de pago' : 'Plan Activo'}</CardTitle>
                  {balance.paymentPending
                    ? <Badge className="bg-amber-500/20 text-amber-400">Pendiente de pago</Badge>
                    : <Badge className="bg-green-500/20 text-green-400">Activo</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {balance.paymentPending && balance.paymentDueBy && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400 space-y-2">
                    <p>
                      El paciente tiene hasta el {formatPaymentDeadline(balance.paymentDueBy)} para pagar y puede agendar hasta esa fecha.
                      Si no paga, el plan vence solo.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/app/admin/planes')}>
                      Ir a Planes para registrar el pago
                    </Button>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span>{SERVICE_TYPE_LABELS[balance.plan.serviceType]}</span>
                </div>
                {formatCycleProgress(balance.plan) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span>{formatCycleProgress(balance.plan)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sesiones</span>
                  <span>{formatPlanUsage(balance.plan)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inicio</span>
                  <span>{format(parseISO(balance.plan.startDate), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vence</span>
                  <span>{format(parseISO(balance.plan.endDate), 'dd/MM/yyyy')}</span>
                </div>
                {balance.extraSessionsAvailable > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sesiones extra</span>
                    <span>{balance.extraSessionsAvailable}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-muted-foreground text-sm">Este paciente no tiene un plan activo.</p>
                <Button size="sm" onClick={() => navigate('/app/admin/planes/clasificar')}>
                  Asignar plan
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
