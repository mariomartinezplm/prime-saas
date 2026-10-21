import { useCallback, useEffect, useRef, useState } from 'react';
import { clockOffset } from '@/lib/workoutClock';
import { workoutService, type RestAction, type WorkoutActive, type WorkoutMutation, type WorkoutSessionView } from '@/services/workoutService';

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
  };
}
