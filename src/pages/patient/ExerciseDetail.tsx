import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import EmptyGuide from '@/components/premium/EmptyGuide';
import SegmentedTabs from '@/components/premium/SegmentedTabs';
import ExerciseChart from '@/components/workout/ExerciseChart';
import { CARD, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import { bestMark, filterPeriod, formatNumber, groupExercises, metricLabel, primaryMetric, progressPoints, sessionHistory, setLabel, type Period, type ProgressRecord } from '@/lib/exerciseProgress';
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
  const lbsCount = group ? group.records.filter((r) => (r.weightUnit ?? 'kg') !== 'kg' && r.weight).length : 0;
  const last = all[all.length - 1];
  const first = all[0];
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

          <section aria-label="Gráfico" className={cn(CARD, 'p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-[#fff8e4]">{labels.title} <span className="font-semibold text-[#a8a295]">({labels.axis})</span></h2>
              <div role="group" aria-label="Período" className="flex overflow-hidden rounded-[12px] border border-[#fff8e4]/20">
                {PERIODS.map((p) => (
                  <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)} className={cn('min-h-[44px] min-w-[64px] px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]', period === p.value ? 'bg-[#398ca2] font-extrabold text-[#181619]' : 'text-[#cdc6b6]')}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              {shown.length > 0 ? (
                <ExerciseChart points={shown} metric={metric!} name={group.name} />
              ) : (
                <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 p-4 text-center text-sm text-[#a8a295]">No hay registros en los últimos {period} días. Prueba con «Todo» para ver tu historial completo.</p>
              )}
            </div>
            {all.length === 1 && <p className="mt-2 text-[12.5px] text-[#a8a295]">Con un segundo registro de este ejercicio verás aquí tu evolución.</p>}
            {lbsCount > 0 && <p className="mt-2 text-[12.5px] text-[#a8a295]">{lbsCount} {lbsCount === 1 ? 'registro está' : 'registros están'} en libras: se ven en el historial, pero no se mezclan con los kilos del gráfico.</p>}
          </section>
        </>
      ) : (
        <EmptyGuide icon={Trophy} title="Todavía no hay datos para graficar" description="Este ejercicio está registrado, pero sin carga, repeticiones ni tiempo. Cuando guardes una serie completa verás aquí su evolución." />
      )}

      <section aria-labelledby="historial" className="space-y-2">
        <h2 id="historial" className="px-1 text-lg font-bold tracking-tight text-[#fff8e4]">Historial de sesiones</h2>
        <ul className={cn(CARD, 'divide-y divide-[#fff8e4]/10 overflow-hidden')}>
          {(showAll ? history : history.slice(0, 5)).map((s) => (
            <li key={s.date} className="px-4 py-3">
              <p className="text-[13px] font-semibold text-[#cdc6b6]">{longDate(s.date)} · {s.sets.length} {s.sets.length === 1 ? 'serie' : 'series'}</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {s.sets.map((x, i) => (
                  <li key={i} className="rounded-full border border-[#62b8cf]/30 bg-[#398ca2]/12 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-[#fff8e4]">{setLabel(x)}</li>
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
      </section>

      <Button asChild className="min-h-[52px] w-full rounded-2xl border-[#398ca2] bg-[#398ca2] text-base font-bold text-[#181619] hover:bg-[#398ca2]/90">
        <Link to="/app/entrenamiento"><Plus aria-hidden="true" />Registrar en un entrenamiento</Link>
      </Button>
    </div>
  );
};

export default ExerciseDetail;
