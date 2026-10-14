import { useEffect, useState } from 'react';
import { achievementApi } from '@/services/achievementService';
import { computeProgressView, type ProgressView } from './progressView';

export type SummaryStatus = 'loading' | 'ready' | 'error';

// Una sola consulta a /api/achievements/me al abrir el dashboard (independiente de la carga principal: si tarda o falla, el resto
// de la pantalla no espera ni muestra errores). El resultado ya viene calculado por el servidor.
export const useAchievementsSummary = (): { status: SummaryStatus; view: ProgressView | null } => {
  const [state, setState] = useState<{ status: SummaryStatus; view: ProgressView | null }>({ status: 'loading', view: null });

  useEffect(() => {
    let alive = true;
    achievementApi
      .getMine()
      .then((overview) => alive && setState({ status: 'ready', view: computeProgressView(overview) }))
      .catch(() => alive && setState({ status: 'error', view: null }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
};
