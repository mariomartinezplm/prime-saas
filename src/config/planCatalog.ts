// Catálogo de planes — debe coincidir con backend/config/planCatalog.js

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
