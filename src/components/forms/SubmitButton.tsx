import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  loading?: boolean;
  loadingLabel?: string;
}

// Botón de envío: mientras se guarda queda bloqueado (evita el doble envío) y lo dice.
const SubmitButton = ({ loading, loadingLabel = 'Guardando…', children, disabled, ...props }: SubmitButtonProps) => (
  <Button type="submit" disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    {loading ? loadingLabel : children}
  </Button>
);

export default SubmitButton;
