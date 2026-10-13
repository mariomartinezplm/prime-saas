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

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [inviteInvalid, setInviteInvalid] = useState(false);

  const whatsappUrl = getWhatsAppUrl('Hola, mi link de invitación a Prime F&H no funciona. ¿Me pueden ayudar a entrar?');

  const activate = async (password: string) => {
    try {
      const response = await authService.acceptInvite(token!, password);
      updateUser(response.data.user);
      notify.success('Cuenta activada. ¡Bienvenido a Prime F&H!');
      // El redirect se decide por el rol real, mismo criterio que LoginDual.tsx
      navigate(response.data.user.role === 'patient' ? '/app/dashboard' : '/app/admin');
    } catch (err: unknown) {
      // Solo el código específico del backend significa "el link ya no sirve". Cualquier otro error
      // (un 500 puntual, sin red) se queda en el formulario con un aviso, sin perder lo escrito.
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'INVITE_EXPIRED') setInviteInvalid(true);
      else notify.error(getErrorMessage(err, 'No se pudo activar la cuenta. Intenta de nuevo.'));
    }
  };

  if (inviteInvalid) {
    return (
      <AuthLayout title="Invitación no válida" subtitle="Este link ya se usó o venció">
        <LinkProblem
          message="Tu invitación ya fue usada o expiró (los links duran 7 días)."
          help="Contacta a Prime F&H para que te reenvíen la invitación."
          whatsappUrl={whatsappUrl}
        >
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
    <AuthLayout title="Crea tu contraseña" subtitle="Activa tu acceso al portal de Prime F&H">
      <SetPasswordForm submitLabel="Activar mi cuenta" loadingLabel="Activando…" onSubmit={activate} />
    </AuthLayout>
  );
};

export default AcceptInvite;
