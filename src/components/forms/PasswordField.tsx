import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  // "current-password" al ingresar, "new-password" al crear o cambiar: el gestor de contraseñas del
  // teléfono sugiere y guarda bien.
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

// Campo de contraseña con candado y botón "mostrar/ocultar" que un lector de pantalla entiende.
// Cada campo controla su propio ojo (antes un solo ojo cambiaba los dos campos a la vez).
const PasswordField = ({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  disabled,
  required,
  className,
}: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <FormField label={label} required={required} error={error} hint={hint} className={className}>
      {(control) => (
        <div className="relative">
          <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            {...control}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="pl-10 pr-11"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            disabled={disabled}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      )}
    </FormField>
  );
};

export default PasswordField;
