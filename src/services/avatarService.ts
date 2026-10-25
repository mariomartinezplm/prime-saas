import api from '../lib/api';
import type { APIResponse } from '../types';

// Foto de perfil de la propia cuenta (siempre la persona con la sesión abierta; nunca se manda un id)
export const avatarService = {
  upload: async (photo: Blob): Promise<string> => {
    const form = new FormData();
    form.append('file', photo, 'perfil.jpg');
    const response = await api.put<APIResponse<{ avatarUpdatedAt: string }>>('/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.avatarUpdatedAt;
  },

  remove: async (): Promise<void> => {
    await api.delete('/avatar');
  },

  // La foto es privada: se pide con la sesión y se muestra como data: (la política de seguridad de la app no permite blob:)
  fetchDataUrl: async (): Promise<string> => {
    const response = await api.get<Blob>('/avatar', { responseType: 'blob' });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(response.data);
    });
  },
};
