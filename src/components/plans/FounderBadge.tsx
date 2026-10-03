import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FounderBadgeProps {
  // Solo la estrella (para espacios chicos)
  compact?: boolean;
  className?: string;
}

// Miembro Fundador: pacientes con plan anual
const FounderBadge = ({ compact, className }: FounderBadgeProps) => (
  <span
    title="Miembro Fundador"
    className={cn(
      'inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300 align-middle',
      className
    )}
  >
    <Star className="h-3 w-3 fill-amber-300" />
    {!compact && 'Miembro Fundador'}
  </span>
);

export default FounderBadge;
