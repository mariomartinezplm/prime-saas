/**
 * Tarifas base (pesos chilenos, CLP), confirmadas por Mario el 2026-10-22. Se usan SOLO para ESTIMAR el valor de los planes:
 * el sistema no guarda el monto pagado ni la fecha de cada pago.
 *
 * Kinesiología: tarifa por paquete de sesiones (1, 5, 10). Entrenamiento: tarifa MENSUAL (8 sesiones/mes = 2 por semana; 12 = 3 por semana).
 * Los planes sin tarifa (entrenamiento de 4 o 16 sesiones o ilimitado; kinesiología de 12, 15 o 20) NO se inventan: se cuentan aparte.
 */
export const PRICES = {
  kinesiologia: { 1: 25000, 5: 100000, 10: 200000 },
  entrenamiento: { 8: 90000, 12: 130000 }
};

// Descuentos por pagar por adelantado un plan de ENTRENAMIENTO de varios meses (condiciones comerciales vigentes).
// Hoy el sistema tiene los plazos mensual, trimestral y anual; «semestral» queda definido para cuando exista ese plazo.
export const TERM_DISCOUNTS = { mensual: 0, trimestral: 0.1, semestral: 0.15, anual: 0.2 };

// Tarifa de UN ciclo mensual (o del paquete de kinesiología), o null si no hay tarifa definida
export function priceOf(plan) {
  if (!plan || plan.unlimited) return null;
  return PRICES[plan.serviceType]?.[plan.sessionsTotal] ?? null;
}

// Valor estimado del CONTRATO completo que se paga de una vez (mensual: 1 ciclo; trimestral: 3; anual: 12) con su descuento.
// Kinesiología no tiene plazos con descuento: si no es mensual, no se inventa un valor (null).
export function contractValue(plan) {
  const unit = priceOf(plan);
  if (unit === null) return null;
  const cycles = Math.max(1, plan.cyclesTotal ?? 1);
  const term = plan.term ?? 'mensual';
  if (plan.serviceType === 'kinesiologia') return term === 'mensual' && cycles === 1 ? unit : null;
  const discount = TERM_DISCOUNTS[term];
  if (discount === undefined) return null;
  return Math.round(unit * cycles * (1 - discount));
}

export const discountOf = (plan) => (plan.serviceType === 'entrenamiento' ? TERM_DISCOUNTS[plan.term ?? 'mensual'] ?? null : 0);
