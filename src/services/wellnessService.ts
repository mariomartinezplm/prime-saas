import api from '../lib/api';
import type { WellnessCheckin, CreateWellnessCheckinData, APIResponse } from '../types';

export const wellnessService = {
  create: async (data: CreateWellnessCheckinData): Promise<WellnessCheckin> => {
    const response = await api.post<APIResponse<{ checkin: WellnessCheckin }>>('/wellness', data);
    return response.data.data.checkin;
  },

  getToday: async (): Promise<WellnessCheckin | null> => {
    const response = await api.get<APIResponse<{ checkin: WellnessCheckin | null }>>('/wellness/me');
    return response.data.data.checkin;
  },
};
