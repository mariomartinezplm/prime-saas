import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, ClipboardList, HeartPulse, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import PainBodyDiagram from '@/components/body/PainBodyDiagram';
import PageTitle from '@/components/premium/PageTitle';
import TrendChart from '@/components/premium/TrendChart';
import EmptyGuide from '@/components/premium/EmptyGuide';
import { CARD, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import { longDate, summarize, type TrendPoint } from '@/lib/trend';
import { capitalizeFirst, cn } from '@/lib/utils';
import api from '@/lib/api';
import type { EVARecord } from '@/types';

const zoneLabel = (area: string) => capitalizeFirst(area.replace(/-/g, ' '));

// Escala 0–10 en 10 tramos: el valor siempre va escrito; la barra solo lo refuerza (no depende del color)
const PainScale = ({ level }: { level: number }) => (
  <div role="img" aria-label={`Dolor ${level} de 10`} className="flex gap-1">
    {Array.from({ length: 10 }, (_, i) => (
      <span key={i} className={cn('h-2 flex-1 rounded-full', i < level ? 'bg-[#398ca2]' : 'bg-[#fff8e4]/12')} />
    ))}
  </div>
);

const PainRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<EVARecord[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    setFailed(false);
    api
      .get(`/eva/patient/${user.id}`)
      .then((res) => setRecords(res.data.data.evaRecords || []))
      // Si falla la carga se avisa: antes se mostraba como si no hubiera registros
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [user, attempt]);

  const retry = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  // Último registro de cada zona (la lista ya viene de más reciente a más antiguo)
  const latestByArea = useMemo(() => {
    const map = new Map<string, EVARecord>();
    sorted.forEach((r) => !map.has(r.bodyArea) && map.set(r.bodyArea, r));
    return map;
  }, [sorted]);
  const areas = [...latestByArea.keys()];
  const current = zone && latestByArea.has(zone) ? zone : areas[0] ?? null;
  const currentPoints: TrendPoint[] = useMemo(() => {
    if (!current) return [];
    const byDay = new Map<string, number>();
    sorted.filter((r) => r.bodyArea === current).forEach((r) => byDay.set(r.date.slice(0, 10), r.painLevel));
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [sorted, current]);
  const s = summarize(currentPoints, '/10', 0);
  const painLevels: Record<string, number> = {};
  latestByArea.forEach((r, area) => (painLevels[area] = r.painLevel));

  if (loading) {
    return (
      <PageSkeleton label="Cargando tus registros de dolor…">
        <CardsSkeleton count={2} bodyHeight="h-56" />
      </PageSkeleton>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle
        eyebrow="Seguimiento de molestias"
        title={<>Tu dolor, a lo largo<br />del tiempo</>}
        description="Tu kinesiólogo lo registra contigo en cada evaluación. Aquí ves cómo cambia, sin alarmas ni diagnósticos."
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar tus registros de dolor.</span>
            <Button variant="outline" size="sm" onClick={retry}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {records.length === 0 && !failed ? (
        <EmptyGuide
          icon={HeartPulse}
          title="Aún no hay registros de dolor"
          description="Cuando tu kinesiólogo mida tu dolor en una evaluación, lo verás aquí con su evolución por zona del cuerpo. Si hoy sientes una molestia, cuéntaselo en tu próxima sesión."
          preview={[
            { icon: Activity, title: 'Evolución por zona', text: 'Cómo cambia el dolor de cada parte del cuerpo' },
            { icon: ClipboardList, title: 'Historial', text: 'Fecha, zona y nivel de cada registro' },
          ]}
        />
      ) : (
        current && (
          <>
            <section aria-label={`Dolor en ${zoneLabel(current)}`} className={cn('rounded-[24px] border p-4 pb-3 min-[375px]:p-5 min-[375px]:pb-4', HERO_SURFACE)}>
              <p className={cn(EYEBROW_SOFT, 'text-[#7cc0d2]')}>Zona seleccionada</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[#fff8e4]">{zoneLabel(current)}</h2>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-[3rem] font-extrabold leading-none tracking-tight tabular-nums text-[#fff8e4]">
                  {latestByArea.get(current)!.painLevel}
                  <span className="ml-1 text-xl font-bold text-[#fff8e4]/65">/ 10</span>
                </p>
                {s && s.count > 1 && <span className="mb-1 shrink-0 rounded-full border border-[#fff8e4]/20 bg-[#fff8e4]/[0.06] px-3 py-1 text-[13px] font-semibold text-[#fff8e4]">{s.changeText.replace(' /10', '')} desde el primero</span>}
              </div>
              <div className="mt-3"><PainScale level={latestByArea.get(current)!.painLevel} /></div>
              <p className="mt-2 text-sm text-[#fff8e4]/72">Último registro · {longDate(latestByArea.get(current)!.date)}</p>
              {s && s.count > 1 ? (
                <div className="-mx-1 mt-3">
                  <TrendChart points={currentPoints} unit="/10" decimals={0} label={`Dolor en ${zoneLabel(current)}`} height={160} />
                </div>
              ) : (
                <p className="my-3 rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-3 text-sm text-[#fff8e4]/75">Con un segundo registro de esta zona verás aquí su evolución.</p>
              )}
              {areas.length > 1 && (
                <div role="group" aria-label="Elegir zona" className="mt-3 flex flex-wrap gap-2 border-t border-[#fff8e4]/10 pt-3">
                  {areas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={a === current}
                      onClick={() => setZone(a)}
                      className={cn(
                        'min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
                        a === current ? 'border-[#398ca2] bg-[#398ca2]/25 text-[#fff8e4]' : 'border-[#fff8e4]/15 text-[#fff8e4]/70'
                      )}
                    >
                      {zoneLabel(a)}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <Collapsible className={cn(CARD, 'overflow-hidden')}>
              <CollapsibleTrigger className="group flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]">
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#398ca2]/15 text-[#7cc0d2]"><Activity className="h-5 w-5" /></span>
                  <span>
                    <span className="block text-[15px] font-semibold text-[#fff8e4]">Mapa del cuerpo</span>
                    <span className="block text-[13px] text-[#fff8e4]/70">Toca una zona para verla arriba</span>
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-[#fff8e4]/70 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-4">
                <PainBodyDiagram selectedZone={current} onZoneClick={setZone} painLevels={painLevels} />
              </CollapsibleContent>
            </Collapsible>

            <section aria-labelledby="hist-eva" className="space-y-2">
              <h2 id="hist-eva" className="px-1 text-lg font-bold tracking-tight text-[#fff8e4]">Historial</h2>
              <ul className={cn(CARD, 'divide-y divide-[#fff8e4]/10 px-4')}>
                {sorted.map((r) => (
                  <li key={r._id}>
                    <button type="button" onClick={() => setZone(r.bodyArea)} className="flex min-h-[56px] w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]">
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-[#fff8e4]">{zoneLabel(r.bodyArea)}</span>
                        <span className="block truncate text-[13px] text-[#fff8e4]/70">{longDate(r.date)}{r.painType && r.painType.length > 0 ? ` · ${r.painType.join(', ')}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-lg font-extrabold tabular-nums text-[#fff8e4]">{r.painLevel}<span className="text-sm font-semibold text-[#fff8e4]/60">/10</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )
      )}
    </div>
  );
};

export default PainRecords;
