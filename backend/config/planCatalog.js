// Catálogo de planes — reglas de negocio fijas (no editable desde la app).
// Entrenamiento: 4, 8, 12 o 16 sesiones, o ilimitado.
// Kinesiología: 1, 5, 10, 12, 15 o 20 sesiones.

export const PLAN_CATALOG = {
  entrenamiento: [4, 8, 12, 16],
  kinesiologia: [1, 5, 10, 12, 15, 20]
};

// Tipos de servicio que admiten plan ilimitado (sessionsTotal se guarda en 0).
export const UNLIMITED_SERVICE_TYPES = ['entrenamiento'];

// Número que devuelve sessionsAvailable() en un plan ilimitado, para que las
// comparaciones "¿queda saldo?" (> 0) sigan funcionando sin casos especiales.
export const UNLIMITED_AVAILABLE = 9999;

export const SERVICE_TYPES = Object.keys(PLAN_CATALOG);

export const SERVICE_TYPE_LABELS = {
  entrenamiento: 'Entrenamiento',
  kinesiologia: 'Kinesiología'
};

export function isValidSessionsForServiceType(serviceType, sessionsTotal) {
  const allowed = PLAN_CATALOG[serviceType];
  return Array.isArray(allowed) && allowed.includes(sessionsTotal);
}

export function supportsUnlimited(serviceType) {
  return UNLIMITED_SERVICE_TYPES.includes(serviceType);
}
