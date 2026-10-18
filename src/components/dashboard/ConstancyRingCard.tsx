import { cn } from '@/lib/utils';
import { TEXT, TEXT_SOFT } from './brand';
import { sessionsWord } from './nextSession';
import ProgressRing from './ProgressRing';
import { RING_CARD } from './PlanRingCard';
import type { ProgressView } from './progressView';
import { SkeletonBones } from './CardSkeleton';
import { useContentFade } from './useContentFade';

interface ConstancyRingCardProps {
  consistency: NonNullable<ProgressView['consistency']> | null;
  loading?: boolean;
}

// «Tu constancia»: sesiones del mes respecto de la meta que calcula el servidor (solo planes mensuales de entrenamiento con meta).
// Sin meta no se muestra (ver el dashboard): nunca un anillo vacío ni un porcentaje inventado.
const ConstancyRingCard = ({ consistency, loading = false }: ConstancyRingCardProps) => {
  const fade = useContentFade(loading);
  const missing = consistency ? consistency.target - consistency.current : 0;

  return (
    <section aria-labelledby="tu-constancia" className={cn(RING_CARD, 'flex flex-col')}>
      <h2 id="tu-constancia" className={cn('text-sm font-medium', TEXT_SOFT)}>
        Tu constancia
      </h2>
      <p className={cn('text-xs', TEXT_SOFT)}>Este mes</p>
      {loading || !consistency ? (
        <SkeletonBones label="Cargando tu constancia" className="mt-4" lines={[50, 100, 40]} />
      ) : (
        <div className={cn('mt-3 flex flex-1 flex-col items-center justify-start gap-3 pt-1 text-center', fade)}>
          <ProgressRing
            ratio={consistency.ratio}
            value={consistency.current}
            caption={`de ${consistency.target}`}
            tone="cream"
            label={`${consistency.current} de ${consistency.target} sesiones este mes`}
            animateKey="consistency-ring"
          />
          <p className={cn('text-sm', consistency.done ? TEXT : TEXT_SOFT)}>
            {consistency.done ? 'Meta del mes lograda' : `Te ${missing === 1 ? 'falta' : 'faltan'} ${sessionsWord(missing)}`}
          </p>
        </div>
      )}
    </section>
  );
};

export default ConstancyRingCard;
