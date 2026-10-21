import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { achievementApi, type MonthlySummary as Summary } from '@/services/achievementService';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import { formatDay } from '@/components/achievements/format';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, ListSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import PageTitle from '@/components/premium/PageTitle';
import EmptyGuide from '@/components/premium/EmptyGuide';
import { CARD, EYEBROW_SOFT, HERO_SURFACE, Meter } from '@/components/dashboard/brand';
import { cn } from '@/lib/utils';
import { CalendarDays } from 'lucide-react';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MAX_BACK = 24;

const currentMonth = () => {
  // Mes de hoy en Chile
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).format(new Date());
  return parts.slice(0, 7);
};
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};
const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
};
const monthLabel = (month: string) => {
  const name = MONTHS[Number(month.slice(5, 7)) - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${month.slice(0, 4)}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Resumen del mes: sesiones completadas, hitos y cuántos registros hiciste. Solo cuenta lo que ya está registrado:
// no interpreta medidas ni compara con otras personas.
const MonthlySummary = () => {
  const now = useMemo(currentMonth, []);
  const [month, setMonth] = useState(now);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setSummary(await achievementApi.getMonthly(month));
    } catch {
      setSummary(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const canGoBack = monthsBetween(month, now) < MAX_BACK;
  const canGoForward = month < now;
  const planRatio = summary?.sessions.plan && summary.sessions.plan.target > 0 ? summary.sessions.plan.completed / summary.sessions.plan.target : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageTitle serif eyebrow="Resumen mensual" title={monthLabel(month)} description="Lo que registraste este mes, a tu ritmo. Sin comparaciones ni interpretaciones." />

      <div className="flex items-center justify-between gap-2" role="group" aria-label="Cambiar de mes">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={!canGoBack} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-[#8fd0e0] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          Mes anterior
        </button>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canGoForward} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-[#8fd0e0] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
          Mes siguiente
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <PageSkeleton label="Cargando tu resumen…">
          <CardsSkeleton count={1} bodyHeight="h-28" />
          <ListSkeleton rows={3} />
        </PageSkeleton>
      )}

      {!loading && failed && <LoadErrorAlert message="No se pudo cargar tu resumen." onRetry={load} />}

      {!loading && summary && !summary.hasActivity && (
        <EmptyGuide icon={CalendarDays} title="Este mes todavía no tiene registros" description="Cuando completes sesiones o guardes registros, aquí verás tu resumen. Descansar también es parte del proceso." />
      )}

      {!loading && summary && summary.hasActivity && (
        <>
          <section aria-labelledby="resumen-sesiones" className={cn('rounded-[24px] border p-5', HERO_SURFACE)}>
            <p id="resumen-sesiones" className={cn(EYEBROW_SOFT, 'text-[#8fd0e0]')}>Sesiones completadas</p>
            <p className="mt-2 flex items-baseline gap-2 text-[#fff8e4]">
              <span className="text-[4rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{summary.sessions.plan ? summary.sessions.plan.completed : summary.sessions.completed}</span>
              {summary.sessions.plan && <span className="text-lg font-semibold text-[#cdc6b6]">de {summary.sessions.plan.target} sesiones de tu plan</span>}
            </p>
            {summary.sessions.plan && <Meter className="mt-3" ratio={planRatio} label={`${summary.sessions.plan.completed} de ${summary.sessions.plan.target} sesiones del plan`} animateKey={`resumen:${summary.month}`} />}
            {summary.sessions.plan?.met && <p className="mt-3 text-sm text-[#cdc6b6]">Cumpliste las sesiones de tu plan este mes. Gracias por tu constancia.</p>}
            <p className="mt-3 text-sm text-[#cdc6b6]">
              {summary.sessions.plan && (summary.sessions.plan.completed !== summary.sessions.completed ? 'Dentro del mes calendario: ' : 'Del mes: ')}
              {[summary.sessions.training > 0 && plural(summary.sessions.training, 'sesión de entrenamiento', 'sesiones de entrenamiento'), summary.sessions.kinesiology > 0 && plural(summary.sessions.kinesiology, 'sesión de kinesiología', 'sesiones de kinesiología')].filter(Boolean).join(' · ') || 'Sin sesiones completadas este mes.'}
            </p>
          </section>

          <section aria-labelledby="resumen-hitos" className="space-y-3">
            <h2 id="resumen-hitos" className="px-1 text-lg font-bold text-[#fff8e4]">Hitos del mes</h2>
            {summary.milestones.length === 0 ? (
              <p className={cn(CARD, 'p-4 text-sm text-[#cdc6b6]')}>Este mes no hubo hitos nuevos. Cada sesión y cada registro cuentan.</p>
            ) : (
              <ul className={cn(CARD, 'divide-y divide-[#fff8e4]/10 overflow-hidden')}>
                {summary.milestones.map((m) => (
                  <li key={`${m.key}-${m.awardedAt}`} className="flex items-center gap-3.5 px-4 py-3">
                    <AchievementBadge category={m.category} state="earned" size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold text-[#fff8e4]">{m.title}</span>
                      <span className="block text-[13px] text-[#a8a295]">{formatDay(m.awardedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="resumen-registros" className="space-y-3">
            <h2 id="resumen-registros" className="px-1 text-lg font-bold text-[#fff8e4]">Lo que registraste</h2>
            <dl className={cn(CARD, 'divide-y divide-[#fff8e4]/10 overflow-hidden')}>
              {[
                ['Mediciones', summary.records.measurements],
                ['Registros de ejercicio', summary.records.exercises],
                ['Días con Readiness', summary.records.readinessDays],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <dt className="text-[15px] text-[#cdc6b6]">{label}</dt>
                  <dd className="font-serif text-2xl font-medium tabular-nums text-[#fff8e4]">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="px-1 text-xs text-[#a8a295]">Aquí solo se cuentan tus registros. Tus medidas y su evolución están en <Link to="/app/mediciones" className="underline underline-offset-4">Mediciones</Link>.</p>
          </section>
        </>
      )}
    </div>
  );
};

export default MonthlySummary;
