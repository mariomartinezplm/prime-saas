import { cn } from '@/lib/utils';

// Qué significa el fondo del calendario (solo se muestra si el profesional tiene horario configurado)
const AvailabilityLegend = ({ className }: { className?: string }) => (
  <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground', className)} aria-label="Leyenda de disponibilidad">
    <li className="flex items-center gap-1.5">
      <span className="h-2.5 w-4 rounded-sm bg-primary/25" aria-hidden="true" />
      Horas en que atiendes
    </li>
    <li className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-4 rounded-sm"
        style={{ background: 'repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.5) 0 2px, transparent 2px 4px)' }}
        aria-hidden="true"
      />
      Bloqueado
    </li>
  </ul>
);

export default AvailabilityLegend;
