import { useCallback, useEffect, useRef, useState } from 'react';
import { wellnessService } from '@/services/wellnessService';
import type { ReadinessToday } from './todayActions';

// ¿Falta el Readiness de hoy? El dashboard lo necesita para «Para hoy», pero esa información vive dentro de
// WellnessCheckinCard (que no se toca). Por eso se consulta aparte (un GET liviano) y se vuelve a consultar cuando:
//  - la persona vuelve a la pestaña o a la app (focus / visibilidad), y
//  - cambia el contenido de la tarjeta del Readiness (al terminar el cuestionario cambia de pantalla; con una pausa
//    para no consultar en cada pregunta).
// Solo mientras falta: una vez respondido ya no se consulta más.
export const useReadinessToday = (card: HTMLElement | null, enabled: boolean): ReadinessToday => {
  const [status, setStatus] = useState<ReadinessToday>('loading');
  const alive = useRef(true);
  const statusRef = useRef<ReadinessToday>('loading');
  statusRef.current = status;

  const refresh = useCallback(() => {
    wellnessService
      .getToday()
      .then((checkin) => alive.current && setStatus(checkin ? 'done' : 'pending'))
      // Si falla, no se afirma nada: queda «unknown» (o el último valor conocido)
      .catch(() => alive.current && setStatus((prev) => (prev === 'loading' ? 'unknown' : prev)));
  }, []);

  useEffect(() => {
    alive.current = true;
    if (enabled) refresh();
    return () => {
      alive.current = false;
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const refreshIfNeeded = () => {
      if (statusRef.current !== 'done') refresh();
    };
    const onVisible = () => document.visibilityState === 'visible' && refreshIfNeeded();
    window.addEventListener('focus', refreshIfNeeded);
    document.addEventListener('visibilitychange', onVisible);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = card
      ? new MutationObserver(() => {
          if (statusRef.current === 'done') return;
          clearTimeout(timer);
          timer = setTimeout(refreshIfNeeded, 1200);
        })
      : null;
    if (card && observer) observer.observe(card, { childList: true, subtree: true, characterData: true });

    return () => {
      window.removeEventListener('focus', refreshIfNeeded);
      document.removeEventListener('visibilitychange', onVisible);
      observer?.disconnect();
      clearTimeout(timer);
    };
  }, [card, enabled, refresh]);

  return status;
};
