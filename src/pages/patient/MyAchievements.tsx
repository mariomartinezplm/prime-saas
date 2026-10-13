import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { achievementApi, type AchievementsOverview } from '@/services/achievementService';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import AchievementCard from '@/components/achievements/AchievementCard';
import { formatDay, formatNumber } from '@/components/achievements/format';
import { CATEGORY_ICONS } from '@/components/achievements/categoryMeta';
import EmptyState from '@/components/shared/EmptyState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import PageHeader from '@/components/shared/PageHeader';
import { CardsSkeleton, ListSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  if (loading) {
    return (
      <PageSkeleton label="Cargando tus logros…">
        <CardsSkeleton count={2} bodyHeight="h-28" />
        <ListSkeleton rows={3} />
      </PageSkeleton>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Mis logros" description="Reconocemos tu constancia y tus avances. Aquí solo estás tú y tu propio progreso: sin rankings ni comparaciones." />

      {failed && <LoadErrorAlert message="No se pudieron cargar tus logros." onRetry={load} />}

      {overview && overview.categories.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Tus primeros reconocimientos aparecerán aquí"
          description="A medida que entrenes, registres tu Readiness y tus mediciones, irás desbloqueando logros reales, calculados con lo que ya está registrado."
        />
      )}

      {overview && overview.categories.length > 0 && (
        <>
          <section aria-label="Resumen" className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Logros conseguidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-semibold tabular-nums text-foreground">{overview.summary.earned}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Próximo hito</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.next ? (
                  <a href={`#logro-${overview.next.key}`} className="flex items-center gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <AchievementBadge
                      category={overview.next.category}
                      state="progress"
                      ratio={overview.next.progress ? overview.next.progress.current / overview.next.progress.target : 0}
                      size={56}
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-medium text-foreground">{overview.next.title}</span>
                      {overview.next.progress && (
                        <span className="block text-sm text-muted-foreground">
                          {formatNumber(overview.next.progress.current)} de {formatNumber(overview.next.progress.target)} {overview.next.progress.label}
                        </span>
                      )}
                    </span>
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Cuando empieces a avanzar en un reto, aquí verás el más cercano.</p>
                )}
              </CardContent>
            </Card>
          </section>

          {overview.categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.key];
            return (
              <section key={category.key} aria-labelledby={`cat-${category.key}`} className="space-y-3">
                <h2 id={`cat-${category.key}`} className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {category.label}
                </h2>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {category.items.map((item) => (
                    <AchievementCard key={item.key} item={item} category={category.key} />
                  ))}
                </ul>
              </section>
            );
          })}

          <section aria-labelledby="historial" className="space-y-3">
            <h2 id="historial" className="text-lg font-semibold text-foreground">
              Historial
            </h2>
            {overview.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no has desbloqueado ningún logro. Cada sesión, cada registro y cada hábito cuentan.</p>
            ) : (
              <ol className="divide-y divide-border rounded-xl border border-border bg-card">
                {overview.history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{entry.title}</span>
                      <span className="text-sm text-muted-foreground"> · {entry.categoryLabel}</span>
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">{formatDay(entry.awardedAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default MyAchievements;
