import { useEffect, useState } from 'react';
import { clientPlanService } from '@/services/clientPlanService';
import { planHistoryOf, type PlanHistoryInfo } from './planView';

// Solo cuando NO hay plan vigente: se consultan sus planes para decir con verdad si «venció», «todavía no empieza» o «nunca tuvo».
// Con plan vigente no se hace ninguna petición. Si falla, queda «unknown» y se usa un texto neutral.
export const usePlanHistory = (patientId: string | undefined, enabled: boolean): PlanHistoryInfo => {
  const [history, setHistory] = useState<PlanHistoryInfo>({ kind: 'unknown' });

  useEffect(() => {
    if (!enabled || !patientId) return;
    let alive = true;
    clientPlanService
      .getPatientPlans(patientId)
      .then((plans) => alive && setHistory(planHistoryOf(plans, new Date())))
      .catch(() => alive && setHistory({ kind: 'unknown' }));
    return () => {
      alive = false;
    };
  }, [patientId, enabled]);

  return history;
};
