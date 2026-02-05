import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { planService } from '@/services/planService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Clock, Activity, Ruler, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, Plan } from '@/types';

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [upcoming, plan] = await Promise.all([
          appointmentService.getUpcoming(),
          planService.getActive(user.id),
        ]);
        setNextAppointment(upcoming[0] || null);
        setActivePlan(plan);
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hola, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">Bienvenido a tu espacio Prime F&H</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Next appointment */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próxima Sesión</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {nextAppointment ? (
              <div>
                <p className="text-lg font-bold">
                  {format(parseISO(nextAppointment.date), "d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {nextAppointment.startTime} - {nextAppointment.endTime}
                </p>
                <p className="text-sm text-secondary mt-1 capitalize">
                  {nextAppointment.type}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tienes citas programadas</p>
            )}
          </CardContent>
        </Card>

        {/* Active plan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mi Plan</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activePlan ? (
              <div>
                <p className="text-lg font-bold capitalize">{activePlan.type}</p>
                <p className="text-sm text-muted-foreground">
                  {activePlan.sessionsPerWeek} sesiones/semana
                </p>
                <p className="text-sm text-muted-foreground">
                  Hasta {format(parseISO(activePlan.endDate), "d 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tienes un plan activo</p>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate('/app/reservar')}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Reservar hora
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate('/app/mediciones')}
            >
              <Ruler className="h-4 w-4 mr-2" />
              Ver mediciones
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate('/app/dolor')}
            >
              <Activity className="h-4 w-4 mr-2" />
              Registros de dolor
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientDashboard;
