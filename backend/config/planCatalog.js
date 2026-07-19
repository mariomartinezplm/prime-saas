// Catálogo de planes — reglas de negocio fijas (no editable desde la app).
// Entrenamiento: 4, 8, 12 o 16 sesiones. Kinesiología: 5, 10 o 20 sesiones.

export const PLAN_CATALOG = {
  entrenamiento: [4, 8, 12, 16],
  kinesiologia: [5, 10, 20]
};

export const SERVICE_TYPES = Object.keys(PLAN_CATALOG);

export function isValidSessionsForServiceType(serviceType, sessionsTotal) {
  const allowed = PLAN_CATALOG[serviceType];
  return Array.isArray(allowed) && allowed.includes(sessionsTotal);
}
