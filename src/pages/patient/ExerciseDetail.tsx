import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Calendar, Check, ChevronLeft, Plus, TrendingUp, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import EmptyGuide from '@/components/premium/EmptyGuide';
import SegmentedTabs from '@/components/premium/SegmentedTabs';
import ExerciseChart from '@/components/workout/ExerciseChart';
import { CARD, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import { bestMark, defaultLoad, filterPeriod, insights, formatNumber, groupExercises, loadOptions, metricLabel, primaryMetric, progressPoints, repsAtLoadPoints, sessionHistory, setLabel, topLoads, type Period, type ProgressRecord } from '@/lib/exerciseProgress';
import { longDate } from '@/lib/trend';
import { cn } from '@/lib/utils';

const PERIODS: { value: Period; label: string }[] = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'all', label: 'Todo' },
];
const WORD = { load: 'Carga máxima', reps: 'Más repeticiones', time: 'Mayor duración' } as const;

// Evolución de UN ejercicio, con los mismos registros que usa la pantalla Ejercicios (incluidos los del entrenamiento en curso).
const ExerciseDetail = () => {
  const { key = '' } = useParams();
  const { user } = useAuth();
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<Period>('90');
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<string | null>(null);
  const [pickedLoad, setPickedLoad] = useState<number | null>(null);
  const [allLoads, setAllLoads] = useState(false);

  const load = () => {
    if (!user) return;
    setFailed(false);
    setLoading(true);
    api
      .get(`/exercises/patient/${user.id}`, { params: { limit: 2000 } })
      .then((res) => setRecords(res.data.data.exercises || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [user]);

  const group = useMemo(() => groupExercises(records).find((g) => g.key === decodeURIComponent(key)), [records, key]);
  const metric = group ? primaryMetric(group.records) : null;
  const all = useMemo(() => (group && metric ? progressPoints(group.records, metric) : []), [group, metric]);
  const shown = useMemo(() => filterPeriod(all, period), [all, period]);
  const best = bestMark(all);
  const history = useMemo(() => (group ? sessionHistory(group.records) : []), [group]);
  const loads = useMemo(() => (group ? loadOptions(group.records) : []), [group]);
  const selectedLoad = pickedLoad !== null && loads.some((l) => l.weight === pickedLoad) ? pickedLoad : group ? defaultLoad(group.records) : null;
  const repsAll = useMemo(() => (group && selectedLoad !== null ? repsAtLoadPoints(group.records, selectedLoad) : []), [group, selectedLoad]);
  const repsShown = useMemo(() => filterPeriod(repsAll, period), [repsAll, period]);
  const repsBest = bestMark(repsAll);
  const lbsCount = group ? group.records.filter((r) => (r.weightUnit ?? 'kg') !== 'kg' && r.weight).length : 0;
  const last = all[all.length - 1];
  const first = all[0];
  const read = insights(all);
  const gain = last && first && all.length > 1 ? last.value - first.value : null;

  if (loading) {
    return (
      <PageSkeleton label="Cargando el ejercicio…">
        <CardsSkeleton count={2} bodyHeight="h-40" />
      </PageSkeleton>
    );
  }
  if (failed) return <LoadErrorAlert message="No se pudo cargar el ejercicio." onRetry={load} />;
  if (!group) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link to="/app/ejercicios" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-[#8fd0e0]"><ChevronLeft className="h-5 w-5" aria-hidden="true" />Ejercicios</Link>
        <EmptyGuide icon={Trophy} title="No encontramos este ejercicio" description="Puede que todavía no tenga registros. Vuelve a Ejercicios para ver los que ya guardaste." />
      </div>
    );
  }
  const labels = metric ? metricLabel[metric] : null;

  const periodToggle = (
    <div role="group" aria-label="Período" className="flex overflow-hidden rounded-[12px] border border-[#fff8e4]/20">
      {PERIODS.map((p) => (
        <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)} className={cn('min-h-[44px] min-w-[64px] px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]', period === p.value ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}>
          {p.label}
        </button>
      ))}
    </div>
  );
  const emptyPeriod = <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 p-4 text-center text-sm text-[#a8a295]">No hay registros en los últimos {period} días. Prueba con «Todo» para ver tu historial completo.</p>;

  const mainChartPanel = labels && metric ? (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-[#fff8e4]">{labels.title} <span className="font-semibold text-[#a8a295]">({labels.axis})</span></h2>
        {periodToggle}
      </div>
      {shown.length > 0 ? <ExerciseChart points={shown} metric={metric} name={group?.name ?? ''} /> : emptyPeriod}
      {all.length === 1 && <p className="text-[12.5px] text-[#a8a295]">Con un segundo registro de este ejercicio verás aquí tu evolución.</p>}
    </>
  ) : null;

  const repsPanel = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-[#fff8e4]">Repeticiones con la misma carga</h2>
        {periodToggle}
      </div>
      {loads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 p-4 text-center text-sm text-[#a8a295]">Para ver tus repeticiones por carga, registra una serie con peso (en kg) y repeticiones.</p>
      ) : (
        <>
          <div role="group" aria-label="Carga a comparar" className="flex flex-wrap gap-2">
            {(allLoads ? loads : topLoads(loads, selectedLoad)).map((l) => (
              <button key={l.weight} type="button" aria-pressed={selectedLoad === l.weight} onClick={() => setPickedLoad(l.weight)} className={cn('min-h-[44px] rounded-full border px-4 text-[14px] font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', selectedLoad === l.weight ? 'border-[#398ca2] bg-[#398ca2] font-extrabold text-[#181619]' : 'border-[#fff8e4]/20 text-[#cdc6b6]')}>
                {formatNumber(l.weight)} kg
              </button>
            ))}
            {loads.length > 6 && (
              <button type="button" onClick={() => setAllLoads((v) => !v)} className="min-h-[44px] rounded-full px-3 text-[14px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                {allLoads ? 'Ver menos' : `Ver las ${loads.length} cargas`}
              </button>
            )}
          </div>
          <p className="text-[12.5px] text-[#a8a295]">Solo se comparan series hechas con {selectedLoad !== null ? `${formatNumber(selectedLoad)} kg` : 'la misma carga'}: cada carga se ve por separado.</p>
          {repsBest && selectedLoad !== null && (
            <p className="text-[14px] text-[#cdc6b6]">Tu mejor serie con {formatNumber(selectedLoad)} kg: <b className="text-[#fff8e4]">{formatNumber(repsBest.value)} repeticiones</b> · {longDate(repsBest.date)}</p>
          )}
          {repsShown.length > 0 ? <ExerciseChart points={repsShown} metric="reps" name={`${group?.name ?? ''} con ${selectedLoad !== null ? formatNumber(selectedLoad) : ''} kg`} /> : emptyPeriod}
          {repsAll.length === 1 && <p className="text-[12.5px] text-[#a8a295]">Con una segunda sesión con esta carga verás aquí tu evolución.</p>}
        </>
      )}
    </>
  );

  const historyPanel = (
    <>
      <h2 className="text-[15px] font-bold text-[#fff8e4]">Historial de sesiones</h2>
      <ul className="divide-y divide-[#fff8e4]/10 overflow-hidden rounded-2xl border border-[#fff8e4]/10">
        {(showAll ? history : history.slice(0, 5)).map((x) => (
          <li key={x.date} className="px-4 py-3">
            <p className="text-[13px] font-semibold text-[#cdc6b6]">{longDate(x.date)} · {x.sets.length} {x.sets.length === 1 ? 'serie' : 'series'}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {x.sets.map((st, i) => (
                <li key={i} className="rounded-full border border-[#62b8cf]/30 bg-[#398ca2]/12 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-[#fff8e4]">{setLabel(st)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {history.length > 5 && (
        <Button variant="ghost" onClick={() => setShowAll((v) => !v)} className="min-h-[48px] w-full text-[#8fd0e0] hover:bg-[#fff8e4]/[0.06] hover:text-[#8fd0e0]">
          {showAll ? 'Ver menos' : `Ver los ${history.length} días registrados`}
        </Button>
      )}
    </>
  );

  // Pestañas según cómo se mide el ejercicio: con peso → Carga | Repeticiones | Historial; sin peso → su métrica | Historial
  const tabItems = [
    ...(metric === 'load' ? [{ value: 'carga', label: 'Carga' }, { value: 'reps-carga', label: 'Repeticiones' }] : []),
    ...(metric === 'reps' ? [{ value: 'principal', label: 'Repeticiones' }] : []),
    ...(metric === 'time' ? [{ value: 'principal', label: 'Duración' }] : []),
    { value: 'historial', label: 'Historial' },
  ];
  const activeTab = tab && tabItems.some((t) => t.value === tab) ? tab : tabItems[0].value;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      <Link to="/app/ejercicios" className="inline-flex min-h-[44px] items-center gap-1 rounded-xl text-[15px] font-semibold text-[#8fd0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]"><ChevronLeft className="h-5 w-5" aria-hidden="true" />Ejercicios</Link>
      <header className="space-y-1">
        <p className={EYEBROW_SOFT}>Evolución del ejercicio</p>
        <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-[#fff8e4] sm:text-[2rem]">{group.name}</h1>
      </header>

      {best && labels ? (
        <>
          <section aria-label="Resumen" className={cn('grid grid-cols-2 gap-3 rounded-[24px] border p-4', HERO_SURFACE)}>
            <div>
              <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#8fd0e0]"><Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Mejor marca</p>
              <p className="mt-1.5 text-[2.6rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#fff8e4]">{formatNumber(best.value)}<span className="ml-1 text-base font-bold text-[#cdc6b6]">{labels.unit}</span></p>
              <p className="mt-1 text-[12.5px] text-[#cdc6b6]">{best.reps ? `× ${best.reps} rep · ` : ''}{longDate(best.date)}</p>
            </div>
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#a8a295]">Última sesión</p>
              <p className="mt-1.5 text-[2.6rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-[#fff8e4]">{formatNumber(last.value)}<span className="ml-1 text-base font-bold text-[#cdc6b6]">{labels.unit}</span></p>
              <p className="mt-1 text-[12.5px] text-[#cdc6b6]">{last.reps ? `× ${last.reps} rep · ` : ''}{longDate(last.date)}</p>
            </div>
            {gain !== null && <p className="col-span-2 border-t border-[#fff8e4]/10 pt-2.5 text-[13px] text-[#cdc6b6]">{gain === 0 ? 'Sin cambios' : `${gain > 0 ? '+' : '−'}${formatNumber(Math.abs(gain))} ${labels.unit}`} desde tu primer registro ({longDate(first.date)}).</p>}
          </section>

          <section aria-label="Lectura de tu progreso" className={cn(CARD, 'space-y-2 p-4')}>
            <h2 className="text-[15px] font-bold text-[#fff8e4]">Tu progreso, en simple</h2>
            <ul className="space-y-2 text-[14px] text-[#cdc6b6]">
              <li className="flex items-start gap-2.5"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" aria-hidden="true" /><span><b className="text-[#fff8e4]">Mejor marca actual:</b> {formatNumber(best.value)} {labels.unit}{best.reps ? ` × ${best.reps} rep` : ''}</span></li>
              <li className="flex items-start gap-2.5"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" aria-hidden="true" /><span><b className="text-[#fff8e4]">Última vez:</b> {formatNumber(last.value)} {labels.unit}{last.reps ? ` × ${last.reps} rep` : ''}
                {read.changeFromPrevious !== null && (read.changeFromPrevious === 0 ? ' · igual que la sesión anterior' : ` · ${read.changeFromPrevious > 0 ? '+' : '−'}${formatNumber(Math.abs(read.changeFromPrevious))} ${labels.unit} respecto a la sesión anterior`)}</span></li>
              {read.improvedOverPreviousBest !== null && <li className="flex items-start gap-2.5"><ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" aria-hidden="true" /><span>Has mejorado <b className="text-[#fff8e4]">{formatNumber(read.improvedOverPreviousBest)} {labels.unit}</b> desde tu mejor registro anterior.</span></li>}
              {read.improvedOverPreviousBest === null && read.tie && <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" aria-hidden="true" /><span>Igualaste tu mejor registro anterior.</span></li>}
              <li className="flex items-start gap-2.5"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#8fd0e0]" aria-hidden="true" /><span>Llevas <b className="text-[#fff8e4]">{read.sessions} {read.sessions === 1 ? 'sesión' : 'sesiones'}</b> registrando este ejercicio.</span></li>
            </ul>
          </section>

          <section aria-label="Evolución" className={cn(CARD, 'p-4')}>
            <SegmentedTabs ariaLabel="Qué quieres ver de este ejercicio" value={activeTab} onValueChange={setTab} items={tabItems}>
              {tabItems.map((t) => (
                <div key={t.value} className="space-y-3">
                  {t.value === 'historial' ? historyPanel : t.value === 'reps-carga' ? repsPanel : mainChartPanel}
                </div>
              ))}
            </SegmentedTabs>
            {lbsCount > 0 && <p className="mt-3 text-[12.5px] text-[#a8a295]">{lbsCount} {lbsCount === 1 ? 'registro está' : 'registros están'} en libras: se ven en el historial, pero no se mezclan con los kilos del gráfico.</p>}
          </section>
        </>
      ) : (
        <EmptyGuide icon={Trophy} title="Todavía no hay datos para graficar" description="Este ejercicio está registrado, pero sin carga, repeticiones ni tiempo. Cuando guardes una serie completa verás aquí su evolución." />
      )}

      <Button asChild className="min-h-[52px] w-full rounded-2xl border-[#398ca2] bg-[#398ca2] text-base font-bold text-[#181619] hover:bg-[#398ca2]/90">
        <Link to="/app/entrenamiento"><Plus aria-hidden="true" />Registrar en un entrenamiento</Link>
      </Button>
    </div>
  );
};

export default ExerciseDetail;
