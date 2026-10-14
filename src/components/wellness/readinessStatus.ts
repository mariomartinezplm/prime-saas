import type { WellnessCheckin } from '../../types';

// Estado del Readiness de HOY, tal como lo sabe la tarjeta del cuestionario. Es la ÚNICA definición: la tarjeta lo calcula
// a partir de lo que ya obtiene del servidor y se lo comunica al dashboard (`onStatusChange`), que no vuelve a consultarlo.
//   loading   todavía se está consultando
//   pending   ya se consultó y no hay check-in de hoy
//   done      ya respondió hoy
//   unknown   no se pudo consultar (error): no se afirma nada
export type ReadinessTodayStatus = 'loading' | 'pending' | 'done' | 'unknown';

export const readinessStatusOf = (state: { loading: boolean; loadFailed: boolean; checkin: WellnessCheckin | null }): ReadinessTodayStatus => {
  if (state.loading) return 'loading';
  if (state.loadFailed) return 'unknown';
  return state.checkin ? 'done' : 'pending';
};
