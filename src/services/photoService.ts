import api from '../lib/api';
import type { ProgressPhoto, PhotoPosition, PhotoVisibility, APIResponse } from '../types';

export const photoService = {
  getPatientPhotos: async (patientId: string): Promise<ProgressPhoto[]> => {
    const response = await api.get<APIResponse<ProgressPhoto[]>>(`/photos/patient/${patientId}`);
    return response.data.data;
  },

  upload: async (
    patientId: string,
    file: File,
    meta: { position: PhotoPosition; takenAt: string; note?: string; visibility?: PhotoVisibility }
  ): Promise<void> => {
    const form = new FormData();
    form.append('position', meta.position);
    form.append('takenAt', meta.takenAt);
    if (meta.note) form.append('note', meta.note);
    if (meta.visibility) form.append('visibility', meta.visibility);
    // El archivo va al final: así el servidor ya leyó los campos cuando llega la foto
    form.append('file', file);

    await api.post(`/photos/patient/${patientId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: async (
    photoId: string,
    data: Partial<{ position: PhotoPosition; takenAt: string; note: string; visibility: PhotoVisibility }>
  ): Promise<ProgressPhoto> => {
    const response = await api.put<APIResponse<ProgressPhoto>>(`/photos/${photoId}`, data);
    return response.data.data;
  },

  remove: async (photoId: string): Promise<void> => {
    await api.delete(`/photos/${photoId}`);
  },
};
