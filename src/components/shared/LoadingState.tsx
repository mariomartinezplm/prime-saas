import { Loader2 } from 'lucide-react';
import { useSlowLoading } from '@/hooks/useSlowLoading';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const SLOW_LOADING_MESSAGE = 'Está tardando más de lo normal. No cierres la página: seguimos intentando.';

// Carga única: anuncia el estado a lectores de pantalla y no gira si el sistema pide menos movimiento.
// Si pasan unos segundos, avisa que está tardando (en vez de dejar un círculo mudo).
const LoadingState = ({ label = 'Cargando…', className }: LoadingStateProps) => {
  const slow = useSlowLoading();
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground', className)}>
      <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-sm">{label}</span>
      {slow && <span className="max-w-xs text-center text-xs">{SLOW_LOADING_MESSAGE}</span>}
    </div>
  );
};

export default LoadingState;
