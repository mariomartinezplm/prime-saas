import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { googleCalendarService } from '@/services/googleCalendarService';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

// Google redirige aquí después de que el usuario autoriza (o rechaza) el
// acceso — fuera del layout de la app, es solo una pantalla de tránsito
// (Paso 28.A de BLUEPRINT.md).
const GoogleCalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Conectando con Google Calendar...');
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    const finish = (ok: boolean, msg: string) => {
      setStatus(ok ? 'success' : 'error');
      setMessage(msg);
      setTimeout(() => navigate('/app/configuracion', { replace: true }), 2000);
    };

    if (oauthError) {
      finish(false, 'Cancelaste la conexión con Google Calendar');
      return;
    }

    if (!code || !state) {
      finish(false, 'Faltan parámetros en la respuesta de Google');
      return;
    }

    googleCalendarService
      .handleCallback(code, state)
      .then(() => finish(true, 'Google Calendar conectado exitosamente'))
      .catch((err: unknown) => {
        const error = err as { response?: { data?: { message?: string } } };
        finish(false, error.response?.data?.message || 'Error al conectar Google Calendar');
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 px-4 text-center">
      {status === 'loading' && <Loader2 className="h-10 w-10 animate-spin text-secondary" />}
      {status === 'success' && <CheckCircle2 className="h-10 w-10 text-green-500" />}
      {status === 'error' && <XCircle className="h-10 w-10 text-destructive" />}
      <p className="text-foreground">{message}</p>
    </div>
  );
};

export default GoogleCalendarCallback;
