import { Link } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EYEBROW, Meter, SURFACE, TEXT, TEXT_SOFT } from './brand';
import { sessionsWord } from './nextSession';
import type { SummaryStatus } from './useAchievementsSummary';
import type { ProgressView } from './progressView';

interface ProgressCardProps {
  status: SummaryStatus;
  view: ProgressView | null;
}

// «Tu constancia»: sesiones del mes y siguiente logro, con los datos que ya calcula el servidor.
// Sin datos aplicables, con error o sin objetivo, el bloque no se muestra (no hay una tarjeta vacía que distraiga).
const ProgressCard = ({ status, view }: ProgressCardProps) => {
  if (status === 'error') return null;

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Cargando tu constancia" className={cn(SURFACE, 'space-y-3')}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  if (!view) return null;
  const { consistency, next, earned } = view;
  const missing = consistency ? consistency.target - consistency.current : 0;

  return (
    <section aria-labelledby="tu-constancia" className={cn(SURFACE, 'space-y-5')}>
      <h2 id="tu-constancia" className={EYEBROW}>
        Tu constancia
        <Trophy className="h-4 w-4" aria-hidden="true" />
      </h2>

      {consistency && (
        <div className="space-y-2">
          <p className={TEXT}>
            <span className="text-4xl font-semibold tabular-nums">{consistency.current}</span>{' '}
            <span className={cn('text-sm', TEXT_SOFT)}>de {consistency.target} sesiones este mes</span>
          </p>
          <Meter ratio={consistency.ratio} label={`${consistency.current} de ${consistency.target} sesiones este mes`} />
          <p className={cn('text-sm', TEXT_SOFT)}>
            {consistency.done ? 'Completaste las sesiones de tu plan este mes.' : `Te ${missing === 1 ? 'falta' : 'faltan'} ${sessionsWord(missing)} para completar el mes.`}
            {next?.isMonthlyConsistency && (
              <>
                {' '}
                Es tu siguiente logro:{' '}
                <Link to={`/app/logros#logro-${next.key}`} className="font-medium text-[#fff8e4] underline underline-offset-4 hover:text-[#fff8e4]/80">
                  {next.title}
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      {next && !next.isMonthlyConsistency && (
        <div className={cn('space-y-2', consistency && 'border-t border-[#fff8e4]/10 pt-5')}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#fff8e4]/60">Siguiente logro</p>
          <Link to={`/app/logros#logro-${next.key}`} className="block text-lg font-medium text-[#fff8e4] underline-offset-4 hover:underline">
            {next.title}
          </Link>
          <Meter ratio={next.ratio} label={`${next.title}: ${next.current} de ${next.target} ${next.label}`} />
          <p className={cn('text-sm', TEXT_SOFT)}>
            {next.current} de {next.target} {next.label}
          </p>
        </div>
      )}

      <Link to="/app/logros" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#fff8e4] underline-offset-4 hover:underline">
        Ver mis logros{earned > 0 ? ` (${earned})` : ''}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
};

export default ProgressCard;
