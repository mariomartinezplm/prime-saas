import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userService } from '@/services/userService';
import { appointmentService } from '@/services/appointmentService';
import { planService } from '@/services/planService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Ruler, Dumbbell, Activity, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import MeasurementForm from '@/components/forms/MeasurementForm';
import ExerciseForm from '@/components/forms/ExerciseForm';
import EVAForm from '@/components/forms/EVAForm';
import PlanForm from '@/components/forms/PlanForm';
import type { User, PatientProfile, Plan, Appointment } from '@/types';

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const [prof, plan, apts] = await Promise.all([
          userService.getPatientProfile(id),
          planService.getActive(id),
          appointmentService.getAll({ status: 'scheduled' }),
        ]);
        setProfile(prof);
        setActivePlan(plan);
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
    fetchData();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/pacientes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-muted-foreground">{patient.email} {patient.rut && `| ${patient.rut}`}</p>
        </div>
      </div>

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
        <TabsList>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="appointments">Citas</TabsTrigger>
          <TabsTrigger value="measurements">Mediciones</TabsTrigger>
          <TabsTrigger value="exercises">Ejercicios</TabsTrigger>
          <TabsTrigger value="eva">EVA</TabsTrigger>
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
                  <span>{patient.dateOfBirth ? format(parseISO(patient.dateOfBirth), 'dd/MM/yyyy') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dirección</span>
                  <span>{patient.address || '-'}</span>
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
              <CardContent className="space-y-3 text-sm">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-3">
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
                <Badge>{apt.status}</Badge>
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

        <TabsContent value="plan" className="mt-4">
          {activePlan ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Plan Activo</CardTitle>
                  <Badge className="bg-green-500/20 text-green-400">Activo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="capitalize">{activePlan.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sesiones/semana</span>
                  <span>{activePlan.sessionsPerWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inicio</span>
                  <span>{format(parseISO(activePlan.startDate), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fin</span>
                  <span>{format(parseISO(activePlan.endDate), 'dd/MM/yyyy')}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <PlanForm patientId={id!} onSuccess={() => window.location.reload()} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetail;
