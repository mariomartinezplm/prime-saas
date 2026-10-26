import { useMemo, useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Activity, ChevronDown, PersonStanding, Ruler, Scale, TriangleAlert, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import BodyDiagram from '@/components/body/BodyDiagram';
import { GENERAL_METRICS, PERIMETER_METRICS, JUMP_METRICS, buildSeries, type MetricDefinition } from '@/components/charts/measurementMetrics';
import MeasurementForm from '@/components/forms/MeasurementForm';
import PatientRecordDialog from '@/components/forms/PatientRecordDialog';
import RecordRowActions from '@/components/records/RecordRowActions';
import PageTitle from '@/components/premium/PageTitle';
import SegmentedTabs from '@/components/premium/SegmentedTabs';
import MetricTile from '@/components/premium/MetricTile';
import TrendChart from '@/components/premium/TrendChart';
import EmptyGuide from '@/components/premium/EmptyGuide';
import MetricDetailDrawer from '@/components/premium/MetricDetailDrawer';
import { CARD, EYEBROW_SOFT, HERO_SURFACE } from '@/components/dashboard/brand';
import { filterByRange, formatValue, longDate, summarize, type TrendRange } from '@/lib/trend';
import { cn } from '@/lib/utils';
import { useHasActivePlan } from '@/hooks/useHasActivePlan';
import { showApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import api from '@/lib/api';
import type { Measurement } from '@/types';

const RANGES: { value: TrendRange; label: string }[] = [
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'all', label: 'Todo' },
];

// Resumen de una medición para el historial: lo principal que se registró ese día
function summaryOf(m: Measurement): string {
  const parts: string[] = [];
  if (m.weight) parts.push(`${formatValue(m.weight, 1)} kg`);
  if (m.bodyFatPercentage) parts.push(`${formatValue(m.bodyFatPercentage, 1)} % grasa`);
  const perimeters = Object.values(m.perimeters ?? {}).filter((v) => typeof v === 'number' && v > 0).length;
  if (perimeters > 0) parts.push(`${perimeters} ${perimeters === 1 ? 'perímetro' : 'perímetros'}`);
  const jumps = Object.values(m.jumpTests ?? {}).filter((v) => typeof v === 'number' && v > 0).length;
  if (jumps > 0) parts.push(`${jumps} ${jumps === 1 ? 'salto' : 'saltos'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Registro';
}

const MeasurementsPage = () => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('resumen');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [range, setRange] = useState<TrendRange>('6m');
  const [heroKey, setHeroKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<MetricDefinition | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [zone, setZone] = useState<string | null>(null);
  const hasActivePlan = useHasActivePlan(user?.id);
  const canEdit = hasActivePlan === true;

  useEffect(() => {
    if (!user) return;
    setFailed(false);
    api
      .get(`/measurements/patient/${user.id}`)
      .then((res) => setMeasurements(res.data.data.measurements || []))
      // Si falla la carga se avisa: antes se mostraba como si no hubiera mediciones
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  const retry = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (m: Measurement) => {
    try {
      await api.delete(`/measurements/${m._id}`);
      notify.success('Medición eliminada');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showApiError(err, 'No se pudo eliminar la medición');
      throw err;
    }
  };

  // Series reales de cada medida (un 0 cuenta como «sin dato», ver buildSeries)
  const seriesOf = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof buildSeries>>();
    const all = [...GENERAL_METRICS, ...PERIMETER_METRICS, ...JUMP_METRICS];
    all.forEach((m) => cache.set(`${m.key}`, buildSeries(measurements, m.read)));
    return (m: MetricDefinition) => cache.get(m.key) ?? [];
  }, [measurements]);

  const generalWithData = GENERAL_METRICS.filter((m) => seriesOf(m).length > 0);
  // Primero las medidas que cambiaron más (lo que aporta información); las que no cambian quedan al final
  const changeOf = (m: MetricDefinition) => Math.abs(summarize(seriesOf(m), m.unit, m.decimals)?.change ?? 0);
  const perimetersWithData = PERIMETER_METRICS.filter((m) => seriesOf(m).length > 0).sort((a, b) => changeOf(b) - changeOf(a));
  const jumpsWithData = JUMP_METRICS.filter((m) => seriesOf(m).length > 0);
  const hero = generalWithData.find((m) => m.key === heroKey) ?? generalWithData[0];
  const heroPoints = hero ? seriesOf(hero) : [];
  const heroSummary = hero ? summarize(heroPoints, hero.unit, hero.decimals) : null;
  const shownPoints = hero ? filterByRange(heroPoints, range) : [];
  const latest = measurements[0];

  const zoneValues: Record<string, number> = {};
  Object.entries(latest?.perimeters ?? {}).forEach(([key, value]) => {
    if (value) zoneValues[key] = value;
  });

  const registerButton = (
    <PatientRecordDialog label="Registrar medición" title="Registrar medición" description="Anota tu peso, % de grasa, perímetros o resultados. Solo completa lo que tengas.">
      {(close) => (
        <MeasurementForm
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
      <PageSkeleton label="Cargando tus mediciones…">
        <CardsSkeleton count={2} bodyHeight="h-56" />
      </PageSkeleton>
    );
  }

  const tile = (m: MetricDefinition) => {
    const pts = seriesOf(m);
    const s = summarize(pts, m.unit, m.decimals)!;
    return (
      <MetricTile
        key={m.key}
        label={m.label}
        value={formatValue(s.last.value, m.decimals === 1 && Number.isInteger(s.last.value) ? 0 : m.decimals)}
        unit={m.unit}
        values={pts.map((p) => p.value)}
        caption={s.count > 1 ? `${s.changeText} ${s.sinceText}` : 'Primer registro'}
        ariaLabel={`${m.label}: ${formatValue(s.last.value, m.decimals)} ${m.unit}. ${s.count > 1 ? `${s.changeText} ${s.sinceText}.` : 'Primer registro.'} Ver detalle`}
        onClick={() => setDetail(m)}
      />
    );
  };

  const history = measurements.slice(0, historyOpen ? measurements.length : 4);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle
        serif
        eyebrow="Mediciones y progreso"
        title={<>Tu evolución,<br />en perspectiva</>}
        description={measurements.length > 0 ? `Última medición: ${longDate(measurements[0].date)}` : undefined}
        actions={measurements.length > 0 ? (
          <>
            {registerButton}
            <Button asChild variant="outline" className="min-h-[44px] rounded-xl border-[#398ca2] bg-transparent font-semibold text-[#fff8e4] hover:bg-[#398ca2]/15 hover:text-[#fff8e4]">
              <Link to="/app/mapa-corporal"><PersonStanding aria-hidden="true" />Anotar tocando el cuerpo</Link>
            </Button>
          </>
        ) : undefined}
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar tus mediciones.</span>
            <Button variant="outline" size="sm" onClick={retry}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {measurements.length === 0 && !failed ? (
        <EmptyGuide
          icon={Scale}
          title="Tu primera medición marca el punto de partida"
          description="Aquí verás cómo cambian tu peso y tus medidas con el tiempo. Se registran en tus evaluaciones con tu kinesiólogo, o tú mismo cuando quieras."
          action={registerButton}
          preview={[
            { icon: Scale, title: 'Peso', text: 'Tendencia con fechas y cambios' },
            { icon: Ruler, title: 'Perímetros', text: 'Cintura, cadera, brazos y piernas' },
            { icon: Zap, title: 'Tests de salto', text: 'Tu rendimiento a lo largo del tiempo' },
          ]}
        />
      ) : (
        <SegmentedTabs
          ariaLabel="Qué quieres ver"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'resumen', label: 'Resumen' },
            { value: 'perimetros', label: 'Perímetros' },
            { value: 'saltos', label: 'Saltos' },
          ]}
        >
          {[
            /* ===== Resumen ===== */
            <div key="resumen" className="space-y-5">
              {hero && heroSummary ? (
                <section aria-label={hero.label} className={cn('rounded-[24px] border p-4 pb-2 min-[375px]:p-5 min-[375px]:pb-3', HERO_SURFACE)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn(EYEBROW_SOFT, 'text-[#7cc0d2]')}>{hero.label === 'Peso' ? 'Peso actual' : hero.label}</p>
                      <p className="mt-1.5 font-serif text-[3.75rem] font-medium leading-none tracking-[-0.02em] tabular-nums text-[#fff8e4]">
                        {formatValue(heroSummary.last.value, hero.decimals)}
                        {hero.unit && <span className="ml-1.5 text-xl font-bold text-[#fff8e4]/65">{hero.unit}</span>}
                      </p>
                      <p className="mt-1.5 text-sm text-[#fff8e4]/72">Último registro · {format(parseISO(heroSummary.last.date), "d 'de' MMM", { locale: es })}</p>
                    </div>
                    {heroSummary.count > 1 && (
                      <span className="shrink-0 rounded-full border border-[#fff8e4]/20 bg-[#fff8e4]/[0.06] px-3 py-1 text-[13px] font-semibold text-[#fff8e4]">{heroSummary.changeText}</span>
                    )}
                  </div>

                  {heroSummary.count > 1 ? (
                    <>
                      <div role="group" aria-label="Rango de tiempo" className="mt-4 flex gap-2">
                        {RANGES.map((r) => (
                          <button
                            key={r.value}
                            type="button"
                            aria-pressed={range === r.value}
                            onClick={() => setRange(r.value)}
                            className={cn(
                              'min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
                              range === r.value ? 'border-[#398ca2] bg-[#398ca2]/25 text-[#fff8e4]' : 'border-[#fff8e4]/15 text-[#fff8e4]/70 hover:bg-[#fff8e4]/[0.05]'
                            )}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 -mx-1">
                        <TrendChart points={shownPoints} unit={hero.unit} decimals={hero.decimals} label={hero.label} />
                      </div>
                      <p className="px-1 pb-2 text-xs text-[#fff8e4]/62">
                        {shownPoints.length} {shownPoints.length === 1 ? 'registro' : 'registros'} · {heroSummary.sinceText} ({heroSummary.changeText})
                      </p>
                    </>
                  ) : (
                    <p className="mb-3 mt-4 rounded-2xl border border-dashed border-[#fff8e4]/20 px-4 py-3 text-sm text-[#fff8e4]/75">
                      Este es tu punto de partida. Con un segundo registro verás aquí tu tendencia.
                    </p>
                  )}

                  {generalWithData.length > 1 && (
                    <div role="group" aria-label="Medida principal" className="mb-3 flex flex-wrap gap-2 border-t border-[#fff8e4]/10 pt-3">
                      {generalWithData.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          aria-pressed={m.key === hero.key}
                          onClick={() => setHeroKey(m.key)}
                          className={cn(
                            'min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]',
                            m.key === hero.key ? 'border-[#398ca2] bg-[#398ca2]/25 text-[#fff8e4]' : 'border-[#fff8e4]/15 text-[#fff8e4]/70'
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <EmptyGuide
                  icon={Scale}
                  title="Aún no hay peso ni composición registrados"
                  description="Cuando se registre tu peso o tu % de grasa, lo verás aquí con su tendencia. Mientras tanto puedes revisar tus perímetros."
                />
              )}

              {perimetersWithData.length > 0 && (
                <section aria-labelledby="peri-title" className="space-y-3">
                  <div className="flex items-baseline justify-between px-1">
                    <h2 id="peri-title" className="text-lg font-bold tracking-tight text-[#fff8e4]">Perímetros</h2>
                    {perimetersWithData.length > 4 && (
                      <button type="button" onClick={() => setTab('perimetros')} className="min-h-[44px] px-1 text-[13px] font-semibold text-[#7cc0d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]">
                        Ver todos
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">{perimetersWithData.slice(0, 4).map(tile)}</div>
                </section>
              )}

              <section aria-labelledby="hist-title" className="space-y-2">
                <h2 id="hist-title" className="px-1 text-lg font-bold tracking-tight text-[#fff8e4]">Historial</h2>
                <ul className={cn(CARD, 'divide-y divide-[#fff8e4]/10 px-4')}>
                  {history.map((m) => (
                    <li key={m._id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[#fff8e4]">{longDate(m.date)}</p>
                        <p className="truncate text-[13px] text-[#fff8e4]/70">{summaryOf(m)}</p>
                      </div>
                      {canEdit && <RecordRowActions itemLabel="esta medición" onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} />}
                    </li>
                  ))}
                </ul>
                {measurements.length > 4 && (
                  <Button variant="ghost" className="w-full text-[#7cc0d2] hover:bg-[#fff8e4]/[0.05] hover:text-[#7cc0d2]" onClick={() => setHistoryOpen((v) => !v)}>
                    {historyOpen ? 'Ver menos' : `Ver los ${measurements.length} registros`}
                  </Button>
                )}
              </section>
            </div>,

            /* ===== Perímetros ===== */
            <div key="perimetros" className="space-y-4">
              {perimetersWithData.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">{perimetersWithData.map(tile)}</div>
              ) : (
                <EmptyGuide icon={Ruler} title="Aún no hay perímetros registrados" description="Cintura, cadera, brazos y piernas aparecerán aquí cuando se midan." action={measurements.length > 0 ? registerButton : undefined} />
              )}
              {perimetersWithData.length > 0 && (
                <Collapsible className={cn(CARD, 'overflow-hidden')}>
                  <CollapsibleTrigger className="group flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#fff8e4]">
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#398ca2]/15 text-[#7cc0d2]"><Activity className="h-5 w-5" /></span>
                      <span>
                        <span className="block text-[15px] font-semibold text-[#fff8e4]">Mapa corporal</span>
                        <span className="block text-[13px] text-[#fff8e4]/70">Toca una zona para ver su evolución</span>
                      </span>
                    </span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#fff8e4]/70 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pb-4">
                    <BodyDiagram selectedZone={zone} onZoneClick={(z) => { setZone(z); const m = PERIMETER_METRICS.find((p) => p.key === z); if (m && seriesOf(m).length > 0) setDetail(m); else notify.info('Aún no hay medidas de esta zona.'); }} zoneValues={zoneValues} />
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>,

            /* ===== Saltos ===== */
            <div key="saltos" className="space-y-4">
              {jumpsWithData.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">{jumpsWithData.map(tile)}</div>
              ) : (
                <EmptyGuide icon={Zap} title="Aún no hay tests de salto" description="Si tu kinesiólogo evalúa tu salto, verás aquí cómo mejora con el tiempo." />
              )}
            </div>,
          ]}
        </SegmentedTabs>
      )}

      {detail && (
        <MetricDetailDrawer open onOpenChange={(open) => !open && setDetail(null)} label={detail.label} unit={detail.unit} decimals={detail.decimals} points={seriesOf(detail)} />
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corregir medición</DialogTitle>
            <DialogDescription>Un campo que dejes vacío se borra de la medición.</DialogDescription>
          </DialogHeader>
          {editing && (
            <MeasurementForm
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

export default MeasurementsPage;
