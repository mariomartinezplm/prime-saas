import { Link } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EYEBROW, Meter, SURFACE, TEXT, TEXT_SOFT } from './brand';
import { sessionsWord } from './nextSession';
import { RESERVED, SkeletonBones } from './CardSkeleton';
import { useContentFade } from './useContentFade';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import type { SummaryStatus } from './useAchievementsSummary';
import type { ProgressView } from './progressView';

interface ProgressCardProps {
  status: SummaryStatus;
  view: ProgressView | null;
  // Reintenta solo esta consulta
  onRetry?: () => void;
}

// «Tu constancia»: sesiones del mes y siguiente logro, con los datos que ya calcula el servidor.
// Sin datos aplicables (sin objetivo) el bloque no se muestra. Si la consulta falla se dice con un «Reintentar» propio: un fallo nunca
// debe verse como «no hay datos».
const ProgressCard = ({ status, view, onRetry }: ProgressCardProps) => {
  const fade = useContentFade(status === 'loading');
  if (status === 'error') {
    return (
      <section aria-labelledby="tu-constancia" className={cn(SURFACE, 'space-y-3')}>
        <h2 id="tu-constancia" className={EYEBROW}>
          Tu constancia
          <Trophy className="h-4 w-4" aria-hidden="true" />
        </h2>
        <LoadErrorAlert message="No pudimos cargar tu constancia." onRetry={() => onRetry?.()} />
      </section>
    );
  }

  if (status === 'loading') {
    return (
      <div className={cn(SURFACE, RESERVED.progress)}>
        <SkeletonBones label="Cargando tu constancia" lines={[40, 100, 70]} />
      </div>
    );
  }

  if (!view) return null;
  const { consistency, next, earned } = view;
  const missing = consistency ? consistency.target - consistency.current : 0;

  return (
    <section aria-labelledby="tu-constancia" className={cn(SURFACE, 'space-y-5', fade)}>
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
          <Meter ratio={consistency.ratio} animateKey="consistency" label={`${consistency.current} de ${consistency.target} sesiones este mes`} />
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
          <Meter ratio={next.ratio} animateKey={`next:${next.key}`} label={`${next.title}: ${next.current} de ${next.target} ${next.label}`} />
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
