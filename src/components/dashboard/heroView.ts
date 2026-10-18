import { appointmentEnd, appointmentStart } from '../../lib/appointments';
import type { Appointment, SessionBalance } from '../../types';
import type { PlanView } from './planView';
import { nextSessionLabel, type NextSessionLabel } from './nextSession';
import { timeUntil } from './todayActions';

/**
 * Tarjeta protagonista del dashboard: UNA sola cosa importante según el estado real del paciente (función pura, sin React).
 * Prioridad: cargando → sin plan vigente → sesión (en curso, hoy, futura) → sin sesiones disponibles → reservar. Nada se inventa:
 * si no se pudo comprobar algo, se dice «no pudimos», no se afirma lo contrario.
 */
export type HeroPhase = 'live' | 'today' | 'future';
export type BlockedReason = 'expired' | 'none' | 'upcoming' | 'unknown' | 'used-up';

export type HeroView =
  | { kind: 'loading' }
  | { kind: 'error'; what: 'session' | 'plan' }
  | { kind: 'session'; phase: HeroPhase; appointment: Appointment; label: NextSessionLabel; when: string }
  | { kind: 'blocked'; reason: BlockedReason; nextSession: Appointment | null }
  | { kind: 'book'; detail: string };

export interface HeroInput {
  now: Date;
  upcoming: Appointment[] | null;
  upcomingState: 'loading' | 'ready' | 'error';
  balance: SessionBalance | null;
  balanceState: 'loading' | 'ready' | 'error';
  planView: PlanView;
  planPending: boolean; // todavía se consulta el historial de planes (solo si no hay plan vigente)
}

// La sesión programada que sigue (o que está en curso): la primera que todavía no terminó
export const heroAppointment = (upcoming: Appointment[] | null, now: Date): Appointment | null =>
  (upcoming ?? [])
    .filter((apt) => apt.status === 'scheduled' && appointmentEnd(apt) > now)
    .sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime())[0] ?? null;

export function computeHeroView({ now, upcoming, upcomingState, balance, balanceState, planView, planPending }: HeroInput): HeroView {
  if (upcomingState === 'loading' || balanceState === 'loading' || (balanceState === 'ready' && balance && !balance.hasActivePlan && planPending)) {
    return { kind: 'loading' };
  }
  const next = upcomingState === 'ready' ? heroAppointment(upcoming, now) : null;

  // Sin plan vigente: es lo primero que debe saber (no puede agendar). Si ya tenía una sesión agendada, se menciona aparte.
  if (balanceState === 'ready' && balance && !balance.hasActivePlan) {
    return { kind: 'blocked', reason: planView.inactiveReason ?? 'unknown', nextSession: next };
  }

  if (next) {
    const started = appointmentStart(next) <= now;
    const label = nextSessionLabel(next, now);
    if (started) return { kind: 'session', phase: 'live', appointment: next, label, when: 'En curso' };
    if (label.isToday) return { kind: 'session', phase: 'today', appointment: next, label, when: `Hoy · ${timeUntil(now, appointmentStart(next))}` };
    return { kind: 'session', phase: 'future', appointment: next, label, when: label.text };
  }

  if (upcomingState === 'error') return { kind: 'error', what: 'session' };
  if (balanceState === 'error' || !balance) return { kind: 'error', what: 'plan' };

  // Plan vigente y nada agendado
  if (!balance.plan?.unlimited && balance.totalAvailable === 0) return { kind: 'blocked', reason: 'used-up', nextSession: null };
  return {
    kind: 'book',
    detail: balance.plan?.unlimited ? 'Tu plan es ilimitado.' : `Te ${balance.totalAvailable === 1 ? 'queda 1 sesión' : `quedan ${balance.totalAvailable} sesiones`}.`,
  };
}
