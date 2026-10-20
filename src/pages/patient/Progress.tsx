import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Camera, ChevronRight, Dumbbell, HeartPulse, Ruler, Trophy, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PageTitle from '@/components/premium/PageTitle';
import { CARD, CARD_LINK, HERO_SURFACE } from '@/components/dashboard/brand';
import { useAchievementsSummary } from '@/components/dashboard/useAchievementsSummary';
import { exercisesSummary, painSummary, weightSummary } from '@/lib/progressSummary';
import { withTimeout } from '@/lib/withTimeout';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Row {
  to: string;
  title: string;
  icon: LucideIcon;
  // Resumen real; null = todavía sin datos (o no se pudo cargar): se muestra el texto neutral
  summary: string | null;
  fallback: string;
}

// Un resumen que se pide por su cuenta: si tarda o falla, solo esa fila queda con su texto neutral
const useSummary = (path: string | null, pick: (data: never) => string | null): string | null => {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    withTimeout(api.get(path))
      .then((res) => alive && setValue(pick(res.data.data as never)))
      .catch(() => alive && setValue(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return value;
};

const Progress = () => {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const weight = useSummary(id && `/measurements/patient/${id}`, (d: { measurements?: { date: string; weight?: number }[] }) => weightSummary(d.measurements ?? []));
  const exercises = useSummary(id && `/exercises/patient/${id}`, (d: { exercises?: never[] }) => exercisesSummary((d.exercises ?? []) as never));
  const pain = useSummary(id && `/eva/patient/${id}`, (d: { evaRecords?: { bodyArea: string; painLevel: number; date: string }[] }) => painSummary(d.evaRecords ?? []));
  const achievements = useAchievementsSummary();
  const earned = achievements.status === 'ready' ? achievements.view?.earned ?? 0 : null;
  const next = achievements.status === 'ready' ? achievements.view?.next ?? null : null;

  const rows: Row[] = [
    { to: '/app/mediciones', title: 'Mediciones', icon: Ruler, summary: weight, fallback: 'Tu peso y tus medidas' },
    { to: '/app/ejercicios', title: 'Ejercicios', icon: Dumbbell, summary: exercises, fallback: 'La carga de cada ejercicio' },
    { to: '/app/dolor', title: 'Dolor (EVA)', icon: HeartPulse, summary: pain, fallback: 'Tu dolor por zona del cuerpo' },
    { to: '/app/fotos', title: 'Fotos de progreso', icon: Camera, summary: null, fallback: 'Tu galería privada' },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle eyebrow="Progreso" title={<>Todo tu avance,<br />en un solo lugar</>} description="Elige qué quieres revisar. Cada pantalla muestra solo lo que ya está registrado." />

      <Link
        to="/app/logros"
        className={cn('block rounded-[24px] border p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff8e4]', HERO_SURFACE)}
        aria-label={`Mis logros${earned ? `, ${earned} conseguidos` : ''}${next ? `. Próximo hito: ${next.title}` : ''}`}
      >
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#398ca2]/50 bg-[#181619]/55 text-[#7cc0d2]">
            <Trophy className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7cc0d2]">Mis logros</p>
            <p className="mt-0.5 text-lg font-bold leading-snug tracking-tight text-[#fff8e4]">{next ? next.title : 'Tus avances merecen celebrarse'}</p>
            <p className="text-sm text-[#fff8e4]/72">
              {earned ? `${earned} ${earned === 1 ? 'logro conseguido' : 'logros conseguidos'}` : next ? 'Tu próximo hito' : 'Cada sesión y cada registro suman'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[#fff8e4]/60" aria-hidden="true" />
        </div>
      </Link>

      <nav aria-label="Secciones de progreso" className="space-y-2.5">
        {rows.map(({ to, title, icon: Icon, summary, fallback }) => (
          <Link key={to} to={to} className={cn(CARD, CARD_LINK, 'flex min-h-[72px] items-center gap-3.5 px-4 py-3')}>
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#398ca2]/40 bg-[#398ca2]/15 text-[#7cc0d2]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-semibold text-[#fff8e4]">{title}</span>
              <span className="block truncate text-[13px] text-[#fff8e4]/70">{summary ?? fallback}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#fff8e4]/55" aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <p className="flex items-center gap-2 px-1 text-[13px] text-[#fff8e4]/60">
        <Activity className="h-4 w-4" aria-hidden="true" />
        Tu ritmo es el tuyo: descansar también cuenta.
      </p>
    </div>
  );
};

export default Progress;
