import type { SetInput } from '@/services/workoutService';

// Cola MÍNIMA de series que todavía no llegaron al servidor (sin conexión o con error). Es la única copia local de datos de
// entrenamiento y se borra apenas el servidor confirma, al finalizar la sesión y al cerrar sesión. Las series YA confirmadas
// viven solo en el servidor (nunca en el dispositivo). Si IndexedDB no está disponible, se usa solo la memoria de la pestaña.
export interface PendingBatch {
  batchId: string; // = clientId de la primera serie
  // Cuenta a la que pertenece: un lote JAMÁS se envía ni se muestra con otra cuenta (aunque se comparta el dispositivo)
  userId: string;
  sessionId: string;
  blockId: string;
  sets: SetInput[];
  // Datos de pantalla para mostrar «pendiente» (no se envían al servidor)
  display: { slot: string; exerciseName: string; reps?: number; weight?: number; durationSec?: number }[];
  savedAt: number;
}

const DB = 'prime-workout-pending';
const STORE = 'batches';
const memory = new Map<string, PendingBatch>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'batchId' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const tx = async <T,>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> => {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

export async function putPending(batch: PendingBatch): Promise<void> {
  memory.set(batch.batchId, batch);
  await tx('readwrite', (s) => s.put(batch));
}

export async function removePending(batchId: string): Promise<void> {
  memory.delete(batchId);
  await tx('readwrite', (s) => s.delete(batchId));
}

// Lo pendiente caduca a las 24 h: una sesión de entrenamiento nunca dura tanto (se cierra sola a las 6 h sin actividad)
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export async function listPending(sessionId?: string, userId?: string, now: number = Date.now()): Promise<PendingBatch[]> {
  const stored = ((await tx<PendingBatch[]>('readonly', (s) => s.getAll())) ?? []) as PendingBatch[];
  const all = new Map<string, PendingBatch>(stored.map((b) => [b.batchId, b]));
  memory.forEach((b, k) => all.set(k, b));
  const fresh: PendingBatch[] = [];
  for (const b of all.values()) {
    if (now - b.savedAt > PENDING_TTL_MS) await removePending(b.batchId); // caducado: se borra
    else fresh.push(b);
  }
  return fresh.filter((b) => (!sessionId || b.sessionId === sessionId) && (!userId || b.userId === userId)).sort((a, b) => a.savedAt - b.savedAt);
}

// Cuántas series de ESTA cuenta siguen sin sincronizar
export async function countPendingSets(userId: string): Promise<number> {
  return (await listPending(undefined, userId)).reduce((n, b) => n + b.sets.length, 0);
}

// Borra lo pendiente de UNA cuenta (nunca el de otra)
export async function clearPending(userId?: string): Promise<void> {
  if (!userId) {
    memory.clear();
    await tx('readwrite', (s) => s.clear());
    return;
  }
  for (const b of await listPending(undefined, userId)) await removePending(b.batchId);
}

export type SendBatch = (batch: PendingBatch) => Promise<void>;

// Envía los lotes pendientes de una cuenta, en orden. Cada serie lleva su clientId: reenviar nunca duplica. Un lote que el servidor
// RECHAZA (dato inválido, sesión de otra persona o ya cerrada) se retira; uno con problema de conexión se conserva y se deja de intentar.
export async function flushPendingBatches(userId: string, send: SendBatch, isRetryable: (error: unknown) => boolean): Promise<{ sent: number; left: number; dropped: number }> {
  let sent = 0;
  let dropped = 0;
  for (const batch of await listPending(undefined, userId)) {
    try {
      await send(batch);
      await removePending(batch.batchId);
      sent += 1;
    } catch (error) {
      if (isRetryable(error)) break;
      await removePending(batch.batchId);
      dropped += 1;
    }
  }
  return { sent, dropped, left: (await listPending(undefined, userId)).length };
}

// ¿Fue un problema de conexión o del servidor (se puede reintentar) y no un dato rechazado (no tiene sentido reintentar)?
export const isRetryable = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === undefined || status >= 500 || status === 429 || status === 408;
};
