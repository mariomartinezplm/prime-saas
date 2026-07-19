import api from '../lib/api';
import type { ClientPlan, CreateClientPlanData, SessionBalance, APIResponse } from '../types';

export const clientPlanService = {
  // Listar planes (activos + vencidos) de todos los pacientes — panel admin
  getAll: async (): Promise<ClientPlan[]> => {
    const response = await api.get<APIResponse<{ clientPlans: ClientPlan[] }>>('/client-plans');
    return response.data.data.clientPlans;
  },

  // Registrar el pago de un plan. Si el paciente ya tiene un plan activo,
  // el backend responde 409 con { data: { existingPlan } } — el caller debe
  // volver a llamar con replaceExisting: true si el admin confirma el reemplazo.
  create: async (data: CreateClientPlanData): Promise<ClientPlan> => {
    const response = await api.post<APIResponse<{ clientPlan: ClientPlan }>>('/client-plans', data);
    return response.data.data.clientPlan;
  },

  getPatientPlans: async (patientId: string): Promise<ClientPlan[]> => {
    const response = await api.get<APIResponse<{ clientPlans: ClientPlan[] }>>(`/client-plans/patient/${patientId}`);
    return response.data.data.clientPlans;
  },

  getBalance: async (patientId: string): Promise<SessionBalance> => {
    const response = await api.get<APIResponse<{ balance: SessionBalance }>>(`/client-plans/balance/${patientId}`);
    return response.data.data.balance;
  },

  cancel: async (id: string): Promise<ClientPlan> => {
    const response = await api.put<APIResponse<{ clientPlan: ClientPlan }>>(`/client-plans/${id}/cancel`);
    return response.data.data.clientPlan;
  },
};
