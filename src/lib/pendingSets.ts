import type { SetInput } from '@/services/workoutService';

// Cola MÍNIMA de series que todavía no llegaron al servidor (sin conexión o con error). Es la única copia local de datos de
// entrenamiento y se borra apenas el servidor confirma, al finalizar la sesión y al cerrar sesión. Las series YA confirmadas
// viven solo en el servidor (nunca en el dispositivo). Si IndexedDB no está disponible, se usa solo la memoria de la pestaña.
export interface PendingBatch {
  batchId: string; // = clientId de la primera serie
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

export async function listPending(sessionId?: string): Promise<PendingBatch[]> {
  const stored = ((await tx<PendingBatch[]>('readonly', (s) => s.getAll())) ?? []) as PendingBatch[];
  const all = new Map<string, PendingBatch>(stored.map((b) => [b.batchId, b]));
  memory.forEach((b, k) => all.set(k, b));
  return [...all.values()].filter((b) => !sessionId || b.sessionId === sessionId).sort((a, b) => a.savedAt - b.savedAt);
}

export async function clearPending(): Promise<void> {
  memory.clear();
  await tx('readwrite', (s) => s.clear());
}
