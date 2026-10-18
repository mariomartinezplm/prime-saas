/**
 * Presencia de las filas de «Para hoy» (Fase 2A.2): qué filas se dibujan cuando la lista de acciones cambia, de modo que una
 * fila que deja de corresponder pueda salir con una transición en vez de esfumarse de golpe.
 *
 * Este archivo es puro (sin React, sin temporizadores, sin DOM) para poder probar cada caso. NO decide qué tareas existen ni su
 * prioridad: eso sigue siendo todayActions.ts. Aquí solo se reconcilia «lo que se estaba mostrando» con «lo que ahora
 * corresponde mostrar»:
 *   · cada fila se identifica por una CLAVE estable (nunca por su posición);
 *   · una fila que ya no corresponde pasa a «leaving» (sigue dibujada, desactivada, mientras sale) y luego se elimina;
 *   · una fila nueva entra con «enter» (alto + fundido) o «enter-fade» (solo fundido), según el caso;
 *   · si una fila que estaba saliendo vuelve a corresponder, se cancela su salida (la lista final siempre es la correcta);
 *   · con «reducir movimiento» (animate = false) no hay filas «leaving»: el cambio es inmediato.
 */

export type RowPhase = 'present' | 'enter' | 'enter-fade' | 'leaving';
// Cómo entra una fila nueva: desplegando su alto (continuidad), solo con fundido (ya había un esqueleto de su alto) o sin animar
export type EnterMode = 'height' | 'fade' | 'none';

export interface PresenceRow<T> {
  key: string;
  item: T;
  phase: RowPhase;
}

// «session-today» (sesión de hoy que aún no empieza) y «session-live» (en curso) son la MISMA sesión en dos momentos: comparten
// fila, así el paso de una a otra actualiza el texto en su sitio y no hace salir y entrar filas.
export const keyOfAction = (action: { id: string }): string => (action.id.startsWith('session-') ? 'session' : action.id);

export function toRows<T>(items: T[], keyOf: (item: T) => string): PresenceRow<T>[] {
  const seen = new Set<string>();
  const rows: PresenceRow<T>[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, item, phase: 'present' });
  }
  return rows;
}

interface ReconcileOptions<T> {
  keyOf: (item: T) => string;
  animate: boolean;
  enter: EnterMode;
}

/**
 * `prev`: filas que se estaban dibujando (incluidas las que salían), con `item` = lo último que se vio de cada una.
 * `next`: lo que ahora corresponde mostrar, en orden de prioridad.
 */
export function reconcileRows<T>(prev: PresenceRow<T>[], next: T[], { keyOf, animate, enter }: ReconcileOptions<T>): PresenceRow<T>[] {
  const prevByKey = new Map(prev.map((row) => [row.key, row]));
  const nextRows: PresenceRow<T>[] = [];
  const nextKeys = new Set<string>();

  for (const item of next) {
    const key = keyOf(item);
    if (nextKeys.has(key)) continue; // nunca dos filas con la misma clave
    nextKeys.add(key);
    const before = prevByKey.get(key);
    let phase: RowPhase;
    if (before && before.phase !== 'leaving') phase = before.phase; // sigue; si aún estaba entrando, termina de entrar
    else if (before) phase = 'present'; // estaba saliendo y volvió a corresponder: se cancela la salida
    else if (!animate || enter === 'none') phase = 'present';
    else phase = enter === 'fade' ? 'enter-fade' : 'enter';
    nextRows.push({ key, item, phase });
  }

  if (!animate) return nextRows;

  // Las filas que ya no corresponden siguen dibujadas, saliendo, en el lugar donde estaban: justo después de la fila anterior
  // que sí se conserva (o al principio si no había ninguna).
  const result = nextRows.slice();
  let anchor: string | null = null;
  for (const row of prev) {
    if (nextKeys.has(row.key)) {
      anchor = row.key;
      continue;
    }
    let at = anchor === null ? 0 : result.findIndex((r) => r.key === anchor) + 1;
    // varias salidas tras la misma ancla conservan su orden relativo
    while (at < result.length && result[at].phase === 'leaving') at += 1;
    result.splice(at, 0, { key: row.key, item: row.item, phase: 'leaving' });
  }
  return result;
}

// Una fila terminó su transición: si salía, se elimina; si entraba, queda como una fila normal. Sin cambios devuelve LA MISMA lista.
export function settleRow<T>(rows: PresenceRow<T>[], key: string): PresenceRow<T>[] {
  const target = rows.find((row) => row.key === key);
  if (!target || target.phase === 'present') return rows;
  return target.phase === 'leaving' ? rows.filter((row) => row.key !== key) : rows.map((row) => (row.key === key ? { ...row, phase: 'present' } : row));
}

// Red de seguridad (si un navegador no avisó que terminó la animación): todo termina de salir y de entrar
export function settleAll<T>(rows: PresenceRow<T>[]): PresenceRow<T>[] {
  if (rows.every((row) => row.phase === 'present')) return rows;
  return rows.filter((row) => row.phase !== 'leaving').map((row) => (row.phase === 'present' ? row : { ...row, phase: 'present' as const }));
}

interface AnnounceInput {
  prevKeys: string[];
  nextKeys: string[];
  // Por clave: id de la acción y título, antes y ahora (el id cambia cuando la misma fila pasa de un estado a otro)
  prev: Record<string, { id: string; title: string }>;
  next: Record<string, { id: string; title: string }>;
}

/**
 * Aviso para lectores de pantalla cuando cambia «Para hoy». Solo cuando ayuda a entender algo que no sería evidente:
 *   · la lista quedó vacía;
 *   · una fila cambió de estado (p. ej. la sesión empezó);
 *   · aparecieron o desaparecieron tareas.
 * NUNCA repite lo que el Readiness ya anuncia por su cuenta: si lo único que cambió es que desapareció la fila «readiness»
 * (y quedan otras tareas), no se dice nada. Devuelve null cuando no hay nada que decir.
 */
export function announceChange({ prevKeys, nextKeys, prev, next }: AnnounceInput): string | null {
  const removed = prevKeys.filter((k) => !nextKeys.includes(k));
  const added = nextKeys.filter((k) => !prevKeys.includes(k));
  const changed = nextKeys.filter((k) => prevKeys.includes(k) && prev[k]?.id !== next[k]?.id);
  if (removed.length === 0 && added.length === 0 && changed.length === 0) return null;
  if (nextKeys.length === 0) return 'No tienes tareas pendientes por hoy.';
  if (added.length === 0 && changed.length === 0 && removed.every((k) => k === 'readiness')) return null;
  const titles = nextKeys.map((k) => next[k]?.title).filter(Boolean);
  return `Se actualizó «Para hoy». Ahora: ${titles.join('. ')}.`;
}
