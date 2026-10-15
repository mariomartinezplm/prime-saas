import { useEffect, useState } from 'react';
import { clientPlanService } from '@/services/clientPlanService';
import { planHistoryOf, type PlanHistoryInfo } from './planView';

// `pending` es verdadero mientras la consulta está en curso (el dashboard espera ese dato antes de mostrar «Para hoy»)
export type PlanHistoryState = PlanHistoryInfo & { pending: boolean };

// Solo cuando NO hay plan vigente: se consultan sus planes para decir con verdad si «venció», «todavía no empieza» o «nunca tuvo».
// Con plan vigente no se hace ninguna petición. Si falla, queda «unknown» y se usa un texto neutral.
export const usePlanHistory = (patientId: string | undefined, enabled: boolean): PlanHistoryState => {
  const [state, setState] = useState<{ info: PlanHistoryInfo; done: boolean }>({ info: { kind: 'unknown' }, done: false });

  useEffect(() => {
    if (!enabled || !patientId) return;
    let alive = true;
    clientPlanService
      .getPatientPlans(patientId)
      .then((plans) => alive && setState({ info: planHistoryOf(plans, new Date()), done: true }))
      .catch(() => alive && setState({ info: { kind: 'unknown' }, done: true }));
    return () => {
      alive = false;
    };
  }, [patientId, enabled]);

  return { ...state.info, pending: enabled && !!patientId && !state.done };
};
