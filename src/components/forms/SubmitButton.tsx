import { Check, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  loading?: boolean;
  loadingLabel?: string;
  // Verdadero unos segundos después de que el servidor confirmó el guardado (ver useSavedFlash)
  success?: boolean;
  successLabel?: string;
}

// Botón de envío con sus estados: normal → guardando (bloqueado, evita el doble envío) → guardado ✓.
// El texto de cada estado cambia, así que no depende solo del color o del icono, y una región oculta
// lo anuncia a los lectores de pantalla.
const SubmitButton = ({
  loading,
  loadingLabel = 'Guardando…',
  success,
  successLabel = 'Guardado',
  children,
  disabled,
  ...props
}: SubmitButtonProps) => (
  <>
    <Button type="submit" disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {!loading && success && <Check aria-hidden="true" />}
      {loading ? loadingLabel : success ? successLabel : children}
    </Button>
    {/* Fuera del botón para no cambiar su nombre accesible */}
    <span role="status" aria-live="polite" className="sr-only">
      {success ? successLabel : ''}
    </span>
  </>
);

export default SubmitButton;
