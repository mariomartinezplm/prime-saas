import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Briefcase, Mail, TriangleAlert, User, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { IS_APP_HOST, PUBLIC_SITE_URL } from '@/config/host';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuthLayout from '@/components/auth/AuthLayout';
import { FormField } from '@/components/forms/FormField';
import PasswordField from '@/components/forms/PasswordField';
import SubmitButton from '@/components/forms/SubmitButton';
import { getErrorMessage } from '@/lib/apiError';
import { isEmail } from '@/lib/validation';
import { normalizeRut } from '@/lib/rut';
import { cn } from '@/lib/utils';

type Kind = 'patient' | 'staff';
type Method = 'email' | 'rut';

const RUT_PATTERN = /^\d{7,8}-[\dK]$/;

interface CredentialsFormProps {
  kind: Kind;
}

// Un mismo formulario para paciente y personal: cambian el texto y que el paciente puede entrar con RUT.
const CredentialsForm = ({ kind }: CredentialsFormProps) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const [method, setMethod] = useState<Method>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const isRut = kind === 'patient' && method === 'rut';
  const identifierLabel = isRut ? 'RUT' : kind === 'staff' ? 'Correo corporativo' : 'Correo electrónico';

  const changeMethod = (next: Method) => {
    setMethod(next);
    setIdentifier('');
    setErrors({});
    setFormError(undefined);
  };

  const validate = () => {
    const found: { identifier?: string; password?: string } = {};
    const value = identifier.trim();
    if (!value) found.identifier = isRut ? 'Ingresa tu RUT' : 'Ingresa tu correo';
    else if (isRut && !RUT_PATTERN.test(normalizeRut(value))) found.identifier = 'RUT inválido. Ejemplo: 12345678-9';
    else if (!isRut && !isEmail(value)) found.identifier = 'Revisa el correo: parece incompleto';
    if (!password) found.password = 'Ingresa tu contraseña';
    return found;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const found = validate();
    setErrors(found);
    setFormError(undefined);
    if (found.identifier || found.password) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const loggedUser = await login({ identifier: isRut ? normalizeRut(identifier) : identifier.trim(), password });
      // Sin aviso de bienvenida: la pantalla con el logo y el panel que se abre ya lo dicen
      // SEGURIDAD (Paso 10 de BLUEPRINT.md): el redirect se decide por el rol que de verdad devolvió el
      // backend, no por la pestaña usada para entrar.
      navigate(loggedUser.role === 'patient' ? '/app/dashboard' : '/app/admin');
    } catch (err: unknown) {
      // Mensaje en el formulario (no solo un aviso que desaparece): incluye el bloqueo por demasiados intentos.
      setFormError(getErrorMessage(err, 'No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        {kind === 'patient' ? 'Ingresa con tu correo o tu RUT' : 'Acceso exclusivo para el equipo'}
      </p>

      {formError && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {kind === 'patient' && (
        <div role="group" aria-label="Ingresar con" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['email', 'rut'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => changeMethod(m)}
              className={cn(
                'min-h-9 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                method === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'email' ? 'Correo' : 'RUT'}
            </button>
          ))}
        </div>
      )}

      <FormField
        label={identifierLabel}
        required
        error={errors.identifier}
        hint={isRut ? 'Sin puntos y con guión, por ejemplo 12345678-9' : undefined}
      >
        {(c) => (
          <div className="relative">
            {isRut ? (
              <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            ) : (
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              {...c}
              type={isRut ? 'text' : 'email'}
              inputMode={isRut ? 'text' : 'email'}
              autoComplete={isRut ? 'username' : 'email'}
              autoCapitalize="none"
              placeholder={isRut ? '12345678-9' : kind === 'staff' ? 'tu@primefh.cl' : 'tu@correo.com'}
              value={identifier}
              onChange={(e) => {
                setIdentifier(isRut ? normalizeRut(e.target.value) : e.target.value);
                setErrors((p) => ({ ...p, identifier: undefined }));
              }}
              disabled={loading}
              className="pl-10"
            />
          </div>
        )}
      </FormField>

      <PasswordField
        label="Contraseña"
        required
        autoComplete="current-password"
        placeholder="Tu contraseña"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setErrors((p) => ({ ...p, password: undefined }));
        }}
        error={errors.password}
        disabled={loading}
      />

      <SubmitButton className="w-full" loading={loading} loadingLabel="Ingresando…">
        {kind === 'patient' ? 'Ingresar al portal' : 'Acceder al panel'}
      </SubmitButton>

      {kind === 'patient' && (
        <div className="space-y-2 text-center">
          <Link to="/recuperar-contrasena" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <p className="text-xs text-muted-foreground">
            ¿Primera vez aquí? Tu profesional te envía la invitación para crear tu acceso.
          </p>
        </div>
      )}
    </form>
  );
};

const LoginDual = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState('paciente');

  // Va después de todos los hooks: un return antes cambia la cantidad de hooks entre
  // renders y React se cae (error #300) justo al iniciar sesión.
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'patient' ? '/app/dashboard' : '/app/admin'} replace />;
  }

  return (
    <AuthLayout
      title="Portal Prime F&H"
      subtitle="Accede a tu cuenta"
      footer={
        <>
          <Link to="/instalar" className="block font-medium text-foreground underline-offset-4 hover:underline">
            Instalar la app en mi celular
          </Link>
          {IS_APP_HOST ? (
            <a href={PUBLIC_SITE_URL} className="block text-muted-foreground hover:text-foreground">
              ← Volver al sitio
            </a>
          ) : (
            <Button variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => navigate('/')}>
              ← Volver al sitio
            </Button>
          )}
        </>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-5 grid w-full grid-cols-2">
          <TabsTrigger value="paciente" className="gap-2">
            <UserCircle aria-hidden="true" className="h-4 w-4" />
            Paciente
          </TabsTrigger>
          <TabsTrigger value="personal" className="gap-2">
            <Briefcase aria-hidden="true" className="h-4 w-4" />
            Personal
          </TabsTrigger>
        </TabsList>

        {/* forceMount: al cambiar de pestaña no se pierde lo que ya se escribió */}
        <TabsContent value="paciente" forceMount className="mt-0 data-[state=inactive]:hidden">
          <CredentialsForm kind="patient" />
        </TabsContent>
        <TabsContent value="personal" forceMount className="mt-0 data-[state=inactive]:hidden">
          <CredentialsForm kind="staff" />
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
};

export default LoginDual;
