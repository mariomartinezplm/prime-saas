import { useCallback, useEffect, useRef, useState } from 'react';
import { clockOffset } from '@/lib/workoutClock';
import { useAuth } from '@/contexts/AuthContext';
import { isRetryable, listPending, putPending, removePending, type PendingBatch } from '@/lib/pendingSets';
import { expandBlock, type DraftBlock } from '@/lib/workoutPlan';
import { workoutService, type BlockKind, type Modality, type RestAction, type SetInput, type WorkoutActive, type WorkoutMutation, type WorkoutSessionView } from '@/services/workoutService';

type Status = 'loading' | 'ready' | 'error';

const CHANNEL = 'prime-workout';
// Refrescar desde el servidor al volver a la app, como máximo cada tanto (no en cada cambio de foco)
const REFRESH_MIN_MS = 10_000;

// Estado del entrenamiento en curso. La verdad vive en el servidor: aquí solo se guarda lo último que se recibió y la
// diferencia entre el reloj del servidor y el del dispositivo. `now` solo sirve para repintar; los tiempos se calculan
// siempre con instantes guardados (ver lib/workoutClock.ts).

export function useWorkout({ tick = true }: { tick?: boolean } = {}) {
  const [data, setData] = useState<WorkoutActive | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const offsetRef = useRef(0);
  const lastLoad = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const inFlight = useRef(false);
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [pending, setPending] = useState<PendingBatch[]>([]);
  const flushing = useRef(false);

  const calibrate = (serverNowIso: string, sentAt: number) => {
    // Punto medio del viaje: compensa la demora de la red
    const received = Date.now();
    offsetRef.current = clockOffset(serverNowIso, (sentAt + received) / 2);
  };

  const load = useCallback(async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const sentAt = Date.now();
    if (!silent) setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const result = await workoutService.getActive();
      calibrate(result.serverNow, sentAt);
      setData(result);
      setStatus('ready');
      lastLoad.current = Date.now();
    } catch {
      // Con datos ya mostrados, un fallo de refresco no los borra
      setStatus((s) => (s === 'ready' ? s : 'error'));
    } finally {
      inFlight.current = false;
    }
  }, []);

  const apply = useCallback((mutation: WorkoutMutation, sentAt: number, broadcast = true) => {
    calibrate(mutation.serverNow, sentAt);
    setData((prev) => ({ serverNow: mutation.serverNow, session: mutation.session.status === 'active' ? mutation.session : null, startable: prev?.startable ?? null, closedStale: false }));
    setNow(Date.now());
    if (broadcast) channel.current?.postMessage('changed');
  }, []);

  useEffect(() => {
    load();
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = () => load(true);
      channel.current = ch;
      return () => ch.close();
    }
  }, [load]);

  // Al volver a la app (desbloquear, cambiar de pestaña, abrir la PWA): se recalcula todo con la hora real
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      setNow(Date.now());
      if (Date.now() - lastLoad.current > REFRESH_MIN_MS) load(true);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [load]);

  // Repinta cada segundo mientras hay una sesión y la pestaña es visible. NO es la fuente del tiempo.
  const active = !!data?.session;
  useEffect(() => {
    if (!tick || !active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tick, active]);

  const run = async (fn: () => Promise<WorkoutMutation>): Promise<WorkoutMutation> => {
    if (busy) throw new Error('busy');
    setBusy(true);
    const sentAt = Date.now();
    try {
      const mutation = await fn();
      apply(mutation, sentAt);
      return mutation;
    } finally {
      setBusy(false);
    }
  };

  // Si otra pestaña cambió el descanso (409), se muestra el estado vigente que devuelve el servidor
  const adoptConflict = (error: unknown) => {
    const payload = (error as { response?: { status?: number; data?: { data?: WorkoutMutation } } })?.response;
    if (payload?.status === 409 && payload.data?.data?.session) {
      apply(payload.data.data, Date.now(), false);
      return true;
    }
    return false;
  };

  // Guarda un bloque completo: primero se asegura de que exista en el servidor (crearlo es idempotente) y luego reemplaza sus series
  const sendBlock = async (sessionId: string, blockId: string, def: PendingBatch['blockDef'], blockSets: NonNullable<PendingBatch['blockSets']>, known = false) => {
    if (!known && def) await workoutService.addBlock(sessionId, { blockId, ...def });
    return workoutService.replaceBlockSets(sessionId, blockId, blockSets);
  };

  const refreshPending = useCallback(async (sessionId?: string) => setPending(await listPending(sessionId, userId)), [userId]);

  // Envía lo que quedó pendiente (sin conexión o con error). Cada serie lleva su clientId: reenviar nunca duplica.
  const flushPending = useCallback(async (): Promise<number> => {
    const id = data?.session?.id;
    if (!id || flushing.current) return 0;
    flushing.current = true;
    let sent = 0;
    try {
      for (const batch of await listPending(id, userId)) {
        const sentAt = Date.now();
        try {
          const mutation = batch.replace && batch.blockSets
            ? await sendBlock(batch.sessionId, batch.blockId, batch.blockDef, batch.blockSets)
            : await workoutService.saveSets(batch.sessionId, batch.blockId, batch.sets);
          await removePending(batch.batchId);
          apply(mutation, sentAt);
          sent += 1;
        } catch (error) {
          if (isRetryable(error)) break; // sigue sin conexión: se intenta de nuevo después
          await removePending(batch.batchId); // el servidor lo rechazó: reintentar no sirve
        }
      }
    } finally {
      flushing.current = false;
      await refreshPending(id);
    }
    return sent;
  }, [data?.session?.id, userId, apply, refreshPending]);

  useEffect(() => {
    const id = data?.session?.id;
    if (!id) return;
    refreshPending(id).then(() => flushPending());
    const online = () => flushPending();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [data?.session?.id, flushPending, refreshPending]);

  // Guarda un lote: primero queda a salvo en la cola local, luego se envía. Si falla por conexión, queda «pendiente».
  const saveBatch = async (session: WorkoutSessionView, blockId: string, sets: SetInput[], display: PendingBatch['display']): Promise<'saved' | 'pending'> => {
    const batch: PendingBatch = { batchId: sets[0].clientId, userId, sessionId: session.id, blockId, sets, display, savedAt: Date.now() };
    await putPending(batch);
    await refreshPending(session.id);
    try {
      await run(() => workoutService.saveSets(session.id, blockId, sets));
      await removePending(batch.batchId);
      await refreshPending(session.id);
      return 'saved';
    } catch (error) {
      if ((error as Error)?.message === 'busy') {
        await removePending(batch.batchId);
        await refreshPending(session.id);
        throw error;
      }
      if (isRetryable(error)) return 'pending';
      // Dato rechazado por el servidor: no se queda en la cola
      await removePending(batch.batchId);
      await refreshPending(session.id);
      throw error;
    }
  };

  // Vista única: guarda el bloque completo. Queda a salvo en este dispositivo ANTES de enviarse; sin conexión queda «pendiente».
  const saveBlock = async (session: WorkoutSessionView, block: DraftBlock): Promise<'saved' | 'pending'> => {
    const blockSets = expandBlock(block);
    const def = { kind: block.kind, slots: block.slots.map((s) => ({ exerciseName: s.name ?? '', modality: s.modality })) };
    const batch: PendingBatch = { batchId: `blk-${block.blockId}`, userId, sessionId: session.id, blockId: block.blockId, sets: [], replace: true, blockSets, blockDef: def, display: [], savedAt: Date.now() };
    await putPending(batch);
    await refreshPending(session.id);
    const known = session.blocks.some((b) => b.blockId === block.blockId);
    try {
      await run(() => sendBlock(session.id, block.blockId, def, blockSets, known));
      await removePending(batch.batchId);
      await refreshPending(session.id);
      return 'saved';
    } catch (error) {
      if ((error as Error)?.message === 'busy') {
        await removePending(batch.batchId);
        await refreshPending(session.id);
        throw error;
      }
      if (isRetryable(error)) return 'pending';
      await removePending(batch.batchId); // el servidor lo rechazó: no se queda en la cola
      await refreshPending(session.id);
      throw error;
    }
  };

  return {
    data,
    status,
    busy,
    session: data?.session ?? null,
    startable: data?.startable ?? null,
    closedStale: data?.closedStale ?? false,
    now,
    offsetMs: offsetRef.current,
    reload: () => load(),
    start: (appointmentId: string, clientId: string) => run(() => workoutService.start(appointmentId, clientId)),
    rest: (session: WorkoutSessionView, action: RestAction, seconds?: number) =>
      run(() => workoutService.rest(session.id, action, { seconds, expectedVersion: session.rest.version })).catch((error) => {
        if (adoptConflict(error)) return undefined;
        throw error;
      }),
    finish: (session: WorkoutSessionView) => run(() => workoutService.finish(session.id)),
    pending,
    flushPending,
    saveBatch,
    saveBlock,
    removeBlock: (session: WorkoutSessionView, blockId: string) => run(() => workoutService.removeBlock(session.id, blockId)),
    addBlock: (session: WorkoutSessionView, block: { blockId: string; kind: BlockKind; slots: { exerciseName: string; modality: Modality }[] }) => run(() => workoutService.addBlock(session.id, block)),
    updateSet: (setId: string, values: { reps?: number; weight?: number; weightUnit?: 'kg' | 'lbs'; durationSec?: number }) => run(() => workoutService.updateSet(setId, values)),
    deleteSet: (setId: string) => run(() => workoutService.deleteSet(setId)),
  };
}
