/**
 * Estados de carga del dashboard del paciente (funciones puras, sin React ni API).
 *
 * Cada bloque se muestra apenas tiene sus datos y, mientras espera, conserva su espacio con un esqueleto. Ningún bloque
 * secundario (logros, Readiness) retiene a los demás, y no hay esperas artificiales.
 *
 *   citas y saldo   dos consultas independientes: «Próxima sesión» solo necesita las citas; «Mi plan», el saldo.
 *   «Para hoy»      necesita las dos (y, si no hay plan vigente, el historial de planes para decir qué pasó con él).
 *   Readiness       su propia consulta; mientras no se sabe el plan no se decide qué mostrar.
 *   logros          su propia consulta; si falla, el bloque simplemente no aparece.
 *
 * Un error no borra lo que ya se cargó bien: «Reintentar» repite SOLO lo que falló.
 */

export type LoadState = 'loading' | 'ready' | 'error';
export type DashboardQuery = 'upcoming' | 'balance';

export interface MainLoadStates {
  upcoming: LoadState;
  balance: LoadState;
}

// Qué consultas hay que repetir al pulsar «Reintentar»
export const queriesToRetry = ({ upcoming, balance }: MainLoadStates): DashboardQuery[] => {
  const failed: DashboardQuery[] = [];
  if (upcoming === 'error') failed.push('upcoming');
  if (balance === 'error') failed.push('balance');
  return failed;
};

// «Para hoy» espera a que se sepa todo lo que decide sus filas (no a lo secundario)
export const todayIsWaiting = (states: MainLoadStates, planHistoryPending: boolean): boolean =>
  states.upcoming === 'loading' || states.balance === 'loading' || planHistoryPending;

// «Mi plan» espera al saldo y, si no hay plan vigente, al historial de planes
export const planIsWaiting = (states: MainLoadStates, planHistoryPending: boolean): boolean =>
  states.balance === 'loading' || planHistoryPending;

// ¿Se muestra el aviso de «no se pudieron cargar algunos datos»?
export const hasLoadError = (states: MainLoadStates): boolean => queriesToRetry(states).length > 0;
