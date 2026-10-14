import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardsSkeleton, PageSkeleton, StatsSkeleton } from '@/components/shared/Skeletons';
import PageHeader from '@/components/shared/PageHeader';
import { appointmentStart } from '@/lib/appointments';
import WellnessCheckinCard from '@/components/wellness/WellnessCheckinCard';
import type { ReadinessTodayStatus } from '@/components/wellness/readinessStatus';
import TodayCard from '@/components/dashboard/TodayCard';
import NextSessionCard from '@/components/dashboard/NextSessionCard';
import PlanCard from '@/components/dashboard/PlanCard';
import ProgressCard from '@/components/dashboard/ProgressCard';
import { computePlanView } from '@/components/dashboard/planView';
import { computeTodayActions, greetingFor, todayLabel, type TodayTarget } from '@/components/dashboard/todayActions';
import { useAchievementsSummary } from '@/components/dashboard/useAchievementsSummary';
import { useNow } from '@/components/dashboard/useNow';
import { usePlanHistory } from '@/components/dashboard/usePlanHistory';
import FounderBadge from '@/components/plans/FounderBadge';
import PaymentPendingBanner from '@/components/plans/PaymentPendingBanner';
import { Activity, CalendarCheck, CalendarPlus, Ruler, TriangleAlert } from 'lucide-react';
import type { Appointment, SessionBalance } from '@/types';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Appointment[] | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const readinessRef = useRef<HTMLDivElement | null>(null);
  const planRef = useRef<HTMLElement | null>(null);
  // Estado del Readiness de hoy: lo comunica la propia tarjeta del cuestionario (no se vuelve a consultar)
  const [readiness, setReadiness] = useState<ReadinessTodayStatus>('loading');
  const now = useNow();
  // Constancia y siguiente logro: una consulta aparte, para que si tarda o falla no afecte al resto de la pantalla
  const summary = useAchievementsSummary();

  // Baja hasta una sección y la enfoca (teclado/lector); con «menos movimiento» no se anima
  const focusSection = useCallback((el: HTMLElement | null) => {
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  }, []);

  // Desde el recordatorio ('?readiness=1') se baja directo al Readiness y se enfoca para teclado/lector
  const wantsReadiness = searchParams.get('readiness') === '1';
  useEffect(() => {
    if (loading || !wantsReadiness) return;
    focusSection(readinessRef.current);
  }, [loading, wantsReadiness, focusSection]);

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

  // Sin plan vigente se consultan sus planes (una sola vez) para decir si «venció», «todavía no empieza» o «nunca tuvo»
  const planHistory = usePlanHistory(user?.id, !loading && balance !== null && !balance.hasActivePlan);

  if (loading) {
    return (
      <PageSkeleton label="Cargando tu espacio…">
        <StatsSkeleton count={3} />
        <CardsSkeleton count={2} />
      </PageSkeleton>
    );
  }

  const todayResult = computeTodayActions({ now, upcoming, balance, readiness, planHistory: planHistory.kind });
  const planView = computePlanView({ balance, history: planHistory, now });
  const goToSection = (target: TodayTarget) => focusSection(target === 'readiness' ? readinessRef.current : planRef.current);

  // "Próxima sesión" no debe ser una de hoy que ya terminó ni una que ya empezó
  const nextAppointment = upcoming?.find((apt) => appointmentStart(apt) > now) ?? null;
  const failed = upcoming === null || balance === null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor(now)}, ${user?.firstName ?? ''}`}
        badges={user?.isFounder ? <FounderBadge tone="brand" /> : undefined}
        description={todayLabel(now)}
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

      {/* Qué conviene hacer hoy: máximo 3 acciones con datos reales (reglas en dashboard/todayActions.ts) */}
      <TodayCard result={todayResult} onGoTo={goToSection} />

      {/* Check-in de bienestar: lo primero que se hace cada día. La tarjeta avisa su estado (pendiente/hecho) a «Para hoy». */}
      <div id="readiness" ref={readinessRef} tabIndex={-1} className="scroll-mt-20 focus:outline-none" aria-label="Readiness de hoy">
        <WellnessCheckinCard hasActivePlan={!!balance?.hasActivePlan} onStatusChange={setReadiness} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NextSessionCard appointment={nextAppointment} failed={upcoming === null} now={now} />
        <PlanCard ref={planRef} view={planView} />
      </div>

      <ProgressCard status={summary.status} view={summary.view} />

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
