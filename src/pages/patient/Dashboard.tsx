import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import EmptyState from '@/components/shared/EmptyState';
import { CardsSkeleton, PageSkeleton, StatsSkeleton } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { appointmentTypeLabels } from '@/components/shared/statusMeta';
import { SERVICE_TYPE_LABELS, formatPlanUsage } from '@/config/planCatalog';
import { appointmentStart, dayKey } from '@/lib/appointments';
import { capitalizeFirst } from '@/lib/utils';
import { getWhatsAppUrl } from '@/config/contact';
import WellnessCheckinCard from '@/components/wellness/WellnessCheckinCard';
import FounderBadge from '@/components/plans/FounderBadge';
import PaymentPendingBanner from '@/components/plans/PaymentPendingBanner';
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  FileText,
  MessageCircle,
  Ruler,
  TriangleAlert,
} from 'lucide-react';
import { differenceInCalendarDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment, SessionBalance } from '@/types';

const dayOf = (apt: Appointment) => dayKey(apt.date);

const dayLabel = (day: string) => {
  const date = parseISO(day);
  if (isToday(date)) return 'Hoy';
  if (isTomorrow(date)) return 'Mañana';
  return capitalizeFirst(format(date, "EEEE d 'de' MMMM", { locale: es }));
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Appointment[] | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const readinessRef = useRef<HTMLDivElement>(null);

  // Desde el recordatorio ('?readiness=1') se baja directo al Readiness y se enfoca para teclado/lector
  const wantsReadiness = searchParams.get('readiness') === '1';
  useEffect(() => {
    if (loading || !wantsReadiness) return;
    readinessRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    readinessRef.current?.focus({ preventScroll: true });
  }, [loading, wantsReadiness]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [apts, bal] = await Promise.allSettled([
      appointmentService.getUpcoming(),
      clientPlanService.getBalance(user.id),
    ]);
    setUpcoming(apts.status === 'fulfilled' ? apts.value : null);
    setBalance(bal.status === 'fulfilled' ? bal.value : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <PageSkeleton label="Cargando tu espacio…">
        <StatsSkeleton count={3} />
        <CardsSkeleton count={2} />
      </PageSkeleton>
    );
  }

  // "Próxima sesión" no debe ser una de hoy que ya empezó
  const now = new Date();
  const nextAppointment = upcoming?.find((apt) => appointmentStart(apt) > now) ?? null;
  const plan = balance?.plan;
  const daysLeft = plan ? differenceInCalendarDays(parseISO(plan.endDate), now) : null;
  const sessionsPct =
    plan && !plan.unlimited && plan.sessionsTotal > 0
      ? Math.min(100, Math.round((plan.sessionsUsed / plan.sessionsTotal) * 100))
      : 0;
  const failed = upcoming === null || balance === null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${user?.firstName ?? ''}`}
        badges={user?.isFounder ? <FounderBadge /> : undefined}
        description="Bienvenido a tu espacio Prime F&H"
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar algunos datos.</span>
            <Button variant="outline" size="sm" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {balance?.paymentPending && balance.paymentDueBy && <PaymentPendingBanner paymentDueBy={balance.paymentDueBy} />}

      {/* Check-in de bienestar: lo primero que se hace cada día */}
      <div id="readiness" ref={readinessRef} tabIndex={-1} className="scroll-mt-20 focus:outline-none" aria-label="Readiness de hoy">
        <WellnessCheckinCard hasActivePlan={!!balance?.hasActivePlan} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próxima sesión</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {upcoming === null ? (
              <p className="text-sm text-muted-foreground">No se pudo cargar tu próxima sesión.</p>
            ) : nextAppointment ? (
              <div className="space-y-1">
                <p className="text-xl font-semibold">{dayLabel(dayOf(nextAppointment))}</p>
                <p className="text-sm tabular-nums">
                  {nextAppointment.startTime} – {nextAppointment.endTime}
                </p>
                <p className="text-sm text-secondary">{appointmentTypeLabels[nextAppointment.type]}</p>
                <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0">
                  <Link to="/app/mis-citas">Ver mis citas</Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={CalendarPlus}
                title="No tienes citas programadas"
                className="border-0 px-0 py-4"
                action={
                  <Button asChild size="sm">
                    <Link to="/app/reservar">Reservar hora</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className={balance && !balance.hasActivePlan ? 'border-destructive/50' : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mi plan</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {balance === null ? (
              <p className="text-sm text-muted-foreground">No se pudo cargar tu plan.</p>
            ) : balance.hasActivePlan && plan ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xl font-semibold">{SERVICE_TYPE_LABELS[plan.serviceType]}</p>
                  <span className="text-sm text-muted-foreground">
                    {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} día(s) restante(s)` : 'vence hoy'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {!plan.unlimited && <Progress value={sessionsPct} aria-label="Sesiones usadas del plan" className="h-2.5" />}
                  <p className="text-xs text-muted-foreground">{formatPlanUsage(plan)}</p>
                </div>
                {balance.extraSessionsAvailable > 0 && (
                  <p className="text-xs text-secondary">+{balance.extraSessionsAvailable} sesión(es) extra disponible(s)</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-destructive">Tu plan venció. Contacta a Prime F&H para renovar</p>
                <Button
                  className="bg-[#25D366] text-background hover:bg-[#20BD5C]"
                  size="sm"
                  onClick={() => window.open(getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H'), '_blank')}
                >
                  <MessageCircle aria-hidden="true" />
                  Renovar por WhatsApp
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Accesos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Button asChild>
            <Link to="/app/reservar">
              <CalendarPlus aria-hidden="true" />
              Reservar hora
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/mis-citas">
              <CalendarCheck aria-hidden="true" />
              Mis citas
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/mediciones">
              <Ruler aria-hidden="true" />
              Mediciones
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/dolor">
              <Activity aria-hidden="true" />
              Dolor (EVA)
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientDashboard;
