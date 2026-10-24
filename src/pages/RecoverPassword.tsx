import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthLayout from '@/components/auth/AuthLayout';
import { FormField } from '@/components/forms/FormField';
import SubmitButton from '@/components/forms/SubmitButton';
import { getWhatsAppUrl } from '@/config/contact';
import { authService } from '@/services/authService';
import { isEmail } from '@/lib/validation';

/**
 * Recuperación de contraseña (Paso 13 de BLUEPRINT.md): pide el correo y el servidor envía el link.
 * El WhatsApp queda como red de seguridad por si el correo nunca llega.
 */
const RecoverPassword = () => {
  const submittingRef = useRef(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const whatsappUrl = getWhatsAppUrl(
    'Hola, solicité restablecer mi contraseña de Prime F&H pero no me llegó el correo. ¿Me pueden ayudar?'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const value = email.trim();
    if (!value) return setError('Ingresa tu correo');
    if (!isEmail(value)) return setError('Revisa el correo: parece incompleto');

    submittingRef.current = true;
    setIsLoading(true);
    try {
      // El backend SIEMPRE responde 200 genérico (exista o no el email): no revela qué correos están registrados.
      await authService.forgotPassword(value);
    } catch {
      // Falla de red/servidor: se muestra igual el mensaje genérico, mismo criterio que el backend.
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout title="Recuperar acceso" subtitle="Te ayudamos a volver a entrar a tu cuenta">
      {sent ? (
        <div className="space-y-4" role="status">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <MailCheck aria-hidden="true" className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div className="space-y-1 text-center">
            <p className="text-foreground">
              Si <strong className="break-all">{email.trim()}</strong> está registrado, te llegará un correo con instrucciones para
              restablecer tu contraseña.
            </p>
            <p className="text-sm text-muted-foreground">El link es válido por 1 hora. Revisa también spam o promociones.</p>
          </div>

          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">
              <ArrowLeft aria-hidden="true" />
              Volver al inicio de sesión
            </Link>
          </Button>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-center text-xs text-muted-foreground">¿No te llegó el correo?</p>
            <Button asChild variant="outline" className="w-full">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Escribir por WhatsApp
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">Ingresa el correo con el que te registraste.</p>
          <FormField label="Correo electrónico" required error={error}>
            {(c) => (
              <Input
                {...c}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(undefined);
                }}
                disabled={isLoading}
              />
            )}
          </FormField>
          <SubmitButton className="w-full" loading={isLoading} loadingLabel="Enviando…">
            Enviar instrucciones
          </SubmitButton>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">
              <ArrowLeft aria-hidden="true" />
              Volver al inicio de sesión
            </Link>
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default RecoverPassword;
