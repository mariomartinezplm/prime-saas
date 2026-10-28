import api from '../lib/api';
import type { ClientPlan, CreateClientPlanData, SessionBalance, APIResponse } from '../types';

// Lo que haría «Renovar plan» con un toque (sin cambiar nada) y lo que se mantiene
export type RenewalKind = 'settle_pending' | 'early' | 'reactivate' | 'kine_new';
export interface RenewalPreview {
  kind: RenewalKind | 'none';
  // Solo cuando no hay nada que renovar
  reason?: string;
  message?: string;
  paidUntil?: string;
  plan?: { serviceType: 'entrenamiento' | 'kinesiologia'; sessionsTotal: number; unlimited: boolean; term: string; billingCycle: string; cyclesTotal: number; openEnded: boolean; scholarship: boolean };
  starts?: string;
  firstCycleEnds?: string | null;
  endsOn?: string | null;
  keep?: { futureAppointments: number; fixedSlots: number };
}

export const clientPlanService = {
  // Vista previa de «Renovar plan» para un paciente
  getRenewalPreview: async (patientId: string): Promise<RenewalPreview> => {
    const response = await api.get<APIResponse<{ renewal: RenewalPreview }>>(`/client-plans/renew/${patientId}`);
    return response.data.data.renewal;
  },

  // Renovar el plan que el paciente ya tiene, con las mismas condiciones (citas y horario fijo se mantienen)
  renew: async (patientId: string): Promise<{ kind: RenewalKind; fixed: { slots: number; created: number; skipped: number } }> => {
    const response = await api.post<APIResponse<{ kind: RenewalKind; fixed: { slots: number; created: number; skipped: number } }>>(`/client-plans/renew/${patientId}`);
    return response.data.data;
  },

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

  // Cambiar el plazo de pago (días desde que empieza el ciclo nuevo)
  updateGraceDays: async (id: string, graceDays: number): Promise<void> => {
    await api.put(`/client-plans/${id}/grace-days`, { graceDays });
  },

  // Cambiar la fecha de inicio de un plan (mueve todos los ciclos del mismo pago)
  updateStartDate: async (id: string, startDate: string): Promise<void> => {
    await api.put(`/client-plans/${id}/start-date`, { startDate });
  },
};
