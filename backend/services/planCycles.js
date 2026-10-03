// Reglas de fechas de los planes (Prime F&H). Funciones puras, sin base de datos.
//
//  · Ciclo "calendar" (lo normal): el plan va desde el día de pago hasta el
//    último día de ese mes. Al empezar el mes siguiente, todo parte de cero.
//  · Ciclo "rolling" (excepción, ej. quienes pagan el 10): de fecha a fecha,
//    del 10 de un mes al 9 del siguiente (el 10 ya empieza el ciclo nuevo).
//  · Plazo de pago: el paciente tiene 5 días desde que empieza el ciclo nuevo
//    (para el mes calendario, hasta el día 5) y puede seguir agendando.
//  · Plan trimestral/anual = varios ciclos mensuales pagados de una vez; las
//    sesiones se renuevan en cada ciclo (cada ciclo es su propio registro).

import {
  santiagoParts,
  santiagoToUtc,
  startOfDaySantiago,
  addMonthsSantiago,
  addDaysSantiago
} from '../utils/timezone.js';

export const GRACE_DAYS = 5;
export const TERMS = ['mensual', 'trimestral', 'anual'];
export const TERM_CYCLES = { mensual: 1, trimestral: 3, anual: 12 };
export const BILLING_CYCLES = ['calendar', 'rolling'];

const lastMs = (date) => new Date(date.getTime() - 1);

// Inicio y fin del ciclo número `index` (0 = el primero) de un plan que parte en startDate
export function cycleBounds(startDate, billingCycle, index = 0) {
  if (billingCycle === 'rolling') {
    const anchor = startOfDaySantiago(startDate);
    const start = index === 0 ? new Date(startDate) : addMonthsSantiago(anchor, index);
    return { start, end: lastMs(addMonthsSantiago(anchor, index + 1)) };
  }

  const p = santiagoParts(startDate);
  const start = index === 0 ? new Date(startDate) : santiagoToUtc(p.year, p.month + index, 1);
  return { start, end: lastMs(santiagoToUtc(p.year, p.month + index + 1, 1)) };
}

export function buildCycles(startDate, billingCycle, cyclesTotal) {
  return Array.from({ length: cyclesTotal }, (_, index) => ({
    cycleNumber: index + 1,
    ...cycleBounds(startDate, billingCycle, index)
  }));
}

// Hasta cuándo se puede pagar el ciclo que empieza en cycleStart (primer
// instante en que ya NO se puede: medianoche, 5 días después del inicio).
export function paymentDueBy(cycleStart) {
  return addDaysSantiago(cycleStart, GRACE_DAYS);
}
