import api from '../lib/api';
import type { APIResponse } from '../types';

// Integración de Google Calendar para staff (Paso 28.A de BLUEPRINT.md). El
// flujo OAuth completo (auth-url → Google → callback) vive fuera de axios: la
// redirección a Google la hace el navegador con window.location, no un fetch.
export const googleCalendarService = {
  getAuthUrl: async (): Promise<string> => {
    const response = await api.get<APIResponse<{ authUrl: string }>>('/google-calendar/auth-url');
    return response.data.data.authUrl;
  },

  handleCallback: async (code: string, state: string): Promise<void> => {
    await api.post('/google-calendar/callback', { code, state });
  },

  disconnect: async (): Promise<void> => {
    await api.post('/google-calendar/disconnect');
  },

  getStatus: async (): Promise<boolean> => {
    const response = await api.get<APIResponse<{ connected: boolean }>>('/google-calendar/status');
    return response.data.data.connected;
  },

  sync: async (appointmentId: string): Promise<void> => {
    await api.post(`/google-calendar/sync/${appointmentId}`);
  },
};
