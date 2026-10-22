import api from '../lib/api';
import type { APIResponse } from '../types';

export interface PlanLine {
  serviceType: 'entrenamiento' | 'kinesiologia';
  sessions: number | null;
  unlimited: boolean;
  price: number | null;
  count: number;
  collected: number;
  pending: number;
}

export interface FinanceSummary {
  month: string;
  previousMonth: string;
  scope: 'own' | 'center' | 'professional';
  professionals: { id: string; name: string }[];
  selectedProfessional: string | null;
  current: {
    collected: number;
    pending: number;
    projected: number;
    paidCount: number;
    pendingCount: number;
    untariffed: number;
    byService: { entrenamiento: number; kinesiologia: number };
    byPlan: PlanLine[];
  };
  previous: { collected: number; projected: number; paidCount: number };
  variation: { amount: number; percent: number } | null;
  activePatients: number;
  series: { month: string; collected: number; projected: number }[];
  plans: { patientId: string; patient: string; serviceType: 'entrenamiento' | 'kinesiologia'; sessions: number | null; unlimited: boolean; price: number | null; paid: boolean; startDate: string }[];
  notes: { cycleRule: string; noTariff: string | null };
}

export const financeService = {
  getSummary: async (month?: string, professional?: string | null): Promise<FinanceSummary> => {
    const response = await api.get<APIResponse<FinanceSummary>>('/finance/summary', { params: { ...(month ? { month } : {}), ...(professional ? { professional } : {}) } });
    return response.data.data;
  },
};
