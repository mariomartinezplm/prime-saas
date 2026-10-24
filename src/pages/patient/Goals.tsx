import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import PageTitle from '@/components/premium/PageTitle';
import EmptyGuide from '@/components/premium/EmptyGuide';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import { BTN_FILL, CARD } from '@/components/dashboard/brand';
import GoalCard, { StatusPill } from '@/components/goals/GoalCard';
import GoalIcon from '@/components/goals/GoalIcon';
import CheckinSheet from '@/components/goals/CheckinSheet';
import TargetSheet from '@/components/goals/TargetSheet';
import WeeklyCheckin from '@/components/goals/WeeklyCheckin';
import { goalService, type GoalCatalog, type GoalSources, type GoalView, type IndicatorProgress } from '@/services/goalService';
import { activeGoals, paramsText } from '@/lib/goals';
import { notify } from '@/lib/notify';
import { showApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

// «Mis objetivos PRIME»: máximo tres objetivos activos (uno principal y dos secundarios), cada uno seguido con los registros
// que ya existen. Los pausados y conseguidos quedan abajo, con su historial.
const Goals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [sources, setSources] = useState<GoalSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [checkin, setCheckin] = useState<{ goal: GoalView; indicator: IndicatorProgress } | null>(null);
  const [targetGoal, setTargetGoal] = useState<GoalView | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    try {
      const [g, c] = await Promise.all([goalService.list(user.id), goalService.getCatalog()]);
      setGoals(g);
      setCatalog(c);
      goalService.sources(user.id).then(setSources).catch(() => setSources(null)); // solo mejora los nombres; no bloquea la pantalla
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const category = (goal: GoalView) => catalog?.categories.find((c) => c.id === goal.categoryId);
  const active = useMemo(() => activeGoals(goals), [goals]);
  const closed = useMemo(() => goals.filter((g) => g.status === 'paused' || g.status === 'achieved').sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [goals]);
  const replace = (updated: GoalView) => setGoals((list) => list.map((g) => (g.id === updated.id ? updated : g)));

  const act = async (goal: GoalView, action: 'pause' | 'resume' | 'make_primary') => {
    try {
      replace(await goalService.act(goal.id, { action }));
      notify.success(action === 'pause' ? 'Objetivo en pausa: tu progreso se conserva' : action === 'make_primary' ? 'Ahora es tu objetivo principal' : 'Objetivo reanudado');
      if (action !== 'pause') load();
    } catch (err) {
      showApiError(err, 'No se pudo cambiar el objetivo');
      if (action === 'resume') notify.info('Si ya tienes 3 objetivos activos, pausa uno para reanudar este.');
    }
  };

  if (loading) {
    return (
      <PageSkeleton label="Cargando tus objetivos…">
        <CardsSkeleton count={2} bodyHeight="h-48" />
      </PageSkeleton>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
      <PageTitle eyebrow="Mis objetivos PRIME" title="Lo que quieres lograr" description="Elige qué quieres mejorar. Seguimos tu avance con los registros que ya tienes en PRIME." serif />

      {failed && <LoadErrorAlert message="No se pudieron cargar tus objetivos." onRetry={load} />}

      {!failed && active.length === 0 && closed.length === 0 && (
        <EmptyGuide
          icon={Target}
          title="¿Qué te gustaría mejorar?"
          description="Elige uno a tres objetivos, como aumentar tu fuerza, bajar tu dolor o ganar movilidad. Los seguimos con tus mediciones y ejercicios."
          action={<Button asChild className={cn('min-h-[52px] rounded-2xl text-base font-bold', BTN_FILL)}><Link to="/app/objetivos/nuevo">Elegir mi primer objetivo</Link></Button>}
          preview={[
            { icon: Target, title: 'Tu punto de partida real', text: 'Usamos tus registros: no tienes que medir de nuevo.' },
            { icon: Plus, title: 'Un principal y dos secundarios', text: 'Hasta tres objetivos a la vez, para enfocarte.' },
          ]}
        />
      )}

      {user && !failed && <WeeklyCheckin userId={user.id} goals={goals} catalog={catalog} onSaved={replace} />}

      {active.map((goal, i) => (
        <GoalCard key={goal.id} goal={goal} category={category(goal)} sources={sources} variant={i === 0 && goal.slot === 1 ? 'primary' : 'secondary'} onCheckin={(g, ind) => setCheckin({ goal: g, indicator: ind })} onSetTarget={setTargetGoal} onPause={(g) => act(g, 'pause')} onMakePrimary={(g) => act(g, 'make_primary')} />
      ))}

      {!failed && catalog && (active.length > 0 || closed.length > 0) && (
        active.length < catalog.maxActiveGoals ? (
          <Button asChild className={cn('min-h-[52px] w-full rounded-2xl text-base font-bold', BTN_FILL)}>
            <Link to="/app/objetivos/nuevo"><Plus aria-hidden="true" />Agregar un objetivo</Link>
          </Button>
        ) : (
          <p className={cn(CARD, 'p-4 text-[14px] text-[#cdc6b6]')}>Tienes tus {catalog.maxActiveGoals} objetivos activos. Para agregar otro, pausa uno: su progreso se conserva.</p>
        )
      )}

      {closed.length > 0 && (
        <section aria-label="Objetivos pausados y conseguidos" className="space-y-2">
          <button type="button" aria-expanded={showClosed} onClick={() => setShowClosed((v) => !v)} className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-1 text-left text-lg font-bold tracking-tight text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
            Pausados y conseguidos ({closed.length})
            <ChevronDown aria-hidden="true" className={cn('h-5 w-5 text-[#a8a295] transition-transform motion-reduce:transition-none', showClosed && 'rotate-180')} />
          </button>
          {showClosed && (
            <ul className="space-y-2">
              {closed.map((g) => (
                <li key={g.id} className={cn(CARD, 'flex items-center justify-between gap-3 p-3.5')}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#fff8e4]/15 text-[#cdc6b6]"><GoalIcon name={g.icon} className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold text-[#fff8e4]">{paramsText(g.progress.indicators[0], category(g), sources) || g.categoryName}</p>
                      <div className="mt-0.5"><StatusPill goal={g} /></div>
                    </div>
                  </div>
                  {g.status === 'paused' && <Button type="button" variant="outline" onClick={() => act(g, 'resume')} className="min-h-[44px] shrink-0 rounded-xl border-[#398ca2] bg-transparent text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">Reanudar</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {targetGoal && <TargetSheet goal={targetGoal} category={category(targetGoal)} mode="update_target" onClose={() => setTargetGoal(null)} onSaved={replace} />}

      {checkin && (
        <CheckinSheet goal={checkin.goal} indicator={checkin.indicator} category={category(checkin.goal)} onClose={() => setCheckin(null)} onSaved={replace} />
      )}
    </div>
  );
};

export default Goals;
