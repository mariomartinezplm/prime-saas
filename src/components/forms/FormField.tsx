import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  required?: boolean;
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  // Ayuda bajo el campo (se oculta si hay error)
  hint?: ReactNode;
  // Mensaje de error del campo; si existe, el campo se marca como inválido
  error?: string;
  className?: string;
  // Recibe las propiedades de accesibilidad que hay que pasarle al control (id, aria-*)
  children: (control: FieldControlProps) => ReactNode;
}

// Etiqueta + control + ayuda + error, conectados entre sí (id, aria-invalid, aria-describedby):
// un lector de pantalla anuncia la etiqueta y el error del campo, y tocar la etiqueta enfoca el campo.
export const FormField = ({ label, required, hint, error, className, children }: FormFieldProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-destructive">
              {' '}
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        )}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  unit?: string;
  step?: string;
  className?: string;
}

// Campo numérico de los registros clínicos: acepta coma o punto decimal y no cambia el valor con la rueda del ratón.
export const NumberField = ({ label, value, onChange, error, unit, step = '0.1', className }: NumberFieldProps) => (
  <FormField label={unit ? `${label} (${unit})` : label} error={error} className={className}>
    {(control) => (
      <Input
        {...control}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
        className={cn(error && 'border-destructive')}
      />
    )}
  </FormField>
);
