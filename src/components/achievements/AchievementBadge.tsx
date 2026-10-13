import type { AchievementCategoryKey } from '@/services/achievementService';
import { CATEGORY_ICONS } from './categoryMeta';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  category: AchievementCategoryKey;
  // earned: anillo completo y brillo suave · progress: el anillo muestra el avance · idle: reto sin avance
  // muted: bloqueado o pendiente
  state: 'earned' | 'progress' | 'idle' | 'muted';
  // 0 a 1; solo se usa en 'progress'
  ratio?: number;
  size?: number;
  className?: string;
}

// Insignia de PRIME F&H: un anillo turquesa sobre fondo negro con el icono de la categoría en crema. Sin colores
// fuera de la marca, sin medallas ni estrellas: sobria. El anillo muestra el avance cuando lo hay.
const AchievementBadge = ({ category, state, ratio = 0, size = 64, className }: AchievementBadgeProps) => {
  const Icon = CATEGORY_ICONS[category];
  const stroke = Math.max(3, Math.round(size / 18));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = state === 'earned' ? 1 : state === 'progress' ? Math.min(1, Math.max(0.04, ratio)) : 0;

  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        {/* Fondo del anillo */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="hsl(var(--background))" stroke="hsl(var(--primary) / 0.22)" strokeWidth={stroke} />
        {/* Avance (o anillo completo si ya se consiguió) */}
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * filled} ${circumference}`}
          />
        )}
      </svg>
      {state === 'earned' && <span className="absolute inset-[18%] rounded-full bg-primary/15" />}
      <Icon
        className={cn('relative', state === 'muted' ? 'text-muted-foreground/60' : state === 'idle' ? 'text-foreground/70' : 'text-foreground')}
        style={{ width: size * 0.4, height: size * 0.4 }}
        strokeWidth={1.75}
      />
    </span>
  );
};

export default AchievementBadge;
