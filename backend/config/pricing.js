/**
 * Tarifas por plan (pesos chilenos, CLP). Las definió Mario el 2026-10-22 para el panel de ingresos.
 * Clave: tipo de servicio → sesiones del plan MENSUAL → precio.
 *
 * Entrenamiento: 8 sesiones/mes = 2 veces por semana · 12 sesiones/mes = 3 veces por semana.
 * Los planes SIN tarifa definida (entrenamiento de 4 o 16 sesiones, ilimitado; kinesiología de 12, 15 o 20) NO se inventan: se
 * cuentan aparte como «sin tarifa» y no suman al ingreso.
 */
export const PRICES = {
  kinesiologia: { 1: 25000, 5: 100000, 10: 200000 },
  entrenamiento: { 8: 90000, 12: 130000 }
};

// Precio de un ciclo mensual, o null si ese plan no tiene tarifa definida
export function priceOf(plan) {
  if (!plan || plan.unlimited) return null;
  return PRICES[plan.serviceType]?.[plan.sessionsTotal] ?? null;
}
