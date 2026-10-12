import type { ReactNode } from 'react';
import { toast, type ExternalToast } from 'sonner';

type NotifyType = 'success' | 'error' | 'warning' | 'info';

// Los errores y avisos duran más: hay que alcanzar a leerlos.
const DURATION: Record<NotifyType, number> = { success: 4000, info: 4000, warning: 6000, error: 7000 };

// Un mismo mensaje no se apila: si ya está en pantalla se reemplaza (mismo id), así un doble
// clic o un reintento rápido no llena la pantalla de avisos idénticos.
const show = (type: NotifyType, message: ReactNode, options?: ExternalToast) =>
  toast[type](message, {
    id: typeof message === 'string' ? `${type}:${message}` : undefined,
    duration: DURATION[type],
    ...options,
  });

// Canal único de avisos de la app: éxito, error, atención, información y carga.
// Regla de uso: "éxito" solo después de que la operación terminó de verdad (tras el await).
export const notify = {
  success: (message: ReactNode, options?: ExternalToast) => show('success', message, options),
  error: (message: ReactNode, options?: ExternalToast) => show('error', message, options),
  warning: (message: ReactNode, options?: ExternalToast) => show('warning', message, options),
  info: (message: ReactNode, options?: ExternalToast) => show('info', message, options),
  loading: toast.loading,
  dismiss: toast.dismiss,
  promise: toast.promise,
};
