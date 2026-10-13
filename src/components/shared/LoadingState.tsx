import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

// Carga única: anuncia el estado a lectores de pantalla y no gira si el sistema pide menos movimiento.
const LoadingState = ({ label = 'Cargando…', className }: LoadingStateProps) => (
  <div role="status" aria-live="polite" className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground', className)}>
    <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <span className="text-sm">{label}</span>
  </div>
);

export default LoadingState;
