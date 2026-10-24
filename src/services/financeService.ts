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
  monthlyPay?: boolean;
  scholarship?: boolean;
  count: number;
  value: number;
  paidCount: number;
  pendingCount: number;
  untariffed: number;
}

export interface MonthlyRow {
  patientId: string;
  patient: string;
  serviceType: ServiceType;
  sessions: number | null;
  term: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  cycleNumber: number;
  cyclesTotal: number;
  monthly: number;
  discount: number | null;
  contractValue: number | null;
  monthlyPay?: boolean;
  scholarship?: boolean;
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
    scholarships: number;
    contracts: number;
    byService: { entrenamiento: number; kinesiologia: number };
    byPlan: PlanLine[];
  };
  previous: { estimated: number; contracts: number };
  variation: { amount: number; percent: number } | null;
  activePatients: number;
  activePatientInitials: string[];
  series: { month: string; estimated: number; pendingValue: number; contracts: number; monthlyBase: number }[];
  monthly: { month: string; total: number; untariffed: number; rows: MonthlyRow[] };
  projection: { month: string; value: number; count: number } | null;
  plans: { patientId: string; patient: string; serviceType: ServiceType; sessions: number | null; unlimited: boolean; term: string; cycles: number; value: number | null; paid: boolean; startDate: string; monthlyPay?: boolean; scholarship?: boolean }[];
  basis: { kind: 'estimate'; tracksPayments: boolean; notes: string[]; untariffed: number };
}

export const financeService = {
  getSummary: async (month?: string, professional?: string | null): Promise<FinanceSummary> => {
    const response = await api.get<APIResponse<FinanceSummary>>('/finance/summary', { params: { ...(month ? { month } : {}), ...(professional ? { professional } : {}) } });
    return response.data.data;
  },
};
