import { useCallback, useEffect, useState } from 'react';
import { goalService, type GoalCatalog, type GoalView } from '@/services/goalService';

// Los objetivos propios y el catálogo, cargados una sola vez para quien los necesite (pregunta al ingresar, check-in semanal)
export function useMyGoals(userId: string | undefined, enabled: boolean) {
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [catalog, setCatalog] = useState<GoalCatalog | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!userId || !enabled) return Promise.resolve();
    return Promise.all([goalService.list(userId), goalService.getCatalog()])
      .then(([g, c]) => {
        setGoals(g);
        setCatalog(c);
        setLoaded(true);
      })
      .catch(() => undefined); // si no cargan, no se molesta a la persona: Mis objetivos mostrará el error con su botón de reintentar
  }, [userId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = useCallback((updated: GoalView) => setGoals((list) => list.map((g) => (g.id === updated.id ? updated : g))), []);
  return { goals, catalog, loaded, reload: load, replace };
}
