import api from '../lib/api';
import type { Plan, CreatePlanData, APIResponse } from '../types';

export const planService = {
  // Crear plan
  create: async (data: CreatePlanData): Promise<Plan> => {
    const response = await api.post<APIResponse<{ plan: Plan }>>('/plans', data);
    return response.data.data.plan;
  },

  // Obtener todos los planes
  getAll: async (params?: { status?: string; patient?: string }): Promise<Plan[]> => {
    const response = await api.get<APIResponse<{ plans: Plan[] }>>('/plans', { params });
    return response.data.data.plans;
  },

  // Obtener plan por ID
  getById: async (id: string): Promise<Plan> => {
    const response = await api.get<APIResponse<{ plan: Plan }>>(`/plans/${id}`);
    return response.data.data.plan;
  },

  // Obtener plan activo del paciente
  getActive: async (patientId: string): Promise<Plan | null> => {
    const response = await api.get<APIResponse<{ plan: Plan | null }>>(`/plans/active/${patientId}`);
    return response.data.data.plan;
  },

  // Actualizar plan
  update: async (id: string, data: Partial<Plan>): Promise<Plan> => {
    const response = await api.put<APIResponse<{ plan: Plan }>>(`/plans/${id}`, data);
    return response.data.data.plan;
  },

  // Eliminar plan
  delete: async (id: string): Promise<void> => {
    await api.delete(`/plans/${id}`);
  },
};
