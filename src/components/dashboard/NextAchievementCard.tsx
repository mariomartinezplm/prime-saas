import { Link } from 'react-router-dom';
import { ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EYEBROW, Meter, TEXT, TEXT_SOFT } from './brand';
import { sessionsWord } from './nextSession';
import type { ProgressView } from './progressView';

// «Próximo logro»: el siguiente que calcula el servidor, con su progreso real. Sin datos aplicables no se muestra nada inventado.
// Si solo hay logros ya conseguidos, queda un acceso discreto a «Mis logros».
const NextAchievementCard = ({ view }: { view: ProgressView }) => {
  const { next, consistency, earned } = view;
  const earnedText = earned > 0 ? `${earned} ${earned === 1 ? 'conseguido' : 'conseguidos'}` : null;

  if (!next) {
    if (!earnedText) return null;
    return (
      <Link to="/app/logros" className={cn('flex min-h-[3.5rem] items-center gap-3 rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] px-4 py-3 transition-colors duration-150 hover:bg-[#fff8e4]/[0.07] active:bg-[#fff8e4]/10', TEXT)}>
        <Trophy className="h-5 w-5 text-[#398ca2]" aria-hidden="true" />
        <span className="flex-1 text-sm font-medium">Mis logros · {earnedText}</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }

  const missing = consistency ? consistency.target - consistency.current : 0;
  const detail = next.isMonthlyConsistency && consistency ? (consistency.done ? 'Completaste las sesiones de tu mes' : `Te ${missing === 1 ? 'falta' : 'faltan'} ${sessionsWord(missing)}`) : `${next.current} de ${next.target} ${next.label}`;

  return (
    <Link
      to={`/app/logros#logro-${next.key}`}
      aria-label={`Próximo logro: ${next.title}. ${detail}.${earnedText ? ` ${earnedText}.` : ''}`}
      className="flex items-center gap-3 rounded-[22px] border border-[#fff8e4]/10 bg-[#fff8e4]/[0.04] p-4 transition-colors duration-150 hover:bg-[#fff8e4]/[0.07] active:bg-[#fff8e4]/10"
    >
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#398ca2]/45 bg-[#398ca2]/15 text-[#fff8e4]">
        <Trophy className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5" aria-hidden="true">
        <span className={cn(EYEBROW, 'justify-start text-[11px]')}>Próximo logro</span>
        <span className={cn('block text-base font-semibold leading-tight', TEXT)}>{next.title}</span>
        {!next.isMonthlyConsistency && <Meter ratio={next.ratio} animateKey={`next:${next.key}`} label={`${next.title}: ${next.current} de ${next.target} ${next.label}`} className="mt-1.5 h-1.5" />}
        <span className={cn('block text-xs', TEXT_SOFT)}>{detail}</span>
      </span>
      <span aria-hidden="true" className={cn('flex shrink-0 items-center gap-0.5 text-xs font-medium', TEXT)}>
        <span className="hidden min-[360px]:inline">{earnedText ? `Ver (${earned})` : 'Ver'}</span>
        <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
};

export default NextAchievementCard;
