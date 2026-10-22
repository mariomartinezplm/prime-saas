import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ClientPlan, SessionBalance } from '../../types';
import type { PlanHistory } from './todayActions';
import { TERM_NAME } from '../../config/planCatalog';

/**
 * «Mi plan»: qué mostrar según el estado real del plan (función pura, sin React ni API).
 *
 *   error      no se pudo cargar el saldo: se dice, sin inventar nada
 *   inactive   no hay plan vigente. Se distingue (si se pudo saber) entre: venció, todavía no empieza, o nunca tuvo uno
 *   active     plan con sesiones y con cupo disponible
 *   used-up    plan vigente al que ya no le quedan sesiones (incluidas las extra)
 *   unlimited  plan ilimitado: no tiene denominador, por eso nunca lleva barra de progreso
 *
 * La barra solo existe cuando hay un total real de sesiones (plan limitado con total > 0). Las reglas de negocio (qué cuenta
 * como sesión usada, pagos, vigencia) las decide el servidor: aquí solo se presentan.
 */

export type PlanViewKind = 'error' | 'inactive' | 'active' | 'used-up' | 'unlimited';

export interface PlanView {
  kind: PlanViewKind;
  inactiveReason?: PlanHistory;
  upcomingStart?: string; // 'dd/MM/yyyy', solo si el plan todavía no empieza
  endedOn?: string; // 'dd/MM/yyyy', solo si el último plan venció
  serviceType?: ClientPlan['serviceType'];
  validUntil?: string; // 'dd/MM/yyyy' (no existe en un plan «hasta completar las sesiones»)
  openEnded?: boolean; // kinesiología: dura hasta completar las sesiones, sin fecha de término
  daysLeftText?: string; // 'vence hoy' | '1 día restante' | '12 días restantes'
  cycleText?: string; // 'Anual · mes 3 de 12'
  used?: number;
  total?: number; // solo en planes con total de sesiones
  available?: number; // incluye las sesiones extra
  extra?: number;
  ratio?: number; // 0..1, solo cuando hay total real
  paymentPending?: boolean; // etiqueta de estado; el aviso con fecha y botón es el de arriba (no se repite)
}

// Con qué historial de planes cuenta quien hoy no tiene plan vigente
export interface PlanHistoryInfo {
  kind: PlanHistory;
  upcomingStart?: string; // ISO del inicio del plan que todavía no empieza
  endedOn?: string; // ISO del fin del último plan vencido
}

export const planHistoryOf = (plans: Pick<ClientPlan, 'status' | 'startDate' | 'endDate'>[], now: Date): PlanHistoryInfo => {
  const upcoming = plans.filter((p) => p.status === 'upcoming').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return { kind: 'upcoming', upcomingStart: upcoming.startDate };
  const ended = plans
    .filter((p) => p.status === 'expired' || (p.status === 'active' && parseISO(p.endDate) < now))
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  return ended ? { kind: 'expired', endedOn: ended.endDate } : { kind: 'none' };
};

const cycleTextOf = (plan: Pick<ClientPlan, 'cycleNumber' | 'cyclesTotal' | 'term'>) => {
  if (!plan.cyclesTotal || plan.cyclesTotal <= 1) return undefined;
  return `${TERM_NAME[plan.term as string] ?? 'Trimestral'} · mes ${plan.cycleNumber ?? 1} de ${plan.cyclesTotal}`;
};

const daysLeftTextOf = (days: number) => (days <= 0 ? 'vence hoy' : days === 1 ? '1 día restante' : `${days} días restantes`);

export function computePlanView({ balance, history, now }: { balance: SessionBalance | null; history: PlanHistoryInfo; now: Date }): PlanView {
  if (!balance) return { kind: 'error' };

  if (!balance.hasActivePlan || !balance.plan) {
    return {
      kind: 'inactive',
      inactiveReason: history.kind,
      upcomingStart: history.upcomingStart ? format(parseISO(history.upcomingStart), 'dd/MM/yyyy') : undefined,
      endedOn: history.endedOn ? format(parseISO(history.endedOn), 'dd/MM/yyyy') : undefined,
    };
  }

  const plan = balance.plan;
  const base: PlanView = {
    kind: 'active',
    serviceType: plan.serviceType,
    openEnded: plan.openEnded === true,
    validUntil: plan.openEnded ? undefined : format(parseISO(plan.endDate), 'dd/MM/yyyy'),
    daysLeftText: plan.openEnded ? undefined : daysLeftTextOf(differenceInCalendarDays(parseISO(plan.endDate), now)),
    cycleText: cycleTextOf(plan),
    used: plan.sessionsUsed,
    paymentPending: balance.paymentPending === true,
  };

  if (plan.unlimited) return { ...base, kind: 'unlimited' };

  const hasTotal = plan.sessionsTotal > 0;
  return {
    ...base,
    kind: balance.totalAvailable === 0 ? 'used-up' : 'active',
    total: hasTotal ? plan.sessionsTotal : undefined,
    available: balance.totalAvailable,
    extra: balance.extraSessionsAvailable > 0 ? balance.extraSessionsAvailable : undefined,
    ratio: hasTotal ? Math.min(1, Math.max(0, plan.sessionsUsed / plan.sessionsTotal)) : undefined,
  };
}
