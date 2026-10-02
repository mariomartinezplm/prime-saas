import api from '../lib/api';
import type { ClientFile, FileDownloadLink, APIResponse } from '../types';

export const fileService = {
  getPatientFiles: async (patientId: string): Promise<ClientFile[]> => {
    const response = await api.get<APIResponse<ClientFile[]>>(`/files/patient/${patientId}`);
    return response.data.data;
  },

  upload: async (
    patientId: string,
    file: File,
    meta: { fileName?: string; description?: string }
  ): Promise<ClientFile> => {
    const form = new FormData();
    form.append('file', file);
    if (meta.fileName) form.append('fileName', meta.fileName);
    if (meta.description) form.append('description', meta.description);

    const response = await api.post<APIResponse<ClientFile>>(`/files/patient/${patientId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  // URL firmada que vence a los 5 minutos: se pide al momento de abrir, nunca se guarda
  getDownloadLink: async (fileId: string): Promise<FileDownloadLink> => {
    const response = await api.get<APIResponse<FileDownloadLink>>(`/files/${fileId}/download`);
    return response.data.data;
  },

  remove: async (fileId: string): Promise<void> => {
    await api.delete(`/files/${fileId}`);
  },
};
