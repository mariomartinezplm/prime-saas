// Catálogo de planes — debe coincidir con backend/config/planCatalog.js

import { addMonths, endOfMonth, format, parseISO, startOfDay, subDays, subMilliseconds } from 'date-fns';
import { es } from 'date-fns/locale';

export type ServiceType = 'entrenamiento' | 'kinesiologia';

export const PLAN_CATALOG: Record<ServiceType, number[]> = {
  entrenamiento: [4, 8, 12, 16],
  kinesiologia: [1, 5, 10, 12, 15, 20],
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  entrenamiento: 'Entrenamiento',
  kinesiologia: 'Kinesiología',
};

export const UNLIMITED = 'ilimitado' as const;
export type SessionsChoice = number | typeof UNLIMITED;

const UNLIMITED_SERVICE_TYPES: ServiceType[] = ['entrenamiento'];

export const DEFAULT_CHOICE: Record<ServiceType, SessionsChoice> = {
  entrenamiento: 4,
  kinesiologia: 10,
};

export function sessionChoicesFor(type: ServiceType): SessionsChoice[] {
  return UNLIMITED_SERVICE_TYPES.includes(type)
    ? [...PLAN_CATALOG[type], UNLIMITED]
    : PLAN_CATALOG[type];
}

export function choiceLabel(choice: SessionsChoice): string {
  if (choice === UNLIMITED) return 'Ilimitado';
  return choice === 1 ? '1 sesión' : `${choice} sesiones`;
}

export function choiceToPayload(choice: SessionsChoice): { sessionsTotal: number; unlimited?: boolean } {
  return choice === UNLIMITED ? { sessionsTotal: 0, unlimited: true } : { sessionsTotal: choice };
}

interface PlanUsage {
  sessionsTotal: number;
  sessionsUsed: number;
  unlimited?: boolean;
}

export function formatPlanUsage(plan: PlanUsage): string {
  return plan.unlimited
    ? `${plan.sessionsUsed} sesión(es) usada(s) · ilimitado`
    : `${plan.sessionsUsed}/${plan.sessionsTotal} sesiones usadas`;
}

export function formatPlanRemaining(plan: PlanUsage): string {
  return plan.unlimited
    ? 'sesiones ilimitadas'
    : `${plan.sessionsTotal - plan.sessionsUsed} sesión(es) restante(s)`;
}

// ─── Duración del plan y tipo de ciclo (debe coincidir con backend/services/planCycles.js) ───

export type PlanTerm = 'mensual' | 'trimestral' | 'anual';
export type BillingCycle = 'calendar' | 'rolling';

export const PLAN_TERMS: PlanTerm[] = ['mensual', 'trimestral', 'anual'];

export const TERM_LABELS: Record<PlanTerm, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral (3 meses)',
  anual: 'Anual (12 meses)',
};

export const TERM_MONTHS: Record<PlanTerm, number> = { mensual: 1, trimestral: 3, anual: 12 };

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  calendar: 'Hasta fin de mes (lo normal)',
  rolling: 'De fecha a fecha (ej. del 10 al 10)',
};

// "Mes 3 de 12" para planes de varios meses; vacío para los mensuales
export function formatCycleProgress(plan: { cycleNumber?: number; cyclesTotal?: number; term?: PlanTerm }): string {
  if (!plan.cyclesTotal || plan.cyclesTotal <= 1) return '';
  return `${plan.term === 'anual' ? 'Anual' : 'Trimestral'} · mes ${plan.cycleNumber ?? 1} de ${plan.cyclesTotal}`;
}

// Fecha en que terminaría el plan si se registrara hoy (solo para mostrar)
export function previewPlanEnd(term: PlanTerm, billingCycle: BillingCycle): Date {
  const months = TERM_MONTHS[term];
  return billingCycle === 'rolling'
    ? subDays(addMonths(startOfDay(new Date()), months), 1)
    : endOfMonth(addMonths(new Date(), months - 1));
}

// Fecha límite de pago como la ve la persona: "5 de noviembre"
export function formatPaymentDeadline(paymentDueBy: string): string {
  return format(subMilliseconds(parseISO(paymentDueBy), 1), "d 'de' MMMM", { locale: es });
}
