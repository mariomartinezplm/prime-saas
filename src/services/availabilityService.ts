import api from '../lib/api';
import type { Availability, AvailableSlots, DaySchedule, APIResponse } from '../types';

export const availabilityService = {
  // Obtener disponibilidad completa de un profesional
  get: async (professionalId: string): Promise<Availability | null> => {
    const response = await api.get<APIResponse<{ availability: Availability | null }>>(
      `/availability/${professionalId}`
    );
    return response.data.data.availability;
  },

  // Obtener slots disponibles para una fecha
  getSlots: async (professionalId: string, date: string): Promise<AvailableSlots> => {
    const response = await api.get<APIResponse<AvailableSlots>>(
      `/availability/${professionalId}/slots/${date}`
    );
    return response.data.data;
  },

  // Actualizar horario semanal
  updateSchedule: async (professionalId: string, weeklySchedule: DaySchedule[]): Promise<Availability> => {
    const response = await api.put<APIResponse<{ availability: Availability }>>(
      `/availability/${professionalId}/schedule`,
      { weeklySchedule }
    );
    return response.data.data.availability;
  },

  // Bloquear fecha
  blockDate: async (
    professionalId: string,
    data: { date: string; slots?: Array<{ startTime: string; endTime: string }>; allDay?: boolean; reason?: string }
  ): Promise<Availability> => {
    const response = await api.post<APIResponse<{ availability: Availability }>>(
      `/availability/${professionalId}/block`,
      data
    );
    return response.data.data.availability;
  },

  // Desbloquear fecha
  unblockDate: async (professionalId: string, blockId: string): Promise<Availability> => {
    const response = await api.delete<APIResponse<{ availability: Availability }>>(
      `/availability/${professionalId}/block/${blockId}`
    );
    return response.data.data.availability;
  },
};
