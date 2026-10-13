import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/components/auth/AuthLayout';
import LinkProblem from '@/components/auth/LinkProblem';
import SetPasswordForm from '@/components/auth/SetPasswordForm';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/apiError';
import { getWhatsAppUrl } from '@/config/contact';

const ResetPassword = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const whatsappUrl = getWhatsAppUrl('Hola, el link para restablecer mi contraseña de Prime F&H ya no funciona. ¿Me pueden ayudar?');

  const reset = async (password: string) => {
    try {
      const response = await authService.resetPassword(token!, password);
      updateUser(response.data.user);
      notify.success('Contraseña actualizada');
      navigate(response.data.user.role === 'patient' ? '/app/dashboard' : '/app/admin');
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'RESET_TOKEN_INVALID') setTokenInvalid(true);
      else notify.error(getErrorMessage(err, 'No se pudo restablecer la contraseña. Intenta de nuevo.'));
    }
  };

  if (tokenInvalid) {
    return (
      <AuthLayout title="Link no válido" subtitle="Este link de recuperación ya se usó o venció">
        <LinkProblem
          message="Los links de recuperación son de un solo uso y duran solo 10 minutos."
          help="Solicita uno nuevo o escríbenos por WhatsApp."
          whatsappUrl={whatsappUrl}
        >
          <Button asChild className="w-full">
            <Link to="/recuperar-contrasena">Solicitar un nuevo link</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">
              <ArrowLeft aria-hidden="true" />
              Volver al inicio de sesión
            </Link>
          </Button>
        </LinkProblem>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Restablecer contraseña" subtitle="Elige tu nueva contraseña">
      <SetPasswordForm newLabel="Nueva contraseña" submitLabel="Restablecer contraseña" loadingLabel="Guardando…" onSubmit={reset} />
    </AuthLayout>
  );
};

export default ResetPassword;
