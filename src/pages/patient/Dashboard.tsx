import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SERVICE_TYPE_LABELS } from '@/config/planCatalog';
import { getWhatsAppUrl } from '@/config/contact';
import { CalendarPlus, Clock, Activity, Ruler, FileText, MessageCircle } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, SessionBalance } from '@/types';

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [upcoming, sessionBalance] = await Promise.all([
          appointmentService.getUpcoming(),
          clientPlanService.getBalance(user.id),
        ]);
        setNextAppointment(upcoming[0] || null);
        setBalance(sessionBalance);
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

  const plan = balance?.plan;
  const daysLeft = plan ? differenceInCalendarDays(parseISO(plan.endDate), new Date()) : null;
  const sessionsPct = plan && plan.sessionsTotal > 0
    ? Math.min(100, Math.round((plan.sessionsUsed / plan.sessionsTotal) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hola, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">Bienvenido a tu espacio Prime F&H</p>
      </div>

      {/* Plan destacado */}
      <Card className={!balance?.hasActivePlan ? 'border-red-500/50' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Mi Plan</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {balance?.hasActivePlan && plan ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{SERVICE_TYPE_LABELS[plan.serviceType]}</p>
                <span className="text-sm text-muted-foreground">
                  {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} día(s) restante(s)` : 'vence hoy'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-gray-500/25 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${sessionsPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {plan.sessionsUsed}/{plan.sessionsTotal} sesiones usadas
                </p>
              </div>
              {balance.extraSessionsAvailable > 0 && (
                <p className="text-xs text-secondary">
                  +{balance.extraSessionsAvailable} sesión(es) extra disponible(s)
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-400 font-medium">
                Tu plan venció. Contacta a Prime F&H para renovar
              </p>
              <Button
                className="bg-[#25D366] hover:bg-[#20BD5C] text-white"
                size="sm"
                onClick={() => window.open(getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H'), '_blank')}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Renovar por WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
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
