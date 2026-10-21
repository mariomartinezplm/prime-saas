import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Medal, TriangleAlert, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import ExerciseForm from '@/components/forms/ExerciseForm';
import PatientRecordDialog from '@/components/forms/PatientRecordDialog';
import RecordRowActions from '@/components/records/RecordRowActions';
import PageTitle from '@/components/premium/PageTitle';
import SegmentedTabs from '@/components/premium/SegmentedTabs';
import MetricTile from '@/components/premium/MetricTile';
import TrendChart from '@/components/premium/TrendChart';
import EmptyGuide from '@/components/premium/EmptyGuide';
import MetricDetailDrawer from '@/components/premium/MetricDetailDrawer';
import { CARD, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import { exercisesByFrequency, isRehabExercise, lastSessionText, sessionDays, totalVolumeTons, volumeComparison, weightSeries } from '@/lib/exerciseSeries';
import { formatValue, longDate, shortDate, summarize } from '@/lib/trend';
import { cn } from '@/lib/utils';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import api from '@/lib/api';
import type { ExerciseProgress } from '@/types';

const ExercisesPage = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<ExerciseProgress | null>(null);
  const [tab, setTab] = useState('progreso');
  const [heroName, setHeroName] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const hasActivePlan = useHasActivePlan(user?.id);
  const canEdit = hasActivePlan === true;

  useEffect(() => {
    if (!user) return;
    setFailed(false);
    api
      .get(`/exercises/patient/${user.id}`)
      .then((res) => setExercises(res.data.data.exercises || []))
      // Si falla la carga se avisa: antes se mostraba como si no hubiera ejercicios
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  const retry = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (ex: ExerciseProgress) => {
    try {
      await api.delete(`/exercises/${ex._id}`);
      notify.success('Ejercicio eliminado');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar el ejercicio');
      throw err;
    }
  };

  const names = useMemo(() => exercisesByFrequency(exercises), [exercises]);
  const byName = useMemo(() => {
    const map = new Map<string, ExerciseProgress[]>();
    exercises.forEach((e) => map.set(e.exerciseName, [...(map.get(e.exerciseName) ?? []), e]));
    return map;
  }, [exercises]);
  // Solo los ejercicios con peso registrado tienen progresión de carga
  const withLoad = names.filter((n) => weightSeries(byName.get(n) ?? []).length > 0);
  const hero = withLoad.includes(heroName ?? '') ? (heroName as string) : withLoad[0];
  const heroPoints = hero ? weightSeries(byName.get(hero) ?? []) : [];
  const heroUnit = hero ? byName.get(hero)?.find((e) => e.weightUnit)?.weightUnit ?? 'kg' : 'kg';
  const heroSummary = hero ? summarize(heroPoints, heroUnit, 1) : null;
  const heroBest = heroPoints.length > 0 ? Math.max(...heroPoints.map((p) => p.value)) : null;
  const heroLast = hero ? [...(byName.get(hero) ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const volume = totalVolumeTons(exercises);
  const days = sessionDays(exercises);
  const comparison = volumeComparison(exercises);
  const heroRehab = hero ? isRehabExercise(byName.get(hero) ?? []) : false;
  const unitOf = (name: string) => byName.get(name)?.find((e) => e.weightUnit)?.weightUnit ?? 'kg';

  const registerButton = (
    <PatientRecordDialog label="Registrar ejercicio" title="Registrar ejercicio" description="Anota el ejercicio, el peso y las repeticiones que hiciste.">
      {(close) => (
        <ExerciseForm
          patientId={user!.id}
          embedded
          onSuccess={() => {
            close();
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </PatientRecordDialog>
  );

  if (loading) {
    return (
      <PageSkeleton label="Cargando tus ejercicios…">
        <CardsSkeleton count={2} bodyHeight="h-56" />
      </PageSkeleton>
    );
  }

  const historyRows = (filter === 'all' ? exercises : exercises.filter((e) => e.exerciseName === filter)).slice().sort((a, b) => b.date.localeCompare(a.date));
  // El historial se agrupa por día: cada día es una sesión con sus ejercicios
  const groupedHistory = Object.entries(
    historyRows.reduce<Record<string, ExerciseProgress[]>>((acc, ex) => {
      const day = ex.date.slice(0, 10);
      (acc[day] ??= []).push(ex);
      return acc;
    }, {})
  ).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle
        eyebrow="Ejercicios"
        title={<>Tu fuerza,<br />tu progreso</>}
        description={exercises.length > 0 ? 'Sigue cómo evolucionan tus ejercicios y tus marcas, sesión a sesión.' : undefined}
        actions={exercises.length > 0 ? registerButton : undefined}
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar tus ejercicios.</span>
            <Button variant="outline" size="sm" onClick={retry}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {exercises.length === 0 && !failed ? (
        <EmptyGuide
          icon={Dumbbell}
          title="Tu primera marca está por llegar"
          description="Aquí verás cómo evoluciona la carga de cada ejercicio. Tu kinesiólogo los registra en tus sesiones y, con tu plan activo, tú también puedes anotarlos."
          action={
            <div className="flex w-full flex-col gap-2">
              {registerButton}
              <Button asChild variant="outline" className="min-h-[44px] rounded-2xl border-[#fff8e4]/20 text-[#fff8e4] hover:bg-[#fff8e4]/[0.06] hover:text-[#fff8e4]">
                <Link to="/app/mis-citas">Ver mis citas</Link>
              </Button>
            </div>
          }
          preview={[
            { icon: TrendingUp, title: 'Progresión de carga', text: 'Cada ejercicio con su gráfico por fecha' },
            { icon: Medal, title: 'Tus mejores marcas', text: 'El mayor peso que has levantado' },
            { icon: Dumbbell, title: 'Historial', text: 'Series, repeticiones y peso de cada sesión' },
          ]}
        />
      ) : (
        <SegmentedTabs
          ariaLabel="Qué quieres ver"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'progreso', label: 'Progreso' },
            { value: 'historial', label: 'Historial' },
          ]}
        >
          {[
            <div key="progreso" className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(CARD, 'p-4')}>
                  <p className="text-[13px] text-[#fff8e4]/70">Sesiones registradas</p>
                  <p className="mt-1.5 text-[1.75rem] font-extrabold leading-none tabular-nums text-[#fff8e4]">{days}</p>
                  <p className="mt-1.5 text-[12.5px] text-[#fff8e4]/65">En tu historial</p>
                </div>
                <div className={cn(CARD, 'p-4')}>
                  <p className="text-[13px] text-[#fff8e4]/70">Ejercicios distintos</p>
                  <p className="mt-1.5 text-[1.75rem] font-extrabold leading-none tabular-nums text-[#fff8e4]">{names.length}</p>
                  <p className="mt-1.5 text-[12.5px] text-[#fff8e4]/65">Con seguimiento</p>
                </div>
              </div>
              {hero && heroSummary ? (
                <section aria-label={hero} className={cn('rounded-[24px] border p-4 pb-3 min-[375px]:p-5 min-[375px]:pb-4', HERO_SURFACE)}>
                  <p className={cn(EYEBROW_SOFT, 'text-[#7cc0d2]')}>{heroRehab ? 'Ejercicio de rehabilitación' : 'Ejercicio destacado'}</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-[#fff8e4]">{hero}</h2>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-[3.75rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#fff8e4]">
                      {formatValue(heroSummary.last.value, 1)}
                      <span className="ml-1.5 text-xl font-bold text-[#fff8e4]/65">{heroUnit}</span>
                    </p>
                    {heroSummary.count > 1 && <span className="mb-1 shrink-0 rounded-full border border-[#fff8e4]/20 bg-[#fff8e4]/[0.06] px-3 py-1 text-[13px] font-semibold text-[#fff8e4]">{heroSummary.changeText}</span>}
                  </div>
                  <p className="mt-1.5 text-sm text-[#fff8e4]/72">
                    {heroLast ? `Última sesión · ${lastSessionText(byName.get(hero!) ?? []) ?? ''}` : 'Último registro'}
                    {!heroRehab && heroBest !== null && heroSummary.count > 1 ? ` · mejor marca ${formatValue(heroBest, 1)} ${heroUnit}` : ''}
                  </p>
                  {heroSummary.count > 1 ? (
                    <div className="-mx-1 mt-3">
                      <TrendChart points={heroPoints} unit={heroUnit} decimals={1} label={`Carga de ${hero}`} height={170} />
                    </div>
                  ) : (
                    <p className="my-3 rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-3 text-sm text-[#fff8e4]/75">Con un segundo registro de este ejercicio verás aquí tu progresión.</p>
                  )}
                  <p className="px-1 text-xs text-[#fff8e4]/62">{heroSummary.count} {heroSummary.count === 1 ? 'día con registro' : 'días con registro'} · {heroSummary.sinceText}</p>
                  {heroRehab && <p className="mx-1 mt-2 rounded-xl border border-[#398ca2]/30 bg-[#398ca2]/10 px-3 py-2 text-[12.5px] text-[#fff8e4]/80">En rehabilitación, la carga la define tu kinesiólogo: subir el peso no siempre es el objetivo.</p>}
                  {withLoad.length > 1 && (
                    <div role="group" aria-label="Elegir ejercicio" className="mt-3 flex flex-wrap gap-2 border-t border-[#fff8e4]/10 pt-3">
                      {withLoad.slice(0, 6).map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={n === hero}
                          onClick={() => setHeroName(n)}
                          className={cn(
                            'min-h-[40px] max-w-full truncate rounded-full border px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
                            n === hero ? 'border-[#398ca2] bg-[#398ca2]/25 text-[#fff8e4]' : 'border-[#fff8e4]/15 text-[#fff8e4]/70'
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <EmptyGuide icon={TrendingUp} title="Aún no hay cargas registradas" description="Tus ejercicios están registrados, pero sin peso. Cuando se anote el peso de cada uno, verás aquí su progresión." />
              )}

              {withLoad.length > 0 && (
                <section aria-labelledby="ej-title" className="space-y-3">
                  <h2 id="ej-title" className="px-1 text-lg font-bold tracking-tight text-[#fff8e4]">Tus ejercicios</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {withLoad.map((n) => {
                      const pts = weightSeries(byName.get(n) ?? []);
                      const u = unitOf(n);
                      const s = summarize(pts, u, 1)!;
                      return (
                        <MetricTile
                          key={n}
                          label={n}
                          value={formatValue(s.last.value, Number.isInteger(s.last.value) ? 0 : 1)}
                          unit={u}
                          values={pts.map((p) => p.value)}
                          caption={s.count > 1 ? `${s.changeText} ${s.sinceText}` : 'Primer registro'}
                          ariaLabel={`${n}: ${formatValue(s.last.value, 1)} ${u}. ${s.count > 1 ? `${s.changeText} ${s.sinceText}.` : 'Primer registro.'} Ver detalle`}
                          onClick={() => setDetail(n)}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {comparison && (
                <section aria-labelledby="vol-title" className={cn(CARD, 'p-4')}>
                  <h2 id="vol-title" className="text-[15px] font-semibold text-[#fff8e4]">Volumen de entrenamiento</h2>
                  <p className="mt-0.5 text-[12.5px] text-[#fff8e4]/65">Series × repeticiones × peso, sin contar la rehabilitación</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[12.5px] text-[#fff8e4]/70">Últimos 30 días</p>
                      <p className="text-2xl font-extrabold tabular-nums text-[#fff8e4]">{formatValue(comparison.current, 1)}<span className="ml-1 text-sm font-semibold text-[#fff8e4]/65">ton</span></p>
                    </div>
                    <div>
                      <p className="text-[12.5px] text-[#fff8e4]/70">30 días anteriores</p>
                      <p className="text-2xl font-extrabold tabular-nums text-[#fff8e4]/80">{formatValue(comparison.previous, 1)}<span className="ml-1 text-sm font-semibold text-[#fff8e4]/60">ton</span></p>
                    </div>
                  </div>
                </section>
              )}
            </div>,

            <div key="historial" className="space-y-3">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger aria-label="Filtrar por ejercicio" className="min-h-[48px] rounded-2xl border-[#fff8e4]/15 bg-[#fff8e4]/[0.04] text-[#fff8e4]">
                  <SelectValue placeholder="Filtrar ejercicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los ejercicios</SelectItem>
                  {names.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {historyRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-6 text-center text-sm text-[#fff8e4]/70">No hay ejercicios para mostrar.</p>
              ) : (
                <div className="space-y-4">
                  {groupedHistory.map(([day, rows]) => (
                    <section key={day} aria-label={longDate(day)} className="space-y-1.5">
                      <h3 className="px-1 text-[13px] font-semibold text-[#fff8e4]/72">{longDate(day)}</h3>
                      <ul className={cn(CARD, 'divide-y divide-[#fff8e4]/10 px-4')}>
                        {rows.map((ex) => (
                          <li key={ex._id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold text-[#fff8e4]">{ex.exerciseName}</p>
                              <p className="text-[13px] text-[#fff8e4]/70">
                                {ex.category === 'rehabilitacion' ? 'Rehabilitación' : 'Entrenamiento'}
                                {ex.rpe ? ` · esfuerzo ${ex.rpe}/10` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <p className="text-right text-[15px] font-bold tabular-nums text-[#fff8e4]">
                                {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ''}
                                {ex.weight ? <span className="block text-[13px] font-semibold text-[#7cc0d2]">{ex.weight} {ex.weightUnit}</span> : null}
                              </p>
                              {canEdit && <RecordRowActions itemLabel="este ejercicio" onEdit={() => setEditing(ex)} onDelete={() => handleDelete(ex)} />}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>,
          ]}
        </SegmentedTabs>
      )}

      {detail && <MetricDetailDrawer open onOpenChange={(open) => !open && setDetail(null)} label={detail} unit={unitOf(detail)} decimals={1} points={weightSeries(byName.get(detail) ?? [])} />}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir ejercicio</DialogTitle>
            <DialogDescription>Un campo que dejes vacío se borra del registro.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ExerciseForm
              key={editing._id}
              patientId={user!.id}
              record={editing}
              embedded
              onSuccess={() => {
                setEditing(null);
                setRefreshKey((k) => k + 1);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExercisesPage;
