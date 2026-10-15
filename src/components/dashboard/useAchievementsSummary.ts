import { useCallback, useEffect, useRef, useState } from 'react';
import { achievementApi } from '@/services/achievementService';
import { withTimeout } from '@/lib/withTimeout';
import { computeProgressView, type ProgressView } from './progressView';

export type SummaryStatus = 'loading' | 'ready' | 'error';

// Una sola consulta a /api/achievements/me al abrir el dashboard (independiente de la carga principal: si tarda o falla, el resto
// de la pantalla no espera). El resultado ya viene calculado por el servidor. Si falla (o no responde), el bloque lo dice y deja
// reintentar solo esta consulta.
export const useAchievementsSummary = (): { status: SummaryStatus; view: ProgressView | null; retry: () => void } => {
  const [state, setState] = useState<{ status: SummaryStatus; view: ProgressView | null }>({ status: 'loading', view: null });
  // Una respuesta tardía de un intento anterior nunca pisa al más reciente
  const attempt = useRef(0);

  const load = useCallback(() => {
    const id = ++attempt.current;
    withTimeout(achievementApi.getMine())
      .then((overview) => id === attempt.current && setState({ status: 'ready', view: computeProgressView(overview) }))
      .catch(() => id === attempt.current && setState((prev) => ({ status: prev.view ? 'ready' : 'error', view: prev.view })));
  }, []);

  useEffect(() => {
    const counter = attempt;
    load();
    // Al salir de la pantalla, cualquier respuesta pendiente se descarta
    return () => {
      counter.current += 1;
    };
  }, [load]);

  const retry = useCallback(() => {
    setState((prev) => (prev.status === 'error' ? { status: 'loading', view: null } : prev));
    load();
  }, [load]);

  return { ...state, retry };
};
