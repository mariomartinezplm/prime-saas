import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { ClientPlan, SessionBalance, User } from '@/types';

export type PlanState = 'active' | 'soon' | 'pending' | 'expired' | 'none';

export interface PatientPlanInfo {
  state: PlanState;
  plan?: ClientPlan;
}

const idOf = (value: User | string): string | undefined =>
  typeof value === 'object' && value ? (value.id ?? (value as { _id?: string })._id) : (value as string | undefined);

// Estado de plan de cada paciente a partir de la lista de planes (una sola consulta),
// con las mismas reglas que se usaban al pedir el saldo paciente por paciente:
//  - pendiente de pago: renovación abierta sin pago registrado
//  - vence pronto: faltan 5 días o menos Y es el último ciclo (un mes intermedio de un plan
//    trimestral o anual no "vence": el siguiente ya está pagado)
//  - vencido: solo tiene planes vencidos
export function planInfoByPatient(plans: ClientPlan[]): Map<string, PatientPlanInfo> {
  const grouped = new Map<string, ClientPlan[]>();
  for (const plan of plans) {
    const id = idOf(plan.patient);
    if (!id) continue;
    grouped.set(id, [...(grouped.get(id) ?? []), plan]);
  }

  const result = new Map<string, PatientPlanInfo>();
  for (const [patientId, list] of grouped) {
    const active = list.filter((p) => p.status === 'active').sort((a, b) => a.endDate.localeCompare(b.endDate));
    const current = active[0];
    if (!current) {
      result.set(patientId, { state: list.some((p) => p.status === 'expired') ? 'expired' : 'none' });
      continue;
    }
    if (current.paymentPending) {
      result.set(patientId, { state: 'pending', plan: current });
      continue;
    }
    // Un plan «hasta completar las sesiones» no vence por fecha
    if (current.openEnded) {
      result.set(patientId, { state: 'active', plan: current });
      continue;
    }
    const daysLeft = differenceInCalendarDays(parseISO(current.endDate), new Date());
    const isLastCycle = (current.cycleNumber ?? 1) >= (current.cyclesTotal ?? 1);
    result.set(patientId, { state: daysLeft <= 5 && isLastCycle ? 'soon' : 'active', plan: current });
  }
  return result;
}

// Lo mismo, a partir del saldo de UN paciente (ficha). Sin plan activo no se distingue "vencido" de
// "nunca tuvo": se informa como "Sin plan activo".
export function infoFromBalance(balance: SessionBalance | null): PatientPlanInfo | undefined {
  if (!balance) return undefined;
  const plan = balance.plan;
  if (!balance.hasActivePlan || !plan) return { state: 'none' };
  if (balance.paymentPending) return { state: 'pending', plan };
  if (plan.openEnded) return { state: 'active', plan };
  const daysLeft = differenceInCalendarDays(parseISO(plan.endDate), new Date());
  const isLastCycle = (plan.cycleNumber ?? 1) >= (plan.cyclesTotal ?? 1);
  return { state: daysLeft <= 5 && isLastCycle ? 'soon' : 'active', plan };
}
