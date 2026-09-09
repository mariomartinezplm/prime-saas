import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CalendarCheck2 } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'professional';
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    googleCalendarService
      .getStatus()
      .then(setGcalConnected)
      .catch(() => setGcalConnected(false));
  }, [isStaff]);

  const handleConnectGoogle = async () => {
    setGcalLoading(true);
    try {
      const authUrl = await googleCalendarService.getAuthUrl();
      window.location.href = authUrl;
    } catch {
      toast.error('Error al iniciar la conexión con Google Calendar');
      setGcalLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGcalLoading(true);
    try {
      await googleCalendarService.disconnect();
      setGcalConnected(false);
      toast.success('Google Calendar desconectado');
    } catch {
      toast.error('Error al desconectar Google Calendar');
    } finally {
      setGcalLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Contraseña actualizada exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Error al cambiar contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground">Administra tu cuenta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar Contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Contraseña actual</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Nueva contraseña</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cambiando...
                </>
              ) : (
                'Cambiar contraseña'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rol</span>
            <span className="font-medium capitalize">
              {user?.role === 'admin' ? 'Administrador' : user?.role === 'professional' ? 'Profesional' : 'Paciente'}
            </span>
          </div>
          {user?.rut && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">RUT</span>
              <span className="font-medium">{user.rut}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {isStaff && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 text-secondary" />
              Google Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecta tu cuenta de Google para sincronizar tus citas con tu calendario personal.
            </p>
            {gcalConnected === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : gcalConnected ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-500 font-medium">Conectado</span>
                <Button variant="outline" size="sm" onClick={handleDisconnectGoogle} disabled={gcalLoading}>
                  {gcalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleConnectGoogle} disabled={gcalLoading}>
                {gcalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Conectar Google Calendar
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
