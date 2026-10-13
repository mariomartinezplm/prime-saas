import { useEffect, useRef, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PasswordField from '@/components/forms/PasswordField';
import SubmitButton from '@/components/forms/SubmitButton';
import { MIN_PASSWORD_LENGTH } from '@/components/auth/SetPasswordForm';
import { DetailList, DetailRow } from '@/components/patients/DetailList';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingState from '@/components/shared/LoadingState';
import LoadErrorAlert from '@/components/shared/LoadErrorAlert';
import PageHeader from '@/components/shared/PageHeader';
import { getErrorMessage } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { useSavedFlash } from '@/hooks/useSavedFlash';

const roleLabels = { admin: 'Administrador', professional: 'Profesional', patient: 'Paciente' } as const;

type PasswordErrors = { current?: string; next?: string; confirm?: string };

const ChangePasswordCard = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [loading, setLoading] = useState(false);
  const [saved, flash] = useSavedFlash();

  const clear = (field: keyof PasswordErrors) => setErrors((p) => ({ ...p, [field]: undefined }));
  const focusFirstInvalid = () =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const found: PasswordErrors = {};
    if (!current) found.current = 'Ingresa tu contraseña actual';
    if (next.length < MIN_PASSWORD_LENGTH) found.next = `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres`;
    else if (next === current) found.next = 'La nueva contraseña debe ser distinta de la actual';
    if (!confirm) found.confirm = 'Repite la nueva contraseña';
    else if (confirm !== next) found.confirm = 'Las contraseñas no coinciden';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstInvalid();
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await authService.changePassword(current, next);
      // El propio botón confirma ('Contraseña actualizada ✓'): sin aviso aparte que repita lo mismo
      flash();
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'No se pudo cambiar la contraseña. Intenta de nuevo.');
      // Si el servidor dice que la actual no coincide, el error va en ese campo (y se conserva lo demás)
      if (/actual|incorrect/i.test(message)) {
        setErrors({ current: 'La contraseña actual no es correcta' });
        focusFirstInvalid();
      } else {
        notify.error(message);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <PasswordField
            label="Contraseña actual"
            required
            autoComplete="current-password"
            value={current}
            onChange={(v) => {
              setCurrent(v);
              clear('current');
            }}
            error={errors.current}
            disabled={loading}
          />
          <PasswordField
            label="Nueva contraseña"
            required
            autoComplete="new-password"
            hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            value={next}
            onChange={(v) => {
              setNext(v);
              clear('next');
            }}
            error={errors.next}
            disabled={loading}
          />
          <PasswordField
            label="Confirmar nueva contraseña"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              clear('confirm');
            }}
            error={errors.confirm}
            disabled={loading}
          />
          <SubmitButton className="w-full sm:w-auto" loading={loading} loadingLabel="Cambiando…" success={saved} successLabel="Contraseña actualizada">
            Cambiar contraseña
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
};

const GoogleCalendarCard = () => {
  // null = todavía consultando; 'error' = no se pudo saber (no se muestra "Conectar" como si fuera cierto)
  const [status, setStatus] = useState<boolean | 'error' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const loadStatus = () => {
    setStatus(null);
    googleCalendarService
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus('error'));
  };

  useEffect(loadStatus, []);

  const connect = async () => {
    setBusy(true);
    try {
      window.location.href = await googleCalendarService.getAuthUrl();
    } catch (err) {
      notify.error(getErrorMessage(err, 'No se pudo iniciar la conexión con Google Calendar'));
      setBusy(false);
    }
  };

  // El diálogo de confirmación queda abierto y bloqueado mientras el servidor responde; si falla, muestra el error
  const disconnect = async () => {
    try {
      await googleCalendarService.disconnect();
      setStatus(false);
      notify.success('Google Calendar desconectado');
    } catch (err) {
      notify.error(getErrorMessage(err, 'No se pudo desconectar Google Calendar'));
      throw err;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarCheck2 aria-hidden="true" className="h-5 w-5 text-secondary" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Conecta tu cuenta de Google para sincronizar tus citas con tu calendario personal.
        </p>
        {status === null ? (
          <LoadingState label="Consultando el estado…" className="py-2" />
        ) : status === 'error' ? (
          <LoadErrorAlert message="No pudimos comprobar si está conectado." onRetry={loadStatus} />
        ) : status ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-success">Conectado</span>
            <ActionButton busy={busy} onClick={() => setConfirmingDisconnect(true)} label="Desconectar" busyLabel="Desconectando…" variant="outline" />
          </div>
        ) : (
          <ActionButton busy={busy} onClick={connect} label="Conectar Google Calendar" busyLabel="Conectando…" />
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmingDisconnect}
        onOpenChange={setConfirmingDisconnect}
        title="¿Desconectar Google Calendar?"
        description="Tus próximas citas dejarán de sincronizarse con tu calendario de Google. Las citas que ya están en tu calendario no se borran, y puedes volver a conectarlo cuando quieras."
        confirmLabel="Desconectar"
        onConfirm={disconnect}
      />
    </Card>
  );
};

// Botón de acción (no envía formulario) que se bloquea y avisa mientras trabaja.
const ActionButton = ({
  busy,
  onClick,
  label,
  busyLabel,
  variant,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
  busyLabel: string;
  variant?: 'outline';
}) => (
  <Button size="sm" variant={variant} onClick={onClick} disabled={busy} aria-busy={busy || undefined}>
    {busy ? busyLabel : label}
  </Button>
);

const Settings = () => {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'professional';

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Configuración" description="Administra tu cuenta" />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información de la cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailRow label="Nombre">
              {user?.firstName} {user?.lastName}
            </DetailRow>
            <DetailRow label="Correo">{user?.email}</DetailRow>
            <DetailRow label="Rol">{user ? roleLabels[user.role] : undefined}</DetailRow>
            {user?.rut && <DetailRow label="RUT">{user.rut}</DetailRow>}
          </DetailList>
        </CardContent>
      </Card>

      <ChangePasswordCard />

      {isStaff && <GoogleCalendarCard />}
    </div>
  );
};

export default Settings;
