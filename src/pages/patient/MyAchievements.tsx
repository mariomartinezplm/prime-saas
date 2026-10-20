import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Trophy } from 'lucide-react';
import { achievementApi, type AchievementCategory, type AchievementItem, type AchievementsOverview } from '@/services/achievementService';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import AchievementCard from '@/components/achievements/AchievementCard';
import { formatDay, formatNumber } from '@/components/achievements/format';
import { CATEGORY_ICONS } from '@/components/achievements/categoryMeta';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import { CardsSkeleton, ListSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import PageTitle from '@/components/premium/PageTitle';
import EmptyGuide from '@/components/premium/EmptyGuide';
import { CARD, EYEBROW_SOFT, HERO_SURFACE, Meter } from '@/components/dashboard/brand';
import { cn } from '@/lib/utils';

// Los retos que dependen de funciones que PRIME aún no tiene ("Pendiente") no se muestran al paciente: no prometemos lo que no existe.
const visibleItems = (category: AchievementCategory): AchievementItem[] => category.items.filter((i) => i.status !== 'pending');

const MyAchievements = () => {
  const [overview, setOverview] = useState<AchievementsOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setOverview(await achievementApi.getMine());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Desde la animación de desbloqueo ('#logro-<clave>') se baja al reto y se enfoca
  useEffect(() => {
    if (loading || !overview || !location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }, [loading, overview, location.hash]);

  const earned = useMemo(
    () => (overview ? overview.categories.flatMap((c) => visibleItems(c).filter((i) => i.status === 'earned').map((item) => ({ item, category: c }))) : []),
    [overview]
  );
  const toGo = useMemo(
    () => (overview ? overview.categories.map((c) => ({ category: c, items: visibleItems(c).filter((i) => i.status !== 'earned') })).filter((g) => g.items.length > 0) : []),
    [overview]
  );
  const hashKey = location.hash.startsWith('#logro-') ? location.hash.slice(7) : null;

  if (loading) {
    return (
      <PageSkeleton label="Cargando tus logros…">
        <CardsSkeleton count={2} bodyHeight="h-28" />
        <ListSkeleton rows={3} />
      </PageSkeleton>
    );
  }

  const next = overview?.next ?? null;
  const nextRatio = next?.progress && next.progress.target > 0 ? next.progress.current / next.progress.target : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageTitle
        eyebrow="Mis logros"
        title={<>Tus avances merecen<br />celebrarse</>}
        description="Aquí solo estás tú y tu propio progreso, a tu ritmo: sin rankings ni comparaciones. Descansar también es parte del proceso."
      />

      {failed && <LoadErrorAlert message="No se pudieron cargar tus logros." onRetry={load} />}

      {overview && overview.categories.length === 0 && (
        <EmptyGuide
          icon={Trophy}
          title="Tus primeros reconocimientos aparecerán aquí"
          description="A medida que entrenes, registres tu Readiness y tus mediciones, irás desbloqueando logros calculados con lo que ya está registrado."
        />
      )}

      {overview && overview.categories.length > 0 && (
        <>
          {/* Próximo hito: el protagonista */}
          {next ? (
            <a
              href={`#logro-${next.key}`}
              aria-label={`Próximo hito: ${next.title}${next.progress ? `, ${formatNumber(next.progress.current)} de ${formatNumber(next.progress.target)} ${next.progress.label}` : ''}`}
              className={cn('block rounded-[24px] border p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', HERO_SURFACE)}
            >
              <p className={cn(EYEBROW_SOFT, 'text-[#7cc0d2]')}>Tu próximo hito</p>
              <div className="mt-3 flex items-center gap-4">
                <AchievementBadge category={next.category} state="progress" ratio={nextRatio} size={76} />
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-snug tracking-tight text-[#fff8e4]">{next.title}</p>
                  <p className="text-sm text-[#fff8e4]/75">{next.categoryLabel}</p>
                </div>
              </div>
              {next.progress && (
                <div className="mt-4 space-y-1.5">
                  <Meter ratio={nextRatio} label={`${next.title}: ${formatNumber(next.progress.current)} de ${formatNumber(next.progress.target)} ${next.progress.label}`} animateKey={`logros-next:${next.key}`} />
                  <p className="text-sm text-[#fff8e4]/80">
                    <span className="font-bold tabular-nums text-[#fff8e4]">{formatNumber(next.progress.current)}</span> de {formatNumber(next.progress.target)} {next.progress.label}
                  </p>
                </div>
              )}
            </a>
          ) : (
            <section className={cn(CARD, 'p-5')}>
              <p className="text-base font-semibold text-[#fff8e4]">Cuando avances en un reto, aquí verás el más cercano.</p>
              <p className="mt-1 text-sm text-[#fff8e4]/72">Cada sesión, cada registro y cada hábito cuentan.</p>
            </section>
          )}

          {/* Colección: solo lo conseguido, sin ceros */}
          <section aria-labelledby="coleccion" className="space-y-3">
            <div className="flex items-baseline justify-between px-1">
              <h2 id="coleccion" className="text-lg font-bold tracking-tight text-[#fff8e4]">Tu colección</h2>
              {earned.length > 0 && <span className="rounded-full border border-[#398ca2]/50 bg-[#398ca2]/15 px-3 py-0.5 text-[13px] font-semibold text-[#fff8e4]">{earned.length} {earned.length === 1 ? 'conseguido' : 'conseguidos'}</span>}
            </div>
            {earned.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3">
                {earned.map(({ item, category }) => {
                  const latest = item.awards[0];
                  return (
                    <li key={item.key} id={`logro-${item.key}`} tabIndex={-1} className={cn(CARD, 'scroll-mt-24 flex flex-col items-start gap-3 p-4 outline-none target:border-[#398ca2]/70 focus-visible:border-[#398ca2]/70')}>
                      <AchievementBadge category={category.key} state="earned" size={52} />
                      <div>
                        <p className="text-[15px] font-semibold leading-snug text-[#fff8e4]">{item.title}</p>
                        {latest && <p className="mt-0.5 text-[12.5px] text-[#fff8e4]/70">{formatDay(latest.awardedAt)}{item.awards.length > 1 ? ` · ${item.awards.length} veces` : ''}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-5 text-sm text-[#fff8e4]/75">Tu primera insignia está más cerca de lo que crees. Cada sesión y cada registro suman.</p>
            )}
          </section>

          {/* Por lograr: por categoría, plegable */}
          {toGo.length > 0 && (
            <section aria-labelledby="por-lograr" className="space-y-3">
              <h2 id="por-lograr" className="px-1 text-lg font-bold tracking-tight text-[#fff8e4]">Por lograr</h2>
              {toGo.map(({ category, items }) => {
                const Icon = CATEGORY_ICONS[category.key];
                const startOpen = !!next && next.category === category.key || items.some((i) => i.key === hashKey);
                return (
                  <details key={category.key} open={startOpen} className={cn(CARD, 'group overflow-hidden')}>
                    <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4] [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#398ca2]/15 text-[#7cc0d2]"><Icon className="h-5 w-5" /></span>
                        <span>
                          <span className="block text-[15px] font-semibold text-[#fff8e4]">{category.label}</span>
                          <span className="block text-[13px] text-[#fff8e4]/70">{items.length} {items.length === 1 ? 'reto' : 'retos'}</span>
                        </span>
                      </span>
                      <ChevronDown className="h-5 w-5 shrink-0 text-[#fff8e4]/70 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                    </summary>
                    <ul className="space-y-3 px-3 pb-3">
                      {items.map((item) => (
                        <AchievementCard key={item.key} item={item} category={category.key} />
                      ))}
                    </ul>
                  </details>
                );
              })}
            </section>
          )}

          {overview.history.length > 0 && (
            <section aria-labelledby="historial" className="space-y-2">
              <h2 id="historial" className="px-1 text-lg font-bold tracking-tight text-[#fff8e4]">Historial</h2>
              <ol className={cn(CARD, 'divide-y divide-[#fff8e4]/10 px-4')}>
                {overview.history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3">
                    <span className="min-w-0">
                      <span className="text-[15px] font-semibold text-[#fff8e4]">{entry.title}</span>
                      <span className="text-[13px] text-[#fff8e4]/70"> · {entry.categoryLabel}</span>
                    </span>
                    <span className="text-[13px] tabular-nums text-[#fff8e4]/70">{formatDay(entry.awardedAt)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default MyAchievements;
