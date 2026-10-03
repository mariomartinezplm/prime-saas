import { useEffect, useState } from 'react';
import { clientPlanService } from '@/services/clientPlanService';

// null mientras carga. Si no se puede saber, se asume activo: el servidor igual
// bloquea lo que no corresponde.
export function useHasActivePlan(patientId?: string): boolean | null {
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (!patientId) return;
    clientPlanService
      .getBalance(patientId)
      .then((balance) => setHasActivePlan(balance.hasActivePlan))
      .catch(() => setHasActivePlan(true));
  }, [patientId]);

  return hasActivePlan;
}
