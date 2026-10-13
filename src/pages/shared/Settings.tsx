import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { wellnessService, type ReadinessReminder } from '@/services/wellnessService';
import { disablePush, enablePush, getPushStatus, hasLocalSubscription, pushPermission, pushSupport } from '@/lib/push';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Recordatorio diario del Readiness. Es un aviso DENTRO de la app (campanita), no una notificación del
// celular. Cada cambio se confirma con el servidor antes de mostrarse como guardado.
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 a 23:00
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

const ReadinessReminderCard = () => {
  const [reminder, setReminder] = useState<ReadinessReminder | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    wellnessService
      .getReminder()
      .then(setReminder)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (changes: Partial<ReadinessReminder>) => {
    if (saving) return;
    setSaving(true);
    try {
      setReminder(await wellnessService.updateReminder(changes));
      notify.success(changes.enabled === false ? 'Recordatorio desactivado' : 'Recordatorio guardado');
    } catch (err) {
      notify.error(getErrorMessage(err, 'No se pudo guardar el recordatorio. Intenta de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recordatorio del Readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Te avisamos una vez al día, dentro de la app, para que completes tu Readiness. Si ya lo hiciste, no te avisamos.
          Es un aviso de la campanita: no es una notificación del celular.
        </p>
        {reminder === null && !failed ? (
          <LoadingState label="Cargando tu preferencia…" className="py-4" />
        ) : failed || reminder === null ? (
          <LoadErrorAlert message="No pudimos cargar tu preferencia." onRetry={load} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="readiness-reminder-enabled" className="cursor-pointer">
                Recibir el recordatorio
              </Label>
              <Switch
                id="readiness-reminder-enabled"
                checked={reminder.enabled}
                disabled={saving}
                onCheckedChange={(enabled) => change({ enabled })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="readiness-reminder-hour">Hora del aviso (hora de Chile)</Label>
              <Select
                value={String(reminder.hour)}
                disabled={saving || !reminder.enabled}
                onValueChange={(value) => change({ hour: Number(value) })}
              >
                <SelectTrigger id="readiness-reminder-hour" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {hourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Notificaciones del DISPOSITIVO (push). Distintas de la campanita: llegan aunque la app esté cerrada, solo si
// el servidor las tiene configuradas, el navegador las permite y la persona las activa en ESTE dispositivo.
type PushState =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'needs-install' }
  | { kind: 'not-configured' }
  | { kind: 'blocked' }
  | { kind: 'off'; publicKey: string }
  | { kind: 'on' }
  | { kind: 'error' };

const PushNotificationsCard = () => {
  const [state, setState] = useState<PushState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const support = pushSupport();
    if (support === 'unsupported') return setState({ kind: 'unsupported' });
    if (support === 'needs-install') return setState({ kind: 'needs-install' });
    try {
      const status = await getPushStatus();
      if (!status.configured || !status.publicKey) return setState({ kind: 'not-configured' });
      if (pushPermission() === 'denied') return setState({ kind: 'blocked' });
      if (await hasLocalSubscription()) return setState({ kind: 'on' });
      setState({ kind: 'off', publicKey: status.publicKey });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const turnOn = async (publicKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enablePush(publicKey);
      if (result === 'denied') setState({ kind: 'blocked' });
      else {
        setState({ kind: 'on' });
        notify.success('Notificaciones activadas en este dispositivo');
      }
    } catch (err) {
      notify.error(getErrorMessage(err, 'No se pudieron activar las notificaciones. Intenta de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disablePush();
      await load();
      notify.success('Notificaciones desactivadas en este dispositivo');
    } catch (err) {
      notify.error(getErrorMessage(err, 'No se pudieron desactivar las notificaciones. Intenta de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notificaciones en este dispositivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Recibe en tu celular o computador el recordatorio del Readiness y el aviso de tus logros, aunque la app esté cerrada.
          Los avisos llevan un texto general, sin datos de salud, porque pueden verse con la pantalla bloqueada.
        </p>

        {state.kind === 'loading' && <LoadingState label="Comprobando este dispositivo…" className="py-4" />}

        {state.kind === 'error' && <LoadErrorAlert message="No pudimos comprobar las notificaciones." onRetry={load} />}

        {state.kind === 'unsupported' && (
          <p className="text-sm text-muted-foreground">Este navegador no permite notificaciones del dispositivo. La campanita de la app sigue funcionando.</p>
        )}

        {state.kind === 'needs-install' && (
          <p className="text-sm text-muted-foreground">
            En iPhone y iPad las notificaciones solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o superior).{' '}
            <Link to="/instalar" className="font-medium text-primary underline-offset-4 hover:underline">
              Ver cómo instalarla
            </Link>
            .
          </p>
        )}

        {state.kind === 'not-configured' && (
          <p className="text-sm text-muted-foreground">Las notificaciones del dispositivo todavía no están disponibles. La campanita de la app sigue funcionando.</p>
        )}

        {state.kind === 'blocked' && (
          <p className="text-sm text-muted-foreground">
            Las notificaciones están bloqueadas en este navegador. Para activarlas, permítelas desde la configuración del sitio en tu navegador y vuelve aquí.
          </p>
        )}

        {state.kind === 'off' && (
          <Button size="sm" onClick={() => turnOn(state.publicKey)} disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'Activando…' : 'Activar en este dispositivo'}
          </Button>
        )}

        {state.kind === 'on' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Activadas en este dispositivo</span>
            <Button size="sm" variant="outline" onClick={turnOff} disabled={busy} aria-busy={busy || undefined}>
              {busy ? 'Desactivando…' : 'Desactivar'}
            </Button>
          </div>
        )}
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

      {user?.role === 'patient' && <ReadinessReminderCard />}

      {user?.role === 'patient' && <PushNotificationsCard />}

      {isStaff && <GoogleCalendarCard />}
    </div>
  );
};

export default Settings;
