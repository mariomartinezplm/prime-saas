import api from '../lib/api';
import type { ExtraSession, CreateExtraSessionData, APIResponse } from '../types';

export const extraSessionService = {
  create: async (data: CreateExtraSessionData): Promise<ExtraSession> => {
    const response = await api.post<APIResponse<{ extraSession: ExtraSession }>>('/extra-sessions', data);
    return response.data.data.extraSession;
  },

  getPatientExtraSessions: async (patientId: string): Promise<ExtraSession[]> => {
    const response = await api.get<APIResponse<{ extraSessions: ExtraSession[] }>>(`/extra-sessions/patient/${patientId}`);
    return response.data.data.extraSessions;
  },
};
