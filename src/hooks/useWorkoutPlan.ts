import { useCallback, useEffect, useRef, useState } from 'react';
import { clearPlans, loadPlan, mergePlan, savePlan, type DraftBlock } from '@/lib/workoutPlan';
import type { WorkoutSessionView } from '@/services/workoutService';

// Los bloques de la sesión tal como la persona los está armando (en el orden que eligió). Se guardan solo en este dispositivo mientras
// dura el entrenamiento y se unen con lo que ya está en el servidor (por ejemplo, de otro dispositivo o de antes de recargar).
export function useWorkoutPlan(userId: string, session: WorkoutSessionView | null) {
  const sessionId = session?.id ?? null;
  const [blocks, setBlocksState] = useState<DraftBlock[]>([]);
  const loadedFor = useRef<string | null>(null);

  // Al abrir (o cambiar de) sesión: copia local + lo del servidor
  useEffect(() => {
    if (!session || !sessionId) {
      loadedFor.current = null;
      setBlocksState([]);
      return;
    }
    if (loadedFor.current !== sessionId) {
      loadedFor.current = sessionId;
      setBlocksState(mergePlan(loadPlan(userId, sessionId), session.blocks, session.sets));
      return;
    }
    // Ya cargada: si el servidor tiene un bloque que aquí no está (otro dispositivo), se suma sin tocar lo que se está editando
    setBlocksState((prev) => {
      const merged = mergePlan(prev, session.blocks, session.sets);
      return merged.length === prev.length ? prev : merged;
    });
  }, [session, sessionId, userId]);

  // Copia local en cada cambio
  useEffect(() => {
    if (sessionId && loadedFor.current === sessionId) savePlan(userId, sessionId, blocks);
  }, [blocks, sessionId, userId]);

  const setBlocks = useCallback((update: (prev: DraftBlock[]) => DraftBlock[]) => setBlocksState(update), []);
  const updateBlock = useCallback((blockId: string, change: (b: DraftBlock) => DraftBlock) => setBlocksState((prev) => prev.map((b) => (b.blockId === blockId ? change(b) : b))), []);
  const clear = useCallback(() => {
    if (sessionId) clearPlans(userId, sessionId);
  }, [sessionId, userId]);

  return { blocks, setBlocks, updateBlock, clear };
}
