import api from '../lib/api';
import type { APIResponse, RecurringSlot, RecurringSlotResult } from '../types';

export const recurringSlotService = {
  // Los horarios fijos de un paciente (sin id = los propios)
  list: async (patientId?: string): Promise<RecurringSlot[]> => {
    const response = await api.get<APIResponse<{ slots: RecurringSlot[] }>>(`/recurring-slots/patient/${patientId ?? 'me'}`);
    return response.data.data.slots;
  },

  create: async (data: { dayOfWeek: number; startTime: string; type: RecurringSlot['type']; patient?: string }): Promise<RecurringSlotResult> => {
    const response = await api.post<APIResponse<RecurringSlotResult>>('/recurring-slots', data);
    return response.data.data;
  },

  // Pausar o reanudar. Al reanudar se agenda lo que falte.
  setActive: async (id: string, active: boolean): Promise<RecurringSlotResult> => {
    const response = await api.put<APIResponse<RecurringSlotResult>>(`/recurring-slots/${id}`, { active });
    return response.data.data;
  },

  // Quita el horario y cancela sus citas futuras (devolviendo las sesiones); devuelve el mensaje del servidor
  remove: async (id: string): Promise<string> => {
    const response = await api.delete<APIResponse<{ cancelled: number; kept: number }>>(`/recurring-slots/${id}`);
    return response.data.message ?? 'Horario fijo eliminado.';
  },
};
