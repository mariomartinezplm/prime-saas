import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { appointmentService } from '@/services/appointmentService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, UserPlus, ClipboardList, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DashboardStats, Appointment } from '@/types';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashStats, today] = await Promise.all([
          userService.getDashboardStats(),
          appointmentService.getToday(),
        ]);
        setStats(dashStats);
        setTodayAppointments(today);
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Bienvenido, {user?.firstName}. Resumen de tu centro.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalPatients || 0}</p>
            <p className="text-xs text-muted-foreground">
              {stats?.activePatients || 0} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Citas Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayAppointments.length}</p>
            <p className="text-xs text-muted-foreground">sesiones programadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats?.upcomingAppointments?.length || 0}
            </p>
            <p className="text-xs text-muted-foreground">citas esta semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Acciones</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => navigate('/app/admin/registro')}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Registrar paciente
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => navigate('/app/admin/calendario')}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Ver calendario
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Today's agenda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agenda del Día</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay citas programadas para hoy</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => {
                const patient = typeof apt.patient === 'object' ? apt.patient : null;
                return (
                  <div
                    key={apt._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{apt.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.startTime} - {apt.endTime}</p>
                      <p className="text-xs text-secondary capitalize">{apt.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
