import api from '../lib/api';
import type { APIResponse, SlotClosure } from '../types';

// «Cerrar horario»: el profesional deja de recibir pacientes NUEVOS en una hora de un día; los que ya están se mantienen.
export const slotClosureService = {
  // Horas cerradas desde hoy
  list: async (professionalId: string): Promise<SlotClosure[]> => {
    const response = await api.get<APIResponse<{ closures: SlotClosure[] }>>(`/slot-closures/professional/${professionalId}`);
    return response.data.data.closures;
  },

  close: async (professionalId: string, data: { date: string; startTime: string }): Promise<SlotClosure> => {
    const response = await api.post<APIResponse<{ closure: SlotClosure }>>(`/slot-closures/professional/${professionalId}`, data);
    return response.data.data.closure;
  },

  reopen: async (id: string): Promise<void> => {
    await api.delete(`/slot-closures/${id}`);
  },
};
