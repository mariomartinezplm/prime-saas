import { useRef, useState } from 'react';
import PasswordField from '@/components/forms/PasswordField';
import SubmitButton from '@/components/forms/SubmitButton';

export const MIN_PASSWORD_LENGTH = 8;

interface SetPasswordFormProps {
  newLabel?: string;
  submitLabel: string;
  loadingLabel: string;
  // Guarda la contraseña. Quien la usa maneja sus propios errores (avisos, link vencido…).
  onSubmit: (password: string) => Promise<void>;
}

// Elegir contraseña (activar cuenta y restablecerla): mismas reglas y mismos mensajes en ambos casos.
const SetPasswordForm = ({ newLabel = 'Contraseña', submitLabel, loadingLabel, onSubmit }: SetPasswordFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const found = {
      password: password.length < MIN_PASSWORD_LENGTH ? `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres` : undefined,
      confirm: !confirm ? 'Repite la contraseña' : confirm !== password ? 'Las contraseñas no coinciden' : undefined,
    };
    if (found.password || found.confirm) {
      setErrors(found);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await onSubmit(password);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <PasswordField
        label={newLabel}
        required
        autoComplete="new-password"
        hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        value={password}
        onChange={(v) => {
          setPassword(v);
          setErrors((p) => ({ ...p, password: undefined }));
        }}
        error={errors.password}
        disabled={loading}
      />
      <PasswordField
        label="Confirmar contraseña"
        required
        autoComplete="new-password"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          setErrors((p) => ({ ...p, confirm: undefined }));
        }}
        error={errors.confirm}
        disabled={loading}
      />
      <SubmitButton className="w-full" loading={loading} loadingLabel={loadingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
};

export default SetPasswordForm;
