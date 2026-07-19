import { toast } from 'sonner';
import { getWhatsAppUrl } from '@/config/contact';

interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
      code?: string;
    };
  };
}

const PLAN_EXPIRED_CODE = 'NO_ACTIVE_PLAN_SESSIONS';

export function getErrorMessage(err: unknown, fallback: string): string {
  const error = err as ApiErrorResponse;
  return error.response?.data?.message || fallback;
}

// Muestra el error en un toast; si es específicamente por plan vencido/sin sesiones,
// agrega un botón directo a WhatsApp para renovar.
export function showApiError(err: unknown, fallback: string) {
  const error = err as ApiErrorResponse;
  const message = error.response?.data?.message || fallback;

  if (error.response?.data?.code === PLAN_EXPIRED_CODE) {
    toast.error(message, {
      action: {
        label: 'Renovar por WhatsApp',
        onClick: () => window.open(getWhatsAppUrl('Hola, quiero renovar mi plan en Prime F&H'), '_blank'),
      },
    });
    return;
  }

  toast.error(message);
}
