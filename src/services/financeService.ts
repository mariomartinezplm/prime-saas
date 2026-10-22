import api from '../lib/api';
import type { APIResponse } from '../types';

export type ServiceType = 'entrenamiento' | 'kinesiologia';

export interface PlanLine {
  serviceType: ServiceType;
  sessions: number | null;
  unlimited: boolean;
  term: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  unitPrice: number | null;
  discount: number | null;
  count: number;
  value: number;
  paidCount: number;
  pendingCount: number;
  untariffed: number;
}

// VALOR ESTIMADO de planes (no dinero cobrado): PRIME F&H todavía no guarda el monto pagado ni la fecha de cada pago.
export interface FinanceSummary {
  month: string;
  previousMonth: string;
  scope: 'own' | 'center' | 'professional';
  professionals: { id: string; name: string }[];
  selectedProfessional: string | null;
  current: {
    estimated: number;
    paidValue: number;
    pendingValue: number;
    paidCount: number;
    pendingCount: number;
    untariffed: number;
    contracts: number;
    byService: { entrenamiento: number; kinesiologia: number };
    byPlan: PlanLine[];
  };
  previous: { estimated: number; contracts: number };
  variation: { amount: number; percent: number } | null;
  activePatients: number;
  activePatientInitials: string[];
  series: { month: string; estimated: number; pendingValue: number; contracts: number }[];
  projection: { month: string; value: number; count: number } | null;
  plans: { patientId: string; patient: string; serviceType: ServiceType; sessions: number | null; unlimited: boolean; term: string; cycles: number; value: number | null; paid: boolean; startDate: string }[];
  basis: { kind: 'estimate'; tracksPayments: boolean; notes: string[]; untariffed: number };
}

export const financeService = {
  getSummary: async (month?: string, professional?: string | null): Promise<FinanceSummary> => {
    const response = await api.get<APIResponse<FinanceSummary>>('/finance/summary', { params: { ...(month ? { month } : {}), ...(professional ? { professional } : {}) } });
    return response.data.data;
  },
};
