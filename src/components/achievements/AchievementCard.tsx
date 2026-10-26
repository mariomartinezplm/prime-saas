import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { AchievementCategoryKey, AchievementItem } from '@/services/achievementService';
import AchievementBadge from './AchievementBadge';
import ShareAchievementButton from './ShareAchievementButton';
import { formatDay, formatNumber } from './format';
import { cn } from '@/lib/utils';


const periodLabel = (periodKey: string) => {
  // 'YYYY-MM' → 'octubre 2026'; las demás claves (once, ejercicio@semana) no se muestran
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return null;
  return format(parseISO(`${periodKey}-01`), "MMMM 'de' yyyy", { locale: es });
};

interface AchievementCardProps {
  item: AchievementItem;
  category: AchievementCategoryKey;
  // Nombre de la categoría (para la imagen que se comparte)
  categoryLabel?: string;
}

// Una tarjeta por reto: qué es, cómo va y, si se consiguió, cuándo. El criterio exacto está a un toque.
const AchievementCard = ({ item, category, categoryLabel = '' }: AchievementCardProps) => {
  const earned = item.status === 'earned';
  const ratio = item.progress && item.progress.target > 0 ? item.progress.current / item.progress.target : 0;
  const badgeState = earned ? 'earned' : item.status === 'in_progress' ? 'progress' : item.status === 'available' ? 'idle' : 'muted';
  const latest = item.awards[0];
  const dim = item.status === 'locked' || item.status === 'pending';

  return (
    <li
      id={`logro-${item.key}`}
      tabIndex={-1}
      className={cn(
        'scroll-mt-24 rounded-[22px] border bg-[#fff8e4]/[0.04] p-4 outline-none transition-colors target:border-primary/60 focus-visible:border-primary/60',
        earned ? 'border-primary/40' : 'border-[#fff8e4]/10',
        dim && 'opacity-80'
      )}
    >
      <div className="flex items-start gap-4">
        <AchievementBadge category={category} state={badgeState} ratio={ratio} size={56} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight text-foreground">{item.title}</h3>
            {item.status === 'pending' && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Pendiente</span>}
            {item.status === 'locked' && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Bloqueado</span>}
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>

          {earned && latest && (
            <p className="text-sm font-medium text-primary">
              Conseguido el {formatDay(latest.awardedAt)}
              {item.awards.length > 1 && <span className="font-normal text-muted-foreground"> · {item.awards.length} veces</span>}
            </p>
          )}
          {earned && latest && <ShareAchievementButton achievement={{ title: item.title, category, categoryLabel, awardedAt: latest.awardedAt }} />}

          {/* Un logro único ya conseguido no muestra su barra llena; uno mensual sí muestra el mes en curso */}
          {item.progress && item.status !== 'locked' && !(earned && item.progress.current >= item.progress.target) && (
            <div className="space-y-1 pt-1">
              <Progress value={Math.min(100, Math.round(ratio * 100))} className="h-1.5" aria-label={`${item.title}: ${item.progress.label}`} />
              <p className="text-xs text-muted-foreground">
                {earned ? 'En curso: ' : ''}
                {formatNumber(item.progress.current)} de {formatNumber(item.progress.target)} {item.progress.label}
              </p>
            </div>
          )}

          {item.status === 'locked' && item.lockedNote && <p className="text-xs text-muted-foreground">{item.lockedNote}</p>}
          {item.status === 'pending' && item.pendingNote && <p className="text-xs text-muted-foreground">{item.pendingNote}</p>}
        </div>
      </div>

      {(item.criteria || item.awards.length > 0) && (
        <details className="group mt-3 border-t border-border pt-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>Cómo se consigue{item.awards.length > 0 ? ' y cuándo' : ''}</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <div className="space-y-3 pt-2 text-sm">
            {item.criteria && <p className="text-muted-foreground">{item.criteria}</p>}
            {item.awards.length > 0 && (
              <ul className="space-y-1.5">
                {item.awards.map((award) => (
                  <li key={award.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-foreground">
                      {formatDay(award.awardedAt)}
                      {periodLabel(award.periodKey) && <span className="text-muted-foreground"> · {periodLabel(award.periodKey)}</span>}
                    </span>
                    {award.detail && <span className="text-xs text-muted-foreground">{award.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

    </li>
  );
};

export default AchievementCard;
