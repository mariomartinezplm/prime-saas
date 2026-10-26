import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ruler, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardsSkeleton, PageSkeleton } from '@/components/shared/Skeletons';
import PageTitle from '@/components/premium/PageTitle';
import BodyMap from '@/components/body/BodyMap';
import ZoneSheet from '@/components/body/ZoneSheet';
import { CARD, HERO_SURFACE } from '@/components/dashboard/brand';
import { viewOfZone, type BodyView } from '@/lib/bodyZones';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { EVARecord } from '@/types';

// El mapa del cuerpo SIEMPRE disponible: se toca una zona y de ahí se anota el dolor o la medida de esa parte. Con el último dolor
// de cada zona escrito encima, para ver de un vistazo dónde hay molestias.
const BodyMapPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<EVARecord[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BodyView>('front');
  const [zone, setZone] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setFailed(false);
    api
      .get(`/eva/patient/${user.id}`)
      .then((res) => setRecords(res.data.data.evaRecords || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [user]);
  useEffect(load, [load]);

  // Último registro de cada zona
  const latest = useMemo(() => {
    const map = new Map<string, EVARecord>();
    [...records].sort((a, b) => b.date.localeCompare(a.date)).forEach((r) => !map.has(r.bodyArea) && map.set(r.bodyArea, r));
    return map;
  }, [records]);
  const levels = useMemo(() => Object.fromEntries([...latest.entries()].map(([area, r]) => [area, r.painLevel])), [latest]);

  const pick = (id: string) => {
    setZone(id);
    setView((current) => viewOfZone(id, current));
  };

  if (!user) return null;
  if (loading) return <PageSkeleton label="Cargando tu mapa…"><CardsSkeleton count={2} bodyHeight="h-56" /></PageSkeleton>;

  const last = zone ? latest.get(zone) : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <PageTitle
        eyebrow="Mapa del cuerpo"
        title={<>Toca la parte<br />que quieres anotar</>}
        description="Anota cuánto te duele, o la medida de un músculo, en la zona exacta. Lo ve tu kinesiólogo."
        serif
      />

      {failed && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>No se pudieron cargar tus registros de dolor.</span>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }}>Reintentar</Button>
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Mapa del cuerpo" className={cn('rounded-[24px] border p-4', HERO_SURFACE)}>
        <BodyMap view={view} onViewChange={setView} selected={zone} onSelect={pick} levels={levels} />
        <p className="mt-3 text-center text-[12.5px] text-[#a8a295]">Los números son tu último dolor en cada zona. «Derecha» e «izquierda» son las tuyas.</p>
      </section>

      <Link to="/app/mediciones" className={cn(CARD, 'flex min-h-[56px] items-center gap-3 px-4 text-[15px] font-semibold text-[#fff8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]')}>
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#398ca2]/15 text-[#7cc0d2]"><Ruler className="h-5 w-5" /></span>
        <span className="flex-1">
          <span className="block">Registrar todos mis perímetros</span>
          <span className="block text-[13px] font-normal text-[#fff8e4]/70">Si prefieres anotar todas tus medidas de una vez</span>
        </span>
      </Link>

      {zone && (
        <ZoneSheet
          key={zone}
          zoneId={zone}
          patientId={user.id}
          lastPain={last ? { level: last.painLevel, date: last.date } : null}
          onClose={() => setZone(null)}
          onPainSaved={() => load()}
        />
      )}
    </div>
  );
};

export default BodyMapPage;
