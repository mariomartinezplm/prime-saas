import { useId } from 'react';
import type { AchievementCategoryKey } from '@/services/achievementService';
import { CATEGORY_ICONS } from './categoryMeta';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  category: AchievementCategoryKey;
  // earned: hexágono relleno turquesa · progress: el contorno muestra el avance · idle: reto sin avance
  // muted: bloqueado o pendiente
  state: 'earned' | 'progress' | 'idle' | 'muted';
  // 0 a 1; solo se usa en 'progress'
  ratio?: number;
  size?: number;
  className?: string;
}

// Hexágono de punta arriba en una caja de 100 × 112
const HEX = '50,3 96,28 96,84 50,109 4,84 4,28';

// Insignia de PRIME F&H (Visual Polish 3.0): un hexágono con el icono de la categoría. Conseguida: relleno turquesa con
// icono oscuro. En camino: contorno que se completa con el avance. Sin colores fuera de la marca, sin medallas ni estrellas.
const AchievementBadge = ({ category, state, ratio = 0, size = 64, className }: AchievementBadgeProps) => {
  const Icon = CATEGORY_ICONS[category];
  const gradientId = useId();
  const filled = state === 'progress' ? Math.min(1, Math.max(0.04, ratio)) : 0;
  const earned = state === 'earned';

  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size * 1.12 }}
    >
      <svg viewBox="0 0 100 112" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#62b8cf" />
            <stop offset="100%" stopColor="#2b6f82" />
          </linearGradient>
        </defs>
        <polygon
          points={HEX}
          strokeLinejoin="round"
          strokeWidth={earned ? 0 : 4}
          fill={earned ? `url(#${gradientId})` : '#1f1c21'}
          stroke={state === 'muted' ? 'rgba(255,248,228,0.12)' : 'rgba(98,184,207,0.28)'}
        />
        {filled > 0 && (
          <polygon
            points={HEX}
            pathLength={100}
            fill="none"
            stroke="#62b8cf"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${filled * 100} 100`}
          />
        )}
      </svg>
      <Icon
        className={cn('relative', earned ? 'text-[#181619]' : state === 'muted' ? 'text-[#fff8e4]/40' : state === 'idle' ? 'text-[#fff8e4]/70' : 'text-[#62b8cf]')}
        style={{ width: size * 0.4, height: size * 0.4 }}
        strokeWidth={earned ? 2 : 1.75}
      />
    </span>
  );
};

export default AchievementBadge;
