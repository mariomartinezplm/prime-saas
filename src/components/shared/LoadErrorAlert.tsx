import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LoadErrorAlertProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

// Aviso único para "no se pudo cargar": dice qué falló y deja reintentar. Un fallo de carga nunca debe
// verse como "no hay datos".
const LoadErrorAlert = ({ message, onRetry, className }: LoadErrorAlertProps) => (
  <Alert variant="warning" className={className}>
    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </AlertDescription>
  </Alert>
);

export default LoadErrorAlert;
