// Catálogo de planes — debe coincidir con backend/config/planCatalog.js

export type ServiceType = 'entrenamiento' | 'kinesiologia';

export const PLAN_CATALOG: Record<ServiceType, number[]> = {
  entrenamiento: [4, 8, 12, 16],
  kinesiologia: [5, 10, 20],
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  entrenamiento: 'Entrenamiento',
  kinesiologia: 'Kinesiología',
};
