import api from '../lib/api';
import type { WellnessCheckin, CreateWellnessCheckinData, WellnessTrend, APIResponse } from '../types';

// Recordatorio diario del Readiness (dentro de la app; hora de Santiago)
export interface ReadinessReminder {
  enabled: boolean;
  hour: number;
}

export const wellnessService = {
  getReminder: async (): Promise<ReadinessReminder> => {
    const response = await api.get<APIResponse<{ reminder: ReadinessReminder }>>('/wellness/reminder');
    return response.data.data.reminder;
  },

  updateReminder: async (changes: Partial<ReadinessReminder>): Promise<ReadinessReminder> => {
    const response = await api.put<APIResponse<{ reminder: ReadinessReminder }>>('/wellness/reminder', changes);
    return response.data.data.reminder;
  },

  create: async (data: CreateWellnessCheckinData): Promise<WellnessCheckin> => {
    const response = await api.post<APIResponse<{ checkin: WellnessCheckin }>>('/wellness', data);
    return response.data.data.checkin;
  },

  getToday: async (): Promise<WellnessCheckin | null> => {
    const response = await api.get<APIResponse<{ checkin: WellnessCheckin | null }>>('/wellness/me');
    return response.data.data.checkin;
  },

  getPatientCheckins: async (patientId: string): Promise<WellnessCheckin[]> => {
    const response = await api.get<APIResponse<{ checkins: WellnessCheckin[] }>>(`/wellness/patient/${patientId}`);
    return response.data.data.checkins;
  },

  getTrends: async (): Promise<WellnessTrend[]> => {
    const response = await api.get<APIResponse<{ trends: WellnessTrend[] }>>('/wellness/trends');
    return response.data.data.trends;
  },
};
