import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FounderBadgeProps {
  // Solo la estrella (para espacios chicos)
  compact?: boolean;
  // 'brand': paleta PRIME (crema y turquesa) para el dashboard del paciente; por defecto, el estilo de siempre
  tone?: 'default' | 'brand';
  className?: string;
}

// Miembro Fundador: lo marca el administrador
const FounderBadge = ({ compact, tone = 'default', className }: FounderBadgeProps) => (
  <span
    title="Miembro Fundador"
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium align-middle',
      tone === 'brand' ? 'border-[#fff8e4]/40 bg-[#fff8e4]/10 text-[#fff8e4]' : 'border-coral/40 bg-coral/15 text-coral',
      className
    )}
  >
    <Star className={cn('h-3 w-3', tone === 'brand' ? 'fill-[#398ca2] text-[#398ca2]' : 'fill-coral')} aria-hidden="true" />
    {!compact && 'Miembro Fundador'}
  </span>
);

export default FounderBadge;
