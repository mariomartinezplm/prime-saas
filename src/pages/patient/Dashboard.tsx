import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentService } from '@/services/appointmentService';
import { clientPlanService } from '@/services/clientPlanService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { withTimeout } from '@/lib/withTimeout';
import WorkoutEntryCard from '@/components/workout/WorkoutEntryCard';
import WellnessCheckinCard from '@/components/wellness/WellnessCheckinCard';
import type { ReadinessTodayStatus } from '@/components/wellness/readinessStatus';
import HeroSessionCard from '@/components/dashboard/HeroSessionCard';
import PlanRingCard from '@/components/dashboard/PlanRingCard';
import ConstancyRingCard from '@/components/dashboard/ConstancyRingCard';
import NextAchievementCard from '@/components/dashboard/NextAchievementCard';
import QuickActions from '@/components/dashboard/QuickActions';
import { computeHeroView } from '@/components/dashboard/heroView';
import { computePlanView } from '@/components/dashboard/planView';
import { greetingFor, todayLabel } from '@/components/dashboard/todayActions';
import { hasLoadError, planIsWaiting, queriesToRetry, type DashboardQuery, type LoadState } from '@/components/dashboard/dashboardLoad';
import { useAchievementsSummary } from '@/components/dashboard/useAchievementsSummary';
import { useNow } from '@/components/dashboard/useNow';
import { usePlanHistory } from '@/components/dashboard/usePlanHistory';
import FounderBadge from '@/components/plans/FounderBadge';
import PaymentPendingBanner from '@/components/plans/PaymentPendingBanner';
import GoalsPrompt from '@/components/goals/GoalsPrompt';
import WeeklyCheckin from '@/components/goals/WeeklyCheckin';
import { useMyGoals } from '@/hooks/useMyGoals';
import { TriangleAlert } from 'lucide-react';
import type { Appointment, SessionBalance } from '@/types';

const PatientDashboard = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [searchParams] = useSearchParams();
  const readinessRef = useRef<HTMLDivElement | null>(null);

  // Citas y saldo del plan: dos consultas INDEPENDIENTES. Cada bloque aparece apenas tiene lo suyo; si una falla, lo que ya se
  // cargó bien se conserva y «Reintentar» repite solo lo que falló.
  const [upcoming, setUpcoming] = useState<Appointment[] | null>(null);
  const [balance, setBalance] = useState<SessionBalance | null>(null);
  const [states, setStates] = useState<{ upcoming: LoadState; balance: LoadState }>({ upcoming: 'loading', balance: 'loading' });
  const [retrying, setRetrying] = useState(false);
  // Estado del Readiness de hoy: lo comunica la propia tarjeta del cuestionario (no se vuelve a consultar)
  const [readiness, setReadiness] = useState<ReadinessTodayStatus>('loading');
  const now = useNow();
  // Constancia y siguiente logro: consulta aparte; si tarda o falla no retiene ni afecta al resto de la pantalla
  const summary = useAchievementsSummary();
  // Un resultado tardío de una consulta anterior nunca pisa al de la más reciente
  const latest = useRef<Record<DashboardQuery, number>>({ upcoming: 0, balance: 0 });

  // Baja hasta una sección y la enfoca (teclado/lector); con «menos movimiento» no se anima
  const focusSection = useCallback((el: HTMLElement | null) => {
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  }, []);

  const run = useCallback(
    async (query: DashboardQuery) => {
      if (!userId) return;
      const id = ++latest.current[query];
      try {
        // Si el servidor no responde nunca, el bloque pasa a «error» con su «Reintentar» en vez de esperar sin fin
        if (query === 'upcoming') {
          const value = await withTimeout(appointmentService.getUpcoming());
          if (id !== latest.current.upcoming) return;
          setUpcoming(value);
        } else {
          const value = await withTimeout(clientPlanService.getBalance(userId));
          if (id !== latest.current.balance) return;
          setBalance(value);
        }
        setStates((prev) => ({ ...prev, [query]: 'ready' }));
      } catch {
        if (id !== latest.current[query]) return;
        setStates((prev) => ({ ...prev, [query]: 'error' }));
      }
    },
    [userId]
  );

  useEffect(() => {
    run('upcoming');
    run('balance');
  }, [run]);

  const retry = async () => {
    setRetrying(true);
    await Promise.all(queriesToRetry(states).map(run));
    setRetrying(false);
  };

  // Sin plan vigente se consultan sus planes (una sola vez) para decir si «venció», «todavía no empieza» o «nunca tuvo»
  const planHistory = usePlanHistory(userId, states.balance === 'ready' && balance !== null && !balance.hasActivePlan);

  // Desde el recordatorio ('?readiness=1') se baja directo al Readiness y se enfoca para teclado/lector, cuando ya tiene su forma final
  const wantsReadiness = searchParams.get('readiness') === '1';
  const readinessSettled = readiness !== 'loading' && states.balance !== 'loading';
  useEffect(() => {
    if (!readinessSettled || !wantsReadiness) return;
    focusSection(readinessRef.current);
  }, [readinessSettled, wantsReadiness, focusSection]);

  const planView = computePlanView({ balance, history: planHistory, now });
  const hero = computeHeroView({
    now,
    upcoming,
    upcomingState: states.upcoming,
    balance,
    balanceState: states.balance,
    planView,
    planPending: planHistory.pending,
  });

  // Constancia: solo existe con un plan mensual de entrenamiento con meta. Mientras carga se reserva su lugar; sin meta, «Mi plan» ocupa todo el ancho.
  const consistency = summary.status === 'ready' ? summary.view?.consistency ?? null : null;
  const hasPlan = !!balance?.hasActivePlan;
  // Quien viene por kinesiología sigue siempre su dolor
  const isKine = balance?.plan?.serviceType === 'kinesiologia';
  const showConstancy = hasPlan && (summary.status === 'loading' || !!consistency);
  // Sin plan vigente la tarjeta protagonista ya lo explica: «Mi plan» no repite el mensaje
  const myGoals = useMyGoals(user?.id, hasPlan);
  const showPlanCard = planView.kind !== 'inactive' || planIsWaiting(states, planHistory.pending);

  return (
    <div className="space-y-3">
      <header className="space-y-1 pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e4]/60">{todayLabel(now)}</p>
          {user?.isFounder && <FounderBadge tone="brand" />}
        </div>
        <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-[#fff8e4] sm:text-[2rem]">
          {greetingFor(now)}, {user?.firstName ?? ''}
        </h1>
      </header>

      {hasLoadError(states) && hero.kind !== 'error' && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar algunos datos.</span>
            <Button variant="outline" size="sm" onClick={retry} disabled={retrying}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {balance?.paymentPending && balance.paymentDueBy && <PaymentPendingBanner paymentDueBy={balance.paymentDueBy} />}

      <div className="space-y-3 lg:grid lg:grid-cols-[1.25fr_1fr] lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-3">
          {/* Entrenamiento en curso: con una sesión activa es lo PRIMERO que se ve y no se ofrece «Iniciar» otra vez */}
          <WorkoutEntryCard />

          {/* La pieza principal: una sola cosa importante según el estado real (reglas en dashboard/heroView.ts) */}
          <HeroSessionCard view={hero} planView={planView} onRetry={retry} retrying={retrying} />

          {/* Check-in de hoy: una fila compacta si está pendiente; el resultado completo si ya lo hizo */}
          <div id="readiness" ref={readinessRef} tabIndex={-1} role="region" className="scroll-mt-20 focus:outline-none" aria-label="Readiness de hoy">
            <WellnessCheckinCard compact hasActivePlan={!!balance?.hasActivePlan} planStatus={states.balance} onRetryPlan={retry} onStatusChange={setReadiness} />
          </div>
        </div>

        <div className="space-y-3">
          <div className={showPlanCard ? 'grid grid-cols-2 gap-3' : 'hidden'}>
            <PlanRingCard view={planView} loading={planIsWaiting(states, planHistory.pending)} wide={!showConstancy} />
            {showConstancy && <ConstancyRingCard consistency={consistency} loading={summary.status === 'loading'} />}
          </div>
          {user && hasPlan && <WeeklyCheckin userId={user.id} goals={myGoals.goals} catalog={myGoals.catalog} onSaved={myGoals.replace} />}
          {summary.status === 'error' && <LoadErrorAlert message="No pudimos cargar tu constancia y tus logros." onRetry={summary.retry} />}
          {summary.status === 'ready' && summary.view && <NextAchievementCard view={summary.view} />}
        </div>
      </div>

      {user && <GoalsPrompt userId={user.id} enabled={hasPlan} loaded={myGoals.loaded} goalCount={myGoals.goals.length} painRequired={isKine && !myGoals.goals.some((g) => g.categoryId === 'pain' && (g.status === 'active' || g.status === 'pending_validation'))} />}

      <QuickActions hide={hero.kind === 'session' ? ['/app/mis-citas'] : hero.kind === 'book' ? ['/app/reservar'] : []} />
    </div>
  );
};

export default PatientDashboard;
